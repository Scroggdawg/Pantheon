// S26 Step 4f — pipeline-level library shortcut (single-hit).
// S26 Step 4f.5 — pipeline-level segmented library shortcut (multi-item utterance).
// S26 Step 4g — pipeline-level library candidates mode (multi-hit).
//
// Three complementary helpers in front of Sonnet synthesis:
//
//   tryLibraryShortcut: single high-confidence library hit
//     (score >= 0.85, gap >= 0.15 from second-place) → returns
//     a one-food ParsedMealResponse, ~200ms.
//
//   tryLibrarySegmentedShortcut (Brick D): multi-item utterance
//     ("three eggs and a banana") → segments via string rules,
//     requires ALL segments to hit single high-confidence library
//     entries (same gates as 4f), returns aggregated multi-food
//     ParsedMealResponse. Falls through on any miss.
//
//   tryLibraryCandidates: 2+ library entries score >= 0.6 but
//     no single one clears the shortcut threshold → surfaces
//     the top 3 via the existing disambiguation UI, ~200ms,
//     ordered by recency-then-score-then-name.
//
// On miss any helper returns null so the route falls through
// to the next layer (segmented after shortcut, candidates after
// segmented, Sonnet after candidates) with no behavioral change.
//
// Neither helper writes to the response cache — library lookup
// is already fast, no compounding gain. Candidates mode also
// avoids locking-in a candidates-mode response that's not yet
// the user's final pick.

import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  DisambiguationCandidate,
  FoodItem,
  ParsedMealResponse,
  UnitAlternative,
} from '@/types/database'

import { confidenceLabel } from './tools/constants'
import {
  searchUserLibrary,
  type LibrarySearchResult,
  type LibraryTotal,
} from './tools/search-user-library'

// Threshold tuning per V15: starting values, refine based on real
// usage telemetry. Score gate alone is insufficient — gap gate
// prevents shortcut firing on ambiguous-brand cases (multiple
// close library matches, e.g. several Yasso flavors).
const SHORTCUT_SCORE_THRESHOLD = 0.85
const SHORTCUT_GAP_THRESHOLD = 0.15

// M.1 — write-time source_ref normalization (Brick Beta-1).
//
// Strips ratcheting "lib:hourly_go_to:NAME|" prefixes from a chained
// source_ref, leaving the terminal underlying ref ("lib:saved_meal:UUID"
// or "lib:product:UUID") intact. Without this, hourly_go_to picks
// ratchet one prefix deeper per parse-meal cycle: each log inherits the
// prior chained ref AND prepends its own hourly library_id.
//
// Applied at every food.source_ref write site below (4 in this file).
// Belt-and-suspenders cascade-dedup in dedupKeyFor() handles any chains
// that bypass this normalization (e.g., legacy data pre-migration 020).
export function normalizeFoodSourceRef(ref: string | null | undefined): string | null {
  if (!ref) return null
  const cleaned = ref.replace(/^(lib:hourly_go_to:[^|]+\|)+/, '')
  // Degenerate case: input was solely the chain prefix with empty terminal.
  // Preserve original semantics rather than producing an empty string.
  return cleaned.length > 0 ? cleaned : ref
}

// Candidates-mode thresholds. Lower than single-hit because we're
// surfacing options for the user to pick, not committing to one.
const CANDIDATES_MIN_SCORE = 0.6
const CANDIDATES_MAX_COUNT = 3

export interface LibraryShortcutResult {
  response: ParsedMealResponse
  hit: boolean
  top_score?: number
  second_score?: number
  gap?: number
  lookup_count?: number
}

type DextroseIntent = 'none' | 'half' | 'full' | null

function normalizeShortcutText(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function dextroseIntent(value: string): DextroseIntent {
  const normalized = normalizeShortcutText(value)
  if (!/\bdextrose\b/.test(normalized)) return null
  if (/\b(no|without)\s+dextrose\b/.test(normalized)) return 'none'
  if (/\bwith\s+no\s+dextrose\b/.test(normalized)) return 'none'
  if (/\bhalf(?:\s+a)?(?:\s+serving)?\s+(?:of\s+)?(?:nutricost\s+)?dextrose\b/.test(normalized)) {
    return 'half'
  }
  if (/\bhalf\s+dextrose\b/.test(normalized)) return 'half'
  if (/\b(full|one|1)\s+(?:serving\s+(?:of\s+)?)?(?:nutricost\s+)?dextrose\b/.test(normalized)) {
    return 'full'
  }
  if (/\bwith\s+(?:nutricost\s+)?dextrose\b/.test(normalized)) return 'full'
  return null
}

function hasProteinShakeText(value: string): boolean {
  return /\bprotein\s+shake\b/.test(normalizeShortcutText(value))
}

function hasDoubleProteinIntent(value: string): boolean {
  const normalized = normalizeShortcutText(value)
  return (
    /\bdouble\s+protein\b/.test(normalized) ||
    /\b(?:two|2)\s+scoops?\b/.test(normalized) ||
    /\b(?:two|2)\s+scoop\s+protein\s+shake\b/.test(normalized)
  )
}

function isIsopureShakeIngredientShortcutTranscript(value: string): boolean {
  const normalized = normalizeShortcutText(value)
  return hasProteinShakeText(value) && (/\bisopure\b/.test(normalized) || dextroseIntent(value) !== null)
}

function foodFromLibraryTotal(args: {
  name: string
  qty: number
  unit: string
  total: LibraryTotal
  sourceRef: string | null | undefined
  score: number
  unitAlternatives?: UnitAlternative[]
}): FoodItem {
  return {
    name: args.name,
    qty: args.qty,
    unit: args.unit,
    calories: args.total.kcal,
    protein_g: args.total.protein_g,
    carbs_g: args.total.carbs_g,
    fat_g: args.total.fat_g,
    source: 'library',
    source_ref: normalizeFoodSourceRef(args.sourceRef),
    unit_alternatives: args.unitAlternatives,
    match_confidence: {
      score: args.score,
      label: confidenceLabel(args.score),
      warnings: [],
    },
    notes: null,
  }
}

export async function tryProteinShakeIngredientShortcut(
  supabase: SupabaseClient,
  userId: string,
  transcript: string,
): Promise<LibraryShortcutResult | null> {
  if (!isIsopureShakeIngredientShortcutTranscript(transcript)) return null
  if (!looksLikeProteinShakeOnlyTranscript(transcript)) return null

  return resolveProteinShakeIngredientShortcut(supabase, userId, transcript)
}

async function resolveProteinShakeIngredientShortcut(
  supabase: SupabaseClient,
  userId: string,
  transcript: string,
): Promise<LibraryShortcutResult | null> {

  const proteinScoops = hasDoubleProteinIntent(transcript) ? 2 : 1
  const intent = dextroseIntent(transcript)
  const dextroseServings = intent === 'full' ? 1 : intent === 'half' ? 0.5 : 0

  const proteinRes = await searchUserLibrary(
    { query: 'isopure chocolate protein', limit: 3 },
    { userId, supabase },
  )
  const protein = proteinRes.results.find((r) =>
    normalizeShortcutText(r.name).includes('isopure low carb protein powder'),
  )
  if (!protein) return null

  const foods: FoodItem[] = [
    foodFromLibraryTotal({
      name: protein.name,
      qty: proteinScoops,
      unit: 'scoop',
      total: scaleTotal(protein.total, proteinScoops),
      sourceRef: protein.source_ref ?? protein.library_id,
      score: protein.match_confidence.score,
      unitAlternatives: protein.unit_alternatives,
    }),
  ]

  let lookupCount = 1
  if (dextroseServings > 0) {
    lookupCount += 1
    const dextroseRes = await searchUserLibrary(
      { query: 'nutricost dextrose', limit: 5 },
      { userId, supabase },
    )
    const dextrose = dextroseRes.results.find((r) => {
      const name = normalizeShortcutText(r.name)
      return name.includes('dextrose') && !name.includes('protein shake')
    })
    if (!dextrose) return null

    foods.push(
      foodFromLibraryTotal({
        name: dextrose.name,
        qty: dextroseServings,
        unit: 'serving',
        total: scaleTotal(dextrose.total, dextroseServings),
        sourceRef: dextrose.source_ref ?? dextrose.library_id,
        score: dextrose.match_confidence.score,
        unitAlternatives: dextrose.unit_alternatives,
      }),
    )
  }

  const totalCal = foods.reduce((acc, f) => acc + f.calories, 0)
  const totalProt = foods.reduce((acc, f) => acc + f.protein_g, 0)
  const totalCarbs = foods.reduce((acc, f) => acc + f.carbs_g, 0)
  const totalFat = foods.reduce((acc, f) => acc + f.fat_g, 0)

  return {
    response: {
      foods,
      total_calories: Math.round(totalCal),
      total_protein_g: Math.round(totalProt * 100) / 100,
      total_carbs_g: Math.round(totalCarbs * 100) / 100,
      total_fat_g: Math.round(totalFat * 100) / 100,
      clarification_needed: null,
      disambiguation: null,
    },
    hit: true,
    lookup_count: lookupCount,
  }
}

function looksLikeProteinShakeOnlyTranscript(value: string): boolean {
  const normalized = normalizeShortcutText(value)
  if (!hasProteinShakeText(normalized)) return false

  const residue = normalized
    .replace(/\b(?:one|1|two|2|double)\b/g, ' ')
    .replace(/\bprotein\s+shake\b/g, ' ')
    .replace(/\bisopure\b/g, ' ')
    .replace(/\bchocolate\b/g, ' ')
    .replace(/\bprotein\b/g, ' ')
    .replace(/\bscoops?\b/g, ' ')
    .replace(/\bwith(?:out)?\b/g, ' ')
    .replace(/\ba\b/g, ' ')
    .replace(/\ban\b/g, ' ')
    .replace(/\bno\b/g, ' ')
    .replace(/\bhalf\b/g, ' ')
    .replace(/\bfull\b/g, ' ')
    .replace(/\bone\b/g, ' ')
    .replace(/\bservings?\b/g, ' ')
    .replace(/\bof\b/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/\bnutricost\b/g, ' ')
    .replace(/\bdextrose\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return residue.length === 0
}

export async function tryLibraryShortcut(
  supabase: SupabaseClient,
  userId: string,
  transcript: string,
): Promise<LibraryShortcutResult | null> {
  const libRes = await searchUserLibrary(
    { query: transcript, limit: 2 },
    { userId, supabase },
  )

  const results = libRes.results
  if (results.length === 0) return null

  const top = results[0]
  const second = results[1]
  const topScore = top.match_confidence.score
  const secondScore = second?.match_confidence.score ?? 0
  const gap = topScore - secondScore

  if (topScore < SHORTCUT_SCORE_THRESHOLD) return null
  if (gap < SHORTCUT_GAP_THRESHOLD) return null

  // High-confidence single hit. Build a one-food response. Unit
  // is hardcoded 'serving' because LibrarySearchResult.total is
  // per-serving by construction (saved_meals divided by
  // yield_servings; products are 1 unit per serving).
  const food: FoodItem = {
    name: top.name,
    qty: 1,
    unit: 'serving',
    calories: top.total.kcal,
    protein_g: top.total.protein_g,
    carbs_g: top.total.carbs_g,
    fat_g: top.total.fat_g,
    source: 'library',
    source_ref: normalizeFoodSourceRef(top.source_ref ?? top.library_id),
    unit_alternatives: top.unit_alternatives,
    match_confidence: {
      score: top.match_confidence.score,
      label: top.match_confidence.label,
      warnings: [],
    },
    notes: null,
  }

  return {
    response: {
      foods: [food],
      total_calories: food.calories,
      total_protein_g: food.protein_g,
      total_carbs_g: food.carbs_g,
      total_fat_g: food.fat_g,
      clarification_needed: null,
      disambiguation: null,
    },
    hit: true,
    top_score: topScore,
    second_score: secondScore,
    gap,
  }
}

// ---------------------------------------------------------------------
// S26 Step 4g — library candidates mode
// ---------------------------------------------------------------------

export interface LibraryCandidatesResult {
  response: ParsedMealResponse
  hit: boolean
  candidate_count?: number
  top_score?: number
}

export async function tryLibraryCandidates(
  supabase: SupabaseClient,
  userId: string,
  transcript: string,
): Promise<LibraryCandidatesResult | null> {
  const libRes = await searchUserLibrary(
    { query: transcript, limit: CANDIDATES_MAX_COUNT },
    { userId, supabase },
  )

  const results = libRes.results
  if (results.length === 0) return null

  const eligible = results.filter(
    (r) => r.match_confidence.score >= CANDIDATES_MIN_SCORE,
  )

  // Need at least 2 eligible candidates for "candidates mode".
  // (Single-hit shortcut would have fired upstream if there were
  // exactly one high-confidence match.)
  if (eligible.length < 2) return null

  // Recency-then-score-then-name ordering. Newer last_logged_at
  // first; null timestamps (products) tie at 0 → score breaks
  // tie → name alphabetical for stability.
  const sorted = [...eligible].sort((a, b) => {
    const aTime = a.last_logged_at ? new Date(a.last_logged_at).getTime() : 0
    const bTime = b.last_logged_at ? new Date(b.last_logged_at).getTime() : 0
    if (aTime !== bTime) return bTime - aTime

    const scoreDiff = b.match_confidence.score - a.match_confidence.score
    if (scoreDiff !== 0) return scoreDiff

    return a.name.localeCompare(b.name)
  })

  const topN = sorted.slice(0, CANDIDATES_MAX_COUNT)
  const top = topN[0]

  // Placeholder food uses top candidate as best-guess. Native UI
  // will replace it when the user picks from disambiguation.
  // 'library_candidates_mode' warning flags the placeholder
  // status for the native renderer.
  const placeholderFood: FoodItem = {
    name: top.name,
    qty: 1,
    unit: 'serving',
    calories: top.total.kcal,
    protein_g: top.total.protein_g,
    carbs_g: top.total.carbs_g,
    fat_g: top.total.fat_g,
    source: 'library',
    source_ref: normalizeFoodSourceRef(top.source_ref ?? top.library_id),
    unit_alternatives: top.unit_alternatives,
    match_confidence: {
      score: top.match_confidence.score,
      label: top.match_confidence.label,
      warnings: ['library_candidates_mode'],
    },
    notes: null,
  }

  const candidates: DisambiguationCandidate[] = topN.map((r) => ({
    name: r.name,
    source: 'library' as const,
    source_ref: normalizeFoodSourceRef(r.source_ref ?? r.library_id) ?? r.library_id,
    per_serving: {
      calories: r.total.kcal,
      protein_g: r.total.protein_g,
      carbs_g: r.total.carbs_g,
      fat_g: r.total.fat_g,
    },
    match_confidence: {
      score: r.match_confidence.score,
      label: r.match_confidence.label,
      warnings: [],
    },
  }))

  return {
    response: {
      foods: [placeholderFood],
      total_calories: placeholderFood.calories,
      total_protein_g: placeholderFood.protein_g,
      total_carbs_g: placeholderFood.carbs_g,
      total_fat_g: placeholderFood.fat_g,
      clarification_needed: null,
      disambiguation: [
        {
          item_index: 0,
          query_used: transcript,
          candidates,
        },
      ],
    },
    hit: true,
    candidate_count: topN.length,
    top_score: top.match_confidence.score,
  }
}

// ---------------------------------------------------------------------
// S26 Step 4f.5 — segmented library shortcut (Brick D)
// ---------------------------------------------------------------------
//
// Multi-item voice utterances ("three eggs and a banana") currently
// fall through to the LLM path because searchUserLibrary scores the
// whole transcript against each library entry, diluting the score
// below the 0.85 shortcut threshold. This helper segments the
// transcript into food candidates via string rules, runs the
// existing shortcut gates per segment, and aggregates if all hit.
//
// Approach: string-only (no LLM segmentation). Brief delimiters,
// composite-item allowlist for known compound names, written-number
// → digit normalization for Luke's library where saved entries use
// digit form ("3 eggs" not "three eggs"). Composite cases that
// over-split or non-library segments degrade to current behavior.

const SEGMENT_SHORTCUT_SCORE_THRESHOLD = 0.85
const SEGMENT_SHORTCUT_GAP_THRESHOLD = 0.15

// Compound names that contain " and " but should NOT be split.
// Add new entries when over-split patterns surface in production.
const COMPOSITE_ALLOWLIST = [
  'half and half',
  'salt and pepper',
  'mac and cheese',
  'fish and chips',
  'rice and beans',
]

const COMPOSITE_PLACEHOLDER = (i: number) => `__COMPOSITE_${i}__`

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeCompositePhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compositeTokens(s: string): string[] {
  return normalizeCompositePhrase(s)
    .split(' ')
    .filter((token) => token.length > 1 || token === 'and')
}

function hasAndConnector(s: string): boolean {
  return compositeTokens(s).includes('and')
}

function compositeProtectionPhrases(name: string): string[] {
  const tokens = compositeTokens(name)
  const normalized = tokens.join(' ')
  if (!normalized) return []
  const connectorIndexes = tokens
    .map((t, i) => (t === 'and' ? i : -1))
    .filter((i) => i >= 0)
  if (connectorIndexes.length === 0) return []

  const phrases = new Set<string>()
  phrases.add(normalized)

  // Runtime names often include a brand/restaurant prefix, while voice
  // transcripts place that context elsewhere ("Bacon Egg and Cheese
  // Biscuit from McDonald's"). Protect the food-name window around
  // "and" so the segmenter keeps the compound intact in both shapes.
  for (const idx of connectorIndexes) {
    for (let left = 1; left <= 3; left++) {
      for (let right = 1; right <= 3; right++) {
        const start = Math.max(0, idx - left)
        const end = Math.min(tokens.length, idx + right + 1)
        const phrase = tokens.slice(start, end).join(' ')
        const phraseLength = phrase.split(' ').length
        if (phrase === normalized || phraseLength >= 4) phrases.add(phrase)
      }
    }
  }

  return [...phrases]
}

function compositePhraseRegex(phrase: string): RegExp | null {
  const tokens = compositeTokens(phrase)
  if (tokens.length < 3 || !tokens.includes('and')) return null

  const pattern = tokens
    .map((token) => (token === 'and' ? '(?:and|&)' : escapeRegExp(token)))
    .join('[^a-z0-9]+')
  return new RegExp(`\\b${pattern}\\b`, 'gi')
}

function buildCompositeProtectionPhrases(runtimeCompositeNames: string[]): string[] {
  const phrases = new Map<string, string>()
  for (const name of [...COMPOSITE_ALLOWLIST, ...runtimeCompositeNames]) {
    for (const phrase of compositeProtectionPhrases(name)) {
      phrases.set(normalizeCompositePhrase(phrase), phrase)
    }
  }

  return [...phrases.values()].sort((a, b) => b.length - a.length)
}

async function loadRuntimeCompositeNames(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const [savedMealsRes, productsRes] = await Promise.all([
    supabase.from('saved_meals').select('name').eq('user_id', userId),
    supabase.from('products').select('name, brand'),
  ])

  if (savedMealsRes.error) {
    console.warn('[parse-meal] M.3 saved_meals compound lookup failed:', savedMealsRes.error.message)
  }
  if (productsRes.error) {
    console.warn('[parse-meal] M.3 products compound lookup failed:', productsRes.error.message)
  }

  const savedMealNames = (savedMealsRes.data ?? [])
    .map((row) => row.name)
    .filter((name): name is string => typeof name === 'string' && hasAndConnector(name))

  const productNames = (productsRes.data ?? [])
    .map((row) => {
      const name = typeof row.name === 'string' ? row.name : ''
      const brand = typeof row.brand === 'string' ? row.brand : ''
      return brand && !name.toLowerCase().includes(brand.toLowerCase())
        ? `${brand} ${name}`
        : name
    })
    .filter((name) => name.length > 0 && hasAndConnector(name))

  return [...savedMealNames, ...productNames]
}

// Written-number → digit normalization. Library entries typically
// store digit form ("3 eggs"); voice transcripts often produce
// written form ("three eggs"). Without normalization, segmented
// queries would still miss the library matches they should hit.
// Coverage: 1-12 captures all observed cases in Luke's transcripts.
const WRITTEN_NUMBER_TO_DIGIT: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
}

function normalizeWrittenNumbers(s: string): string {
  return s.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi,
    (m) => WRITTEN_NUMBER_TO_DIGIT[m.toLowerCase()] ?? m,
  )
}

// Filler tokens stripped from segments before library search. Without
// this, "a handful of blueberries" scores ~0.48 against saved meal
// "Blueberries" because 3 of 4 query tokens are non-substantive filler.
// After strip → "blueberries" → exact 1.0 match.
//
// Conservative list: articles, common quantifiers, weight/volume units.
// Does NOT include preparation modifiers ("scrambled", "fried") — those
// may be part of saved meal names (e.g. "scrambled eggs").
const FILLER_TOKENS = new Set([
  // Articles
  'a',
  'an',
  'the',
  // Generic single-serving count. Multi-count entries like "3 eggs" are
  // intentionally preserved because Luke has saved meals named that way.
  '1',
  // Conjunctions left over after splitter doesn't catch edge-position
  // ones (e.g., "...comma comma and stevia" splits on the leading
  // comma, leaving "and stevia" as the next segment with leading "and")
  'and',
  'or',
  // Quantifiers
  'of',
  'from',
  'some',
  'few',
  'several',
  'handful',
  'couple',
  'bunch',
  'pair',
  // Weight/volume units (library matches the food NAME; quantity is handled by qty/unit)
  'oz',
  'ounce',
  'ounces',
  'g',
  'gram',
  'grams',
  'kg',
  'lb',
  'lbs',
  'pound',
  'pounds',
  'ml',
  'l',
  'cup',
  'cups',
  'tbsp',
  'tablespoon',
  'tablespoons',
  'tsp',
  'teaspoon',
  'teaspoons',
  // Container/portion units
  'scoop',
  'scoops',
  'serving',
  'servings',
  'slice',
  'slices',
  'piece',
  'pieces',
  'strip',
  'strips',
  'stick',
  'sticks',
])

const WEIGHT_OR_VOLUME_UNITS = new Set([
  'g',
  'gram',
  'grams',
  'kg',
  'lb',
  'lbs',
  'pound',
  'pounds',
  'oz',
  'ounce',
  'ounces',
  'ml',
  'l',
  'cup',
  'cups',
  'tbsp',
  'tablespoon',
  'tablespoons',
  'tsp',
  'teaspoon',
  'teaspoons',
])

const COUNT_UNIT_NORMALIZATION: Record<string, string> = {
  pieces: 'piece',
  servings: 'serving',
  slices: 'slice',
  scoops: 'scoop',
  strips: 'strip',
  sticks: 'stick',
}

const ACCOMPANIMENT_HOST_TOKENS = new Set([
  'chip',
  'chips',
  'churro',
  'churros',
  'fry',
  'fries',
  'nacho',
  'nachos',
  'pancake',
  'pancakes',
  'waffle',
  'waffles',
])

function shouldSplitAccompaniment(left: string, right: string): boolean {
  const leftTokens = left
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^\w]/g, ''))
    .filter(Boolean)
  const rightIdentityTokens = right
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^\w]/g, ''))
    .filter((token) => token.length > 0 && !FILLER_TOKENS.has(token))

  return (
    leftTokens.some((token) => ACCOMPANIMENT_HOST_TOKENS.has(token)) &&
    rightIdentityTokens.length > 0
  )
}

function expandAccompanimentSegments(segment: string): string[] {
  const match = /^(.*?)\s+with\s+(.+)$/i.exec(segment)
  if (!match) return [segment]

  const left = match[1].trim()
  const right = match[2].trim()
  if (!left || !right || !shouldSplitAccompaniment(left, right)) return [segment]

  return [left, right]
}

function stripFillerTokens(segment: string): string {
  return segment
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => {
      const cleaned = t.replace(/[^\w]/g, '')
      return cleaned.length > 0 && !FILLER_TOKENS.has(cleaned)
    })
    .join(' ')
    .trim()
}

function parseWrittenLeadingNumber(token: string): number | null {
  const digit = WRITTEN_NUMBER_TO_DIGIT[token.toLowerCase()]
  return digit ? Number(digit) : null
}

function parseLeadingQuantity(segment: string): { qty: number; unit: string } | null {
  const trimmed = segment.trim()
  const mixedFraction = /^(\d+)\s+(\d+)\/(\d+)\b\s*(.*)$/i.exec(trimmed)
  if (mixedFraction) {
    const whole = Number(mixedFraction[1])
    const num = Number(mixedFraction[2])
    const den = Number(mixedFraction[3])
    if (den > 0) {
      return normalizeSegmentQuantityUnit(whole + num / den, mixedFraction[4])
    }
  }

  const fraction = /^(\d+)\/(\d+)\b\s*(.*)$/i.exec(trimmed)
  if (fraction) {
    const num = Number(fraction[1])
    const den = Number(fraction[2])
    if (den > 0) return normalizeSegmentQuantityUnit(num / den, fraction[3])
  }

  const numeric = /^(\d+(?:\.\d+)?)\b\s*(.*)$/i.exec(trimmed)
  if (numeric) {
    return normalizeSegmentQuantityUnit(Number(numeric[1]), numeric[2])
  }

  const word = /^([a-z]+)\b\s*(.*)$/i.exec(trimmed)
  if (word) {
    const qty = parseWrittenLeadingNumber(word[1])
    if (qty !== null) return normalizeSegmentQuantityUnit(qty, word[2])
  }

  return null
}

function parseLeadingWeightQuantity(segment: string): { qty: number; unit: string; grams: number } | null {
  const cleaned = segment.trim().replace(/^(?:and|plus|with)\s+/i, '')
  const match = /^(\d+(?:\.\d+)?)\s*(g|grams?|oz|ounces?|lb|lbs|pounds?)\b/i.exec(cleaned)
  if (!match) return null
  const qty = Number(match[1])
  if (!Number.isFinite(qty) || qty <= 0) return null

  const unitToken = match[2].toLowerCase()
  if (unitToken === 'g' || unitToken.startsWith('gram')) return { qty, unit: 'grams', grams: qty }
  if (unitToken === 'oz' || unitToken.startsWith('ounce')) {
    return { qty, unit: qty === 1 ? 'ounce' : 'ounces', grams: qty * 28.3495 }
  }
  return { qty, unit: qty === 1 ? 'pound' : 'pounds', grams: qty * 453.592 }
}

function servingGramsFromCandidate(candidate: LibrarySearchResult): number | null {
  for (const component of candidate.components) {
    const match = /^(\d+(?:\.\d+)?)\s*(?:g|grams?)$/i.exec(component.unit.trim())
    if (match) {
      const grams = Number(match[1])
      if (Number.isFinite(grams) && grams > 0) return grams
    }
  }

  const servingAlt = candidate.unit_alternatives?.find((alt) => {
    const unit = alt.unit.toLowerCase()
    return unit === 'serving' || unit === 'portion'
  })
  if (servingAlt && Number.isFinite(servingAlt.grams) && servingAlt.grams > 0) return servingAlt.grams

  return null
}

function normalizeSegmentQuantityUnit(
  qty: number,
  rawUnit: string,
): { qty: number; unit: string } | null {
  if (!Number.isFinite(qty) || qty <= 0 || qty === 1) return null

  const cleaned = rawUnit
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\bof\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return { qty, unit: 'serving' }

  const [firstToken] = cleaned.split(' ')
  if (WEIGHT_OR_VOLUME_UNITS.has(firstToken)) return null

  const normalizedFirst = COUNT_UNIT_NORMALIZATION[firstToken] ?? firstToken
  if (firstToken !== normalizedFirst) return { qty, unit: normalizedFirst }

  // Fractional count phrases like "1/4 medium avocado" are not weight
  // units; preserve the visible unit phrase so the Plate reads naturally.
  return { qty, unit: cleaned }
}

function scaleTotal(total: LibraryTotal, qty: number): LibraryTotal {
  return {
    kcal: Math.round(total.kcal * qty),
    protein_g: Math.round(total.protein_g * qty * 10) / 10,
    carbs_g: Math.round(total.carbs_g * qty * 10) / 10,
    fat_g: Math.round(total.fat_g * qty * 10) / 10,
  }
}

function quantityAlreadyBakedIntoLibraryName(
  candidate: LibrarySearchResult,
  qty: number,
): boolean {
  if (candidate.source !== 'saved_meal') return false
  if (!Number.isInteger(qty)) return false
  const normalizedName = normalizeShortcutText(candidate.name)
  const written = Object.entries(WRITTEN_NUMBER_TO_DIGIT).find(
    ([, digit]) => Number(digit) === qty,
  )?.[0]
  return (
    normalizedName.startsWith(`${qty} `) ||
    (written ? normalizedName.startsWith(`${written} `) : false)
  )
}

export function relaxedSegmentQuery(segment: string): string {
  return segment
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => {
      const cleaned = t.replace(/[^\w]/g, '')
      if (cleaned.length === 0) return false
      if (/^\d+$/.test(cleaned)) return false
      if (cleaned === 'with' || cleaned === 'on' || cleaned === 'rocks') return false
      return !FILLER_TOKENS.has(cleaned)
    })
    .join(' ')
    .trim()
}

// Op FASTRAK Alpha.4.1 — segmenter now emits stripped+original pairs.
//
// Pre-Alpha.4.1 segmentTranscript returned only the stripped form, which
// was correct for library matching (filler tokens like "a", "of", "ounce"
// add noise to similarity scoring). Alpha.4 then reused the stripped
// form as the LLM input for partial-resolve sub-transcripts — but the
// LLM needs natural-language fragments, not filler-stripped tokens. The
// replay script (Alpha.8) caught a real regression on "Double espresso,
// with half an ounce of half and half, …" where the unresolved fragment
// "with half an ounce of half and half" got stripped down to "with half
// half half" before reaching the LLM. The LLM couldn't make sense of
// that and returned no parseable JSON.
//
// Fix: track BOTH forms.
//   - stripped: filler-removed, used for library similarity scoring.
//   - original: composite-allowlist-restored + trimmed, used for LLM
//               input + telemetry display.
//
// The "original" form preserves natural English exactly as the user said
// it (modulo composite allowlist restoration), without dropping fillers
// or normalizing written numbers. That's what the LLM tool-loop wants.
export interface TranscriptSegment {
  stripped: string
  original: string
}

export function segmentTranscript(
  transcript: string,
  runtimeCompositeNames: string[] = [],
): TranscriptSegment[] {
  let work = transcript

  // 1. Protect composite items from " and " split. M.3 extends the
  // static allowlist with runtime user library names so compound foods
  // like "Bacon Egg & Cheese Biscuit" survive segmentation.
  const protectedSubs: string[] = []
  for (const composite of buildCompositeProtectionPhrases(runtimeCompositeNames)) {
    const re = compositePhraseRegex(composite)
    if (!re) continue
    work = work.replace(re, (match) => {
      protectedSubs.push(match)
      return COMPOSITE_PLACEHOLDER(protectedSubs.length - 1)
    })
  }

  // 2. Split on sentence boundaries (period + whitespace + capital letter)
  const sentenceParts = work.split(/\.\s+(?=[A-Z])/)

  // 3. Within each sentence, split on ", " or " and " (whitespace-bounded,
  //    case-insensitive on " and "). Skip " with ", " then ", " plus ", and
  //    bare comma per Brick D delimiter set.
  const allSegments: TranscriptSegment[] = []
  for (const sentence of sentenceParts) {
    const parts = sentence.split(/(?:,\s+|\s+and\s+)/i)
    for (let p of parts) {
      // 4. Restore composite placeholders
      for (let i = 0; i < protectedSubs.length; i++) {
        p = p.replace(COMPOSITE_PLACEHOLDER(i), protectedSubs[i])
      }
      // 5. Trim trailing periods + whitespace, drop empty
      p = p.replace(/\.\s*$/, '').trim()
      if (p.length === 0) continue
      for (const expanded of expandAccompanimentSegments(p)) {
        // 5a. Capture the natural-language form RIGHT HERE — after composite
        //     restore + trim + conservative accompaniment split, BEFORE number
        //     normalization or filler stripping. This is what the LLM wants to
        //     see for partial-resolve.
        const original = expanded
        // 6. Apply written-number → digit normalization (matching-side only)
        const numbersNormalized = normalizeWrittenNumbers(expanded)
        // 7. Strip filler tokens (matching-side only). Library matching
        //    scores against the substantive food name; LLM input doesn't
        //    need this aggressive cleanup.
        const stripped = stripFillerTokens(numbersNormalized)
        if (stripped.length === 0) continue
        allSegments.push({ stripped, original })
      }
    }
  }

  return allSegments
}

function isStandaloneDextroseModifier(segment: TranscriptSegment): boolean {
  const normalized = normalizeShortcutText(segment.original)
  return (
    /\bdextrose\b/.test(normalized) &&
    /^(?:with\s+)?(?:no|without|half|full|one|1)(?:\s+(?:a\s+)?serving)?(?:\s+of)?(?:\s+nutricost)?\s+dextrose$/.test(normalized)
  )
}

function mergeProteinShakeDextroseSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  const merged: TranscriptSegment[] = []
  for (let i = 0; i < segments.length; i++) {
    const current = segments[i]
    const next = segments[i + 1]
    if (hasProteinShakeText(current.original) && next && isStandaloneDextroseModifier(next)) {
      merged.push({
        original: `${current.original}, ${next.original}`,
        stripped: `${current.stripped} ${next.stripped}`.trim(),
      })
      i += 1
      continue
    }
    merged.push(current)
  }
  return merged
}

// Op FASTRAK Alpha.4 — mixed-resolution segmented shortcut.
//
// Pre-Alpha.4 this helper required ALL segments to clear the single-hit
// gate; ANY non-library segment killed the fast path for the entire
// utterance. With a 3-entry library (post junk-cleanup), virtually no
// multi-item meal could clear the all-or-nothing bar — so multi-item
// parses paid full LLM cost on every item, even ones the library could
// resolve in ~200ms.
//
// New shape: per-segment classification into resolved + unresolved
// arrays. The route handler decides what to do:
//   - All resolved (unresolved.length === 0): assemble ParsedMealResponse
//     directly from `resolved`, return ~200ms (the pre-Alpha.4 happy
//     path, no regression).
//   - Partial (resolved.length > 0 && unresolved.length > 0): run LLM
//     pipeline on unresolved subset only, merge by position.
//   - Zero resolved: helper returns null (caller falls through to the
//     existing 4g/Sonnet path unchanged — no overhead added).

export interface ResolvedSegment {
  food: FoodItem
  segment: string           // stripped form (used for library matching)
  original_segment: string  // natural-language form (post-Alpha.4.1: telemetry display + LLM input on partial cases)
  position: number
  score: number
}

export interface UnresolvedSegment {
  segment: string           // stripped form (kept for telemetry parity with ResolvedSegment)
  original_segment: string  // natural-language form — what the route's partial-resolve hands to the LLM
  position: number
}

export interface LibrarySegmentedShortcutResult {
  resolved: ResolvedSegment[]
  unresolved: UnresolvedSegment[]
  segment_count: number
}

export async function tryLibrarySegmentedShortcut(
  supabase: SupabaseClient,
  userId: string,
  transcript: string,
): Promise<LibrarySegmentedShortcutResult | null> {
  const staticSegments = mergeProteinShakeDextroseSegments(segmentTranscript(transcript))
  // Single-segment utterances are 4f's job; this helper is for
  // multi-item only. Return null so the route's existing 4g/Sonnet
  // path takes over without double work.
  if (staticSegments.length < 2) return null

  const runtimeCompositeNames = await loadRuntimeCompositeNames(supabase, userId)
  const segments = runtimeCompositeNames.length > 0
    ? mergeProteinShakeDextroseSegments(segmentTranscript(transcript, runtimeCompositeNames))
    : staticSegments
  if (segments.length < 2) return null

  // Search each segment in parallel using the STRIPPED form (which is
  // what the library similarity scorer expects — filler-removed,
  // written-numbers-normalized).
  const segmentResults = await Promise.all(
    segments.map(async (seg) => {
      if (isIsopureShakeIngredientShortcutTranscript(seg.original)) {
        const shake = await resolveProteinShakeIngredientShortcut(supabase, userId, seg.original)
        if (shake?.hit) {
          return {
            proteinShake: shake,
            results: [],
          }
        }
      }

      const primary = await searchUserLibrary({ query: seg.stripped, limit: 2 }, { userId, supabase })
      const relaxed = relaxedSegmentQuery(seg.stripped)
      if (!relaxed || relaxed === seg.stripped) return { proteinShake: null, results: primary.results }

      const top = primary.results[0]
      const second = primary.results[1]
      const primaryClears =
        top &&
        top.match_confidence.score >= SEGMENT_SHORTCUT_SCORE_THRESHOLD &&
        top.match_confidence.score - (second?.match_confidence.score ?? 0) >= SEGMENT_SHORTCUT_GAP_THRESHOLD
      if (primaryClears) return { proteinShake: null, results: primary.results }

      const relaxedResults = await searchUserLibrary({ query: relaxed, limit: 2 }, { userId, supabase })
      return { proteinShake: null, results: relaxedResults.results }
    }),
  )

  // Per-segment classification. Same threshold gates as the pre-Alpha.4
  // all-or-nothing path (score >= 0.85, gap >= 0.15). Failures land in
  // `unresolved` with their original position so the route can preserve
  // user-perceived order during merge. Both stripped + original forms
  // propagate (Alpha.4.1) so the route's partial-resolve LLM input gets
  // the natural-language fragment, not the filler-stripped one.
  const resolved: ResolvedSegment[] = []
  const unresolved: UnresolvedSegment[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const proteinShake = segmentResults[i].proteinShake
    if (proteinShake?.hit) {
      for (let ingredientIndex = 0; ingredientIndex < proteinShake.response.foods.length; ingredientIndex++) {
        resolved.push({
          food: proteinShake.response.foods[ingredientIndex],
          segment: seg.stripped,
          original_segment: seg.original,
          position: i + ingredientIndex / 100,
          score: 1,
        })
      }
      continue
    }

    const r = segmentResults[i].results

    if (r.length === 0) {
      unresolved.push({ segment: seg.stripped, original_segment: seg.original, position: i })
      continue
    }
    const top = r[0]
    const second = r[1]
    const topScore = top.match_confidence.score
    const secondScore = second?.match_confidence.score ?? 0
    if (topScore < SEGMENT_SHORTCUT_SCORE_THRESHOLD) {
      unresolved.push({ segment: seg.stripped, original_segment: seg.original, position: i })
      continue
    }
    if (second && topScore - secondScore < SEGMENT_SHORTCUT_GAP_THRESHOLD) {
      unresolved.push({ segment: seg.stripped, original_segment: seg.original, position: i })
      continue
    }

    const parsedWeightQuantity = parseLeadingWeightQuantity(seg.original)
    const servingGrams = parsedWeightQuantity ? servingGramsFromCandidate(top) : null
    const parsedQuantity = parseLeadingQuantity(seg.original)
    const quantity =
      parsedWeightQuantity && servingGrams
        ? {
            qty: parsedWeightQuantity.qty,
            unit: parsedWeightQuantity.unit,
            scale: parsedWeightQuantity.grams / servingGrams,
          }
        : parsedQuantity && !quantityAlreadyBakedIntoLibraryName(top, parsedQuantity.qty)
          ? { ...parsedQuantity, scale: parsedQuantity.qty }
          : null
    const total = quantity ? scaleTotal(top.total, quantity.scale) : top.total

    resolved.push({
      food: {
        name: top.name,
        qty: quantity?.qty ?? 1,
        unit: quantity?.unit ?? 'serving',
        calories: total.kcal,
        protein_g: total.protein_g,
        carbs_g: total.carbs_g,
        fat_g: total.fat_g,
        source: 'library',
        source_ref: normalizeFoodSourceRef(top.source_ref ?? top.library_id),
        unit_alternatives: top.unit_alternatives,
        match_confidence: {
          score: topScore,
          label: top.match_confidence.label,
          warnings: [],
        },
        notes: null,
      },
      segment: seg.stripped,
      original_segment: seg.original,
      position: i,
      score: topScore,
    })
  }

  // Zero resolved → caller falls through to 4g/Sonnet unchanged. We
  // signal this with null instead of a structurally-empty object so the
  // existing route logic doesn't need a special "0 resolved" branch.
  if (resolved.length === 0) return null

  return {
    resolved,
    unresolved,
    segment_count: segments.length,
  }
}
