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
} from '@/types/database'

import { searchUserLibrary } from './tools/search-user-library'

// Threshold tuning per V15: starting values, refine based on real
// usage telemetry. Score gate alone is insufficient — gap gate
// prevents shortcut firing on ambiguous-brand cases (multiple
// close library matches, e.g. several Yasso flavors).
const SHORTCUT_SCORE_THRESHOLD = 0.85
const SHORTCUT_GAP_THRESHOLD = 0.15

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
    source_ref: top.library_id,
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
    source_ref: top.library_id,
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
    source_ref: r.library_id,
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
  // Conjunctions left over after splitter doesn't catch edge-position
  // ones (e.g., "...comma comma and stevia" splits on the leading
  // comma, leaving "and stevia" as the next segment with leading "and")
  'and',
  'or',
  // Quantifiers
  'of',
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

export function segmentTranscript(transcript: string): string[] {
  let work = transcript

  // 1. Protect composite items from " and " split
  const protectedSubs: string[] = []
  for (const composite of COMPOSITE_ALLOWLIST) {
    const re = new RegExp(composite.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    work = work.replace(re, () => {
      protectedSubs.push(composite)
      return COMPOSITE_PLACEHOLDER(protectedSubs.length - 1)
    })
  }

  // 2. Split on sentence boundaries (period + whitespace + capital letter)
  const sentenceParts = work.split(/\.\s+(?=[A-Z])/)

  // 3. Within each sentence, split on ", " or " and " (whitespace-bounded,
  //    case-insensitive on " and "). Skip " with ", " then ", " plus ", and
  //    bare comma per Brick D delimiter set.
  const allSegments: string[] = []
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
      // 6. Apply written-number → digit normalization
      const numbersNormalized = normalizeWrittenNumbers(p)
      // 7. Strip filler tokens (articles, quantifiers, units) so library
      //    matching scores against the substantive food name only.
      const stripped = stripFillerTokens(numbersNormalized)
      if (stripped.length === 0) continue
      allSegments.push(stripped)
    }
  }

  return allSegments
}

export interface LibrarySegmentedShortcutResult {
  response: ParsedMealResponse
  hit: boolean
  segment_count?: number
  segment_scores?: number[]
}

export async function tryLibrarySegmentedShortcut(
  supabase: SupabaseClient,
  userId: string,
  transcript: string,
): Promise<LibrarySegmentedShortcutResult | null> {
  const segments = segmentTranscript(transcript)
  // Single-segment utterances are 4f's job; this helper is for
  // multi-item only. Return null so the route's existing 4g/Sonnet
  // path takes over without double work.
  if (segments.length < 2) return null

  // Search each segment in parallel.
  const segmentResults = await Promise.all(
    segments.map((seg) =>
      searchUserLibrary({ query: seg, limit: 2 }, { userId, supabase }),
    ),
  )

  // ALL segments must hit single high-confidence library entries
  // (same gates as 4f single-hit). Any miss → return null and let
  // the existing 4g + Sonnet path proceed unchanged.
  const foods: FoodItem[] = []
  const segmentScores: number[] = []
  let totalCal = 0
  let totalProt = 0
  let totalCarbs = 0
  let totalFat = 0

  for (let i = 0; i < segments.length; i++) {
    const r = segmentResults[i].results
    if (r.length === 0) return null
    const top = r[0]
    const second = r[1]
    const topScore = top.match_confidence.score
    const secondScore = second?.match_confidence.score ?? 0
    if (topScore < SEGMENT_SHORTCUT_SCORE_THRESHOLD) return null
    if (second && topScore - secondScore < SEGMENT_SHORTCUT_GAP_THRESHOLD) return null

    segmentScores.push(topScore)
    foods.push({
      name: top.name,
      qty: 1,
      unit: 'serving',
      calories: top.total.kcal,
      protein_g: top.total.protein_g,
      carbs_g: top.total.carbs_g,
      fat_g: top.total.fat_g,
      source: 'library',
      source_ref: top.library_id,
      match_confidence: {
        score: topScore,
        label: top.match_confidence.label,
        warnings: [],
      },
      notes: null,
    })
    totalCal += top.total.kcal
    totalProt += top.total.protein_g
    totalCarbs += top.total.carbs_g
    totalFat += top.total.fat_g
  }

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
    segment_count: segments.length,
    segment_scores: segmentScores,
  }
}
