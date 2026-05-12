// search_user_library — looks up entries in the user's personal food
// library (saved_meals + products catalog) PLUS Op FASTRAK Alpha.6
// Sub-fix D addition: hourly_go_tos view as a silent matcher feed.
//
// Per prototype semantics (V15 H2 mod #6): match_confidence = name_similarity
// only — library/product entries are pre-validated, so brand_match and
// macro_consistency penalties don't apply. times_logged stays as ranking
// metadata in output, NOT in the confidence score.
//
// Per V15 H0 Q6: saved_meals.total_* are per-batch totals; we divide by
// yield_servings before exposing to the LLM (with yield_servings + raw
// total_batch retained as metadata for completeness).
//
// Op FASTRAK Alpha.6 Sub-fix D — tier sort with identity-priority dedup:
//   Tier 1: saved_meal + is_favorite=true (Favorites)
//   Tier 2: hourly_go_to (Hourly Go-Tos at current hour)
//   Tier 3: saved_meal + is_favorite=false / product
// Within tier: sort by match_confidence.score desc.
// Dedup key: source_ref if present, else "name:<lower(name)>". The same
// food appearing across multiple surfaces (e.g., a saved_meal that's also
// hourly-relevant) collapses to the durable canonical identity first, then
// tier order decides display ranking. This keeps hourly_go_to useful as a
// recall signal without letting it outrank a product/saved_meal identity.
//
// Op FASTRAK Alpha.6 Sub-fix D.1 — recent_foods view dropped (migration
// 018). Gaussian falloff in hourly_go_tos never decays to true zero, so
// every food in food_log_entries history surfaces in tier 2 at any
// target_hour with some non-zero weight. The recent (tier 3) branch was
// unreachable. Tier numbering compacted (no tier-3 source).

import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'

import { applyBrandAliases } from '@/lib/brand-voice-aliases'
import type { FoodItem, UnitAlternative } from '@/types/database'

import { confidenceLabel, type ConfidenceLabel } from './constants'

// ---------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------

export interface LibraryComponent {
  name: string
  qty: number
  unit: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  source_ref: string
}

export interface LibraryTotal {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface LibraryMatchConfidence {
  score: number
  label: ConfidenceLabel
  components: { name_similarity: number }
  formula: string
}

export interface LibrarySearchResult {
  library_id: string                           // "lib:saved_meal:<uuid>" | "lib:product:<uuid>" | "lib:hourly_go_to:<key>"
  source: 'saved_meal' | 'product' | 'hourly_go_to'
  is_favorite: boolean                         // Op FASTRAK Alpha.6: only meaningful for saved_meal source; always false for product/hourly_go_to
  source_ref: string | null                    // Op FASTRAK Alpha.6: canonical identity for tier-merge dedup
  name: string
  aliases: string[]
  components: LibraryComponent[]
  total: LibraryTotal                          // per-serving (after yield_servings divide for saved_meals)
  yield_servings: number                       // 1 for products, hourly_go_tos
  total_batch: LibraryTotal | null             // raw saved_meals totals (null for products/hourly_go_tos)
  times_logged: number | null
  last_logged_at: string | null
  match_confidence: LibraryMatchConfidence
  // Op FASTRAK Brick Gamma A — unit conversion data populated from
  // products.unit_alternatives (canonical) or saved_meals.foods_json[0].
  // unit_alternatives (per-saved_meal overrides on single-food meals).
  unit_alternatives?: UnitAlternative[]
}

export interface SearchUserLibraryInput {
  query: string
  min_score?: number
  limit?: number
}

// Context passed by the pipeline (closed over by dispatcher).
// Required at call time; not part of the LLM-visible tool input.
export interface SearchUserLibraryCtx {
  userId: string
  supabase: SupabaseClient
}

// ---------------------------------------------------------------------
// Tokenization + scoring (port of prototype/_name_similarity)
// ---------------------------------------------------------------------

function normalize(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function singularizeToken(token: string): string {
  if (token.endsWith('ies') && token.length > 4) {
    return `${token.slice(0, -3)}y`
  }
  if (token.endsWith('es') && token.length > 3) {
    return token.slice(0, -2)
  }
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 3) {
    return token.slice(0, -1)
  }
  return token
}

function tokens(s: string | null | undefined): Set<string> {
  return new Set(
    normalize(s)
      .split(' ')
      .filter((t) => t.length > 0)
      .map(singularizeToken),
  )
}

function normalizedNameKey(name: string): string {
  return [...tokens(name)].join(' ')
}

const GENERIC_SINGLE_TOKEN_QUERIES = new Set([
  'coffee',
  'tea',
  'water',
  'orange',
  'lime',
])
const GENERIC_OVERMATCH_SCORE_CAP = 0.84

export function guardedLibraryNameSimilarity(
  query: string,
  name: string,
  aliases: string[] = [],
): number {
  const score = libraryNameSimilarity(query, name, aliases)
  if (score < GENERIC_OVERMATCH_SCORE_CAP) return score

  const queryTokens = [...tokens(query)]
  if (queryTokens.length !== 1) return score

  const queryToken = queryTokens[0]
  if (!GENERIC_SINGLE_TOKEN_QUERIES.has(queryToken)) return score

  const candidateTokens = tokens(name)
  const exactishNames = new Set([queryToken, `${queryToken}s`])
  if (candidateTokens.size <= 1 || exactishNames.has(normalize(name))) return score

  return Math.min(score, GENERIC_OVERMATCH_SCORE_CAP)
}

/**
 * Two-tier scoring (prototype V15 H2.5 D1a):
 *   Tier 1: substring containment — every meaningful query token (>=3 chars
 *           OR matches a candidate token) must appear somewhere in the
 *           candidate-string union → score 1.0.
 *   Tier 2: per-candidate Jaccard-flavored overlap (coverage-weighted) +
 *           partial-containment boost capped at 0.85.
 */
export function libraryNameSimilarity(query: string, name: string, aliases: string[] = []): number {
  const q = tokens(query)
  if (q.size === 0) return 0

  const candidates = [name, ...aliases]
  const haystack = candidates.map((c) => normalize(c)).join(' ')
  const haystackTokens = tokens(haystack)

  // Tier 1: substring containment
  let matched = 0
  for (const tok of q) {
    if (tok.length >= 3 && haystack.includes(tok)) matched += 1
    else if (haystackTokens.has(tok)) matched += 1
  }
  if (matched === q.size) return 1.0

  // Tier 2: per-candidate Jaccard-flavored overlap
  let best = 0
  for (const cand of candidates) {
    const c = tokens(cand)
    if (c.size === 0) continue
    let intersection = 0
    for (const t of q) if (c.has(t)) intersection += 1
    const coverage = intersection / q.size
    const precision = intersection / Math.max(c.size, 1)
    const score = 0.7 * coverage + 0.3 * precision
    if (score > best) best = score
  }
  // Partial-containment boost
  const partialRatio = q.size > 0 ? matched / q.size : 0
  if (partialRatio > best) best = partialRatio * 0.85
  return Math.round(best * 1000) / 1000
}

// ---------------------------------------------------------------------
// Row → LibrarySearchResult mappers
// ---------------------------------------------------------------------

interface SavedMealRow {
  id: string
  name: string | null
  foods_json: FoodItem[] | null
  total_calories: number | null
  total_protein_g: number | null
  total_carbs_g: number | null
  total_fat_g: number | null
  yield_servings: number | null
  times_logged: number | null
  last_logged_at: string | null
  tags: string[] | null
  is_favorite: boolean | null
}

interface ProductRow {
  id: string
  name: string
  brand: string | null
  unit: string
  serving_size_g: number | null
  calories_per_serving: number
  protein_g_per_serving: number
  fat_g_per_serving: number
  carbs_g_per_serving: number
  unit_alternatives: UnitAlternative[] | null
}

interface HourlyGoToRow {
  user_id: string
  target_hour: number
  dedup_name: string
  dedup_source_ref: string
  name: string
  source_ref: string | null
  weight: number
  total_logs: number
  last_logged_at: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  qty: number | null
  unit: string | null
}

// Single-food saved_meals (created by Sub-fix C.1 heart-INSERTs) carry
// per-saved_meal unit_alternatives inside foods_json[0]. Multi-food
// saved_meals (recipes from select-mode) don't have a unique unit
// shape — the matcher returns "1 serving" totals and the unit picker
// would be the recipe-batch yield_servings UI (Brick L COOKBOOK), not
// the per-food Delta picker.
function unitAlternativesFromSavedMeal(
  foods: FoodItem[] | null,
): UnitAlternative[] | undefined {
  if (!Array.isArray(foods) || foods.length !== 1) return undefined
  return foods[0]?.unit_alternatives
}

function savedMealToCandidate(row: SavedMealRow, score: number): LibrarySearchResult {
  const ys = row.yield_servings && row.yield_servings > 0 ? row.yield_servings : 1
  const totalBatch: LibraryTotal = {
    kcal: row.total_calories ?? 0,
    protein_g: Number(row.total_protein_g ?? 0),
    carbs_g: Number(row.total_carbs_g ?? 0),
    fat_g: Number(row.total_fat_g ?? 0),
  }
  const perServing: LibraryTotal = {
    kcal: Math.round((totalBatch.kcal / ys) * 100) / 100,
    protein_g: Math.round((totalBatch.protein_g / ys) * 100) / 100,
    carbs_g: Math.round((totalBatch.carbs_g / ys) * 100) / 100,
    fat_g: Math.round((totalBatch.fat_g / ys) * 100) / 100,
  }
  const components: LibraryComponent[] = (row.foods_json ?? []).map((f) => ({
    name: f.name,
    qty: f.qty,
    unit: f.unit,
    kcal: f.calories,
    protein_g: f.protein_g,
    carbs_g: f.carbs_g,
    fat_g: f.fat_g,
    source_ref: f.source_ref ?? 'unknown',
  }))
  const libraryId = `lib:saved_meal:${row.id}`
  return {
    library_id: libraryId,
    source: 'saved_meal',
    is_favorite: row.is_favorite === true,
    source_ref: libraryId,
    name: row.name ?? '',
    aliases: row.tags ?? [],
    components,
    total: perServing,
    yield_servings: ys,
    total_batch: totalBatch,
    times_logged: row.times_logged,
    last_logged_at: row.last_logged_at,
    match_confidence: {
      score,
      label: confidenceLabel(score),
      components: { name_similarity: score },
      formula: 'library entries are pre-validated; match_confidence = name_similarity only',
    },
    unit_alternatives: unitAlternativesFromSavedMeal(row.foods_json),
  }
}

function productToCandidate(row: ProductRow, score: number): LibrarySearchResult {
  const total: LibraryTotal = {
    kcal: row.calories_per_serving,
    protein_g: row.protein_g_per_serving,
    carbs_g: row.carbs_g_per_serving,
    fat_g: row.fat_g_per_serving,
  }
  // S26 Step 4g — only prepend brand when name doesn't already
  // start with it (e.g. "Yasso" + "Yasso Greek Yogurt Bar..." →
  // no duplicate prefix). Case-insensitive comparison.
  const displayName =
    row.brand && !row.name.toLowerCase().startsWith(row.brand.toLowerCase())
      ? `${row.brand} ${row.name}`
      : row.name
  const libraryId = `lib:product:${row.id}`
  return {
    library_id: libraryId,
    source: 'product',
    is_favorite: false,
    source_ref: libraryId,
    name: displayName,
    aliases: [],
    components: [
      {
        name: displayName,
        qty: 1,
        unit: row.unit,
        kcal: total.kcal,
        protein_g: total.protein_g,
        carbs_g: total.carbs_g,
        fat_g: total.fat_g,
        source_ref: libraryId,
      },
    ],
    total,
    yield_servings: 1,
    total_batch: null,
    times_logged: null,
    last_logged_at: null,
    match_confidence: {
      score,
      label: confidenceLabel(score),
      components: { name_similarity: score },
      formula: 'library entries are pre-validated; match_confidence = name_similarity only',
    },
    unit_alternatives: row.unit_alternatives ?? undefined,
  }
}

// Op FASTRAK Alpha.6 — view-row mapper for hourly_go_tos. Projects
// per-row macros from the latest log instance per (user_id, dedup_name,
// dedup_source_ref) group (migration 017). LibraryComponent + total
// derive from the view's projected fields directly.
function hourlyGoToCandidate(row: HourlyGoToRow, score: number): LibrarySearchResult {
  const total: LibraryTotal = {
    kcal: Number(row.calories ?? 0),
    protein_g: Number(row.protein_g ?? 0),
    carbs_g: Number(row.carbs_g ?? 0),
    fat_g: Number(row.fat_g ?? 0),
  }
  const sourceRefForComponent = row.source_ref ?? `lib:hourly_go_to:${row.dedup_name}`
  return {
    library_id: `lib:hourly_go_to:${row.dedup_name}|${row.dedup_source_ref}`,
    source: 'hourly_go_to',
    is_favorite: false,
    source_ref: row.source_ref,
    name: row.name,
    aliases: [],
    components: [
      {
        name: row.name,
        qty: Number(row.qty ?? 1),
        unit: row.unit ?? 'serving',
        kcal: total.kcal,
        protein_g: total.protein_g,
        carbs_g: total.carbs_g,
        fat_g: total.fat_g,
        source_ref: sourceRefForComponent,
      },
    ],
    total,
    yield_servings: 1,
    total_batch: null,
    times_logged: row.total_logs,
    last_logged_at: row.last_logged_at,
    match_confidence: {
      score,
      label: confidenceLabel(score),
      components: { name_similarity: score },
      formula: 'library entries are pre-validated; match_confidence = name_similarity only',
    },
  }
}

// ---------------------------------------------------------------------
// Identity-priority dedup + tier sort (Matcher Constitution)
// ---------------------------------------------------------------------

function tierFor(r: LibrarySearchResult): number {
  if (r.source === 'saved_meal' && r.is_favorite) return 1
  if (r.source === 'hourly_go_to') return 2
  return 3
}

function identityPriorityFor(r: LibrarySearchResult): number {
  if (r.source === 'saved_meal' && r.is_favorite) return 1
  if (r.source === 'saved_meal') return 2
  if (r.source === 'product') return 3
  return 4
}

function betterIdentityCandidate(
  next: LibrarySearchResult,
  existing: LibrarySearchResult,
): LibrarySearchResult {
  const nextPriority = identityPriorityFor(next)
  const existingPriority = identityPriorityFor(existing)
  if (nextPriority < existingPriority) return next
  if (
    nextPriority === existingPriority &&
    next.match_confidence.score > existing.match_confidence.score
  ) {
    return next
  }
  return existing
}

function dedupKeyFor(r: LibrarySearchResult): string {
  if (r.source_ref && r.source_ref.length > 0) {
    // M.1 cascade-dedup (Brick Beta-1) — strip ratcheting
    // "lib:hourly_go_to:NAME|" prefixes before using as dedup key.
    // Belt-and-suspenders for any chained source_refs that escape the
    // write-time normalization in parse-meal-library-shortcut.ts (e.g.,
    // pre-migration-020 legacy data, or future regressions). Without
    // this, a saved_meal candidate with source_ref="lib:saved_meal:X"
    // and an hourly_go_to candidate whose underlying source_ref is the
    // same lib:saved_meal:X but wrapped in a chain wouldn't dedup,
    // killing the gap-gate at the matcher.
    const stripped = r.source_ref.replace(/^(lib:hourly_go_to:[^|]+\|)+/, '')
    return stripped.length > 0 ? stripped : r.source_ref
  }
  return `name:${r.name.toLowerCase().trim()}`
}

export function dedupeAndSortLibraryResults(matches: LibrarySearchResult[]): LibrarySearchResult[] {
  // Matcher Constitution invariant: canonical identities beat temporary
  // observations. The passes below preserve hourly_go_to as a recall
  // signal while preventing it from surviving beside a matching product
  // or saved_meal identity.
  const grouped = new Map<string, LibrarySearchResult>()
  for (const r of matches) {
    const key = dedupKeyFor(r)
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, r)
      continue
    }
    grouped.set(key, betterIdentityCandidate(r, existing))
  }

  // M.2 — NULL-ref name-cascade dedup (Brick Beta-1.5).
  //
  // Symptom (live-test post-M.1): banana / eggs - large / McDonald's BEC
  // still surfaced as candidates-mode (disambiguation: 1) because their
  // matching hourly_go_to entries carry NULL source_ref (legacy pre-Gamma-
  // A.2 logs). NULL refs fall through dedupKeyFor() to `name:NAME`, while
  // the canonical product/saved_meal carries `lib:product:UUID` /
  // `lib:saved_meal:UUID`. Pass 1 above can't collapse those — different
  // keys.
  //
  // Pass 2 collapses every `name:X` survivor into the canonical `lib:*`
  // survivor whose entry's name (case-insensitive, trimmed) equals X.
  // Canonical wins always — its source_ref is the durable identity. The
  // collapsed entry's tier/score boost is lost (acceptable: NULL-ref
  // entries are legacy stragglers; their tier-2 "recently logged" signal
  // is unreliable when the underlying source_ref is missing).
  //
  // When multiple canonical entries share a name (e.g., a product AND
  // a saved_meal both named "Banana"), the higher-identity canonical wins
  // the collapse target so NULL-hourlies fold into the strongest existing
  // surface. Distinct canonical entries with different names STAY distinct.
  // Same-name distinct canonicals resolve through identityPriorityFor()
  // until a richer product/saved_meal collision rule exists.
  const nameToCanonical = new Map<string, string>()
  for (const [key, r] of grouped) {
    if (key.startsWith('name:')) continue
    const nameKey = `name:${r.name.toLowerCase().trim()}`
    const existing = nameToCanonical.get(nameKey)
    if (!existing) {
      nameToCanonical.set(nameKey, key)
      continue
    }
    if (betterIdentityCandidate(r, grouped.get(existing)!) === r) {
      nameToCanonical.set(nameKey, key)
    }
  }
  for (const key of [...grouped.keys()]) {
    if (!key.startsWith('name:')) continue
    if (nameToCanonical.has(key)) {
      grouped.delete(key)
    }
  }

  // M.2b — extension of Pass 2 to collapse ANY hourly_go_to entry whose
  // name matches a canonical, not just NULL-ref ones. Catches the Class C
  // case where an hourly has a non-NULL non-chain source_ref (e.g.,
  // "usda:172069" for McDonald's BEC) but the name still matches a
  // saved_meal/product canonical. The hourly view is a "this was logged
  // at this hour" ranking signal, not a separate matcher entity — its
  // existence shouldn't suppress the canonical's gap-gate.
  //
  // Self-collapse guard: when an hourly_go_to candidate's key IS the
  // canonical for its name, `canonical === key` prevents dropping the
  // surviving entry.
  for (const [key, r] of [...grouped.entries()]) {
    if (r.source !== 'hourly_go_to') continue
    const nameKey = `name:${r.name.toLowerCase().trim()}`
    const canonical = nameToCanonical.get(nameKey)
    if (canonical && canonical !== key) {
      grouped.delete(key)
    }
  }

  // M.5 — singular/plural name-variant cascade.
  //
  // Class A live failure: "banana" produced separate high-confidence
  // hourly_go_to variants named "banana", "Banana", and "Bananas". Exact
  // name-cascade cannot collapse the plural form, leaving a 1.0/1.0
  // gap-gate failure in segmented shortcut. Keep this conservative: only
  // exact simple singular/plural normalized name keys collapse. Higher
  // identity priority wins; score breaks same-priority ties.
  const normalizedNameWinners = new Map<string, string>()
  for (const [key, r] of grouped) {
    const nameKey = normalizedNameKey(r.name)
    if (!nameKey) continue
    const existing = normalizedNameWinners.get(nameKey)
    if (!existing) {
      normalizedNameWinners.set(nameKey, key)
      continue
    }
    const existingRow = grouped.get(existing)!
    if (betterIdentityCandidate(r, existingRow) === r) {
      normalizedNameWinners.set(nameKey, key)
    }
  }
  for (const [key, r] of [...grouped.entries()]) {
    const winner = normalizedNameWinners.get(normalizedNameKey(r.name))
    if (winner && winner !== key) {
      grouped.delete(key)
    }
  }

  const deduped = [...grouped.values()]
  deduped.sort((a, b) => {
    const tierDiff = tierFor(a) - tierFor(b)
    if (tierDiff !== 0) return tierDiff
    return b.match_confidence.score - a.match_confidence.score
  })

  return deduped
}

// ---------------------------------------------------------------------
// Real Supabase implementation (Phase 3)
// ---------------------------------------------------------------------

export async function searchUserLibrary(
  input: SearchUserLibraryInput,
  ctx: SearchUserLibraryCtx,
): Promise<{ results: LibrarySearchResult[] }> {
  const minScore = input.min_score ?? 0.7
  const limit = Math.min(input.limit ?? 3, 10)

  // S26 Step 4i — apply BRAND_VOICE_ALIASES substitution before
  // scoring so voice-mangled brand queries ("yes so bar") resolve
  // to the canonical brand ("yasso bar") and score normally via
  // the existing token-based libraryNameSimilarity.
  const { substituted: searchQuery, aliasApplied } = applyBrandAliases(input.query)
  if (aliasApplied) {
    console.log(
      '[search_user_library] alias_applied:',
      aliasApplied,
      'original:',
      input.query,
      'substituted:',
      searchQuery,
    )
  }

  // Op FASTRAK Alpha.6 — current hour for hourly_go_tos query.
  // Uses Date.now() at request time; the route layer (parse-meal) is
  // the natural anchor for "what time is the user logging at." Replay
  // script can override this if stable measurement becomes a need.
  const currentHour = new Date().getUTCHours()

  // No row limit on hourly_go_tos: at single-tenant scale row counts
  // are bounded by O(unique foods per user) at one target_hour. Limiting
  // would clip low-weight rows that still pass min_score and break dedup
  // parity. Revisit if a user crosses ~5k unique food entries.
  const [mealsRes, productsRes, hourlyRes] = await Promise.all([
    ctx.supabase
      .from('saved_meals')
      .select(
        'id, name, foods_json, total_calories, total_protein_g, total_carbs_g, total_fat_g, yield_servings, times_logged, last_logged_at, tags, is_favorite',
      )
      .eq('user_id', ctx.userId),
    ctx.supabase
      .from('products')
      .select(
        'id, name, brand, unit, serving_size_g, calories_per_serving, protein_g_per_serving, fat_g_per_serving, carbs_g_per_serving, unit_alternatives',
      ),
    ctx.supabase
      .from('hourly_go_tos')
      .select(
        'user_id, target_hour, dedup_name, dedup_source_ref, name, source_ref, weight, total_logs, last_logged_at, calories, protein_g, carbs_g, fat_g, qty, unit',
      )
      .eq('user_id', ctx.userId)
      .eq('target_hour', currentHour),
  ])

  if (mealsRes.error) {
    console.error('[search_user_library] saved_meals query failed:', mealsRes.error.message)
  }
  if (productsRes.error) {
    console.error('[search_user_library] products query failed:', productsRes.error.message)
  }
  if (hourlyRes.error) {
    console.error('[search_user_library] hourly_go_tos query failed:', hourlyRes.error.message)
  }

  const meals = (mealsRes.data ?? []) as SavedMealRow[]
  const products = (productsRes.data ?? []) as ProductRow[]
  const hourlies = (hourlyRes.data ?? []) as HourlyGoToRow[]

  // Op FASTRAK Brick Gamma A.2 — cross-reference map for unit_alternatives.
  // When a hourly_go_to candidate's source_ref points back at a product
  // (lib:product:<uuid>), pull the unit_alternatives from that product so
  // the matcher's downstream FoodItem carries portion data even when the
  // hit came via the hourly path. Same pattern for saved_meal-
  // backed hourly entries — though saved_meals store unit_alternatives
  // inside foods_json[i], not as a separate column.
  const productAltsById = new Map<string, UnitAlternative[]>()
  for (const p of products) {
    if (Array.isArray(p.unit_alternatives) && p.unit_alternatives.length > 0) {
      productAltsById.set(p.id, p.unit_alternatives)
    }
  }
  const savedMealAltsById = new Map<string, UnitAlternative[]>()
  for (const m of meals) {
    const alts = unitAlternativesFromSavedMeal(m.foods_json)
    if (alts && alts.length > 0) savedMealAltsById.set(m.id, alts)
  }

  function altsForRef(ref: string | null | undefined): UnitAlternative[] | undefined {
    if (!ref) return undefined
    if (ref.startsWith('lib:product:')) {
      return productAltsById.get(ref.slice('lib:product:'.length))
    }
    if (ref.startsWith('lib:saved_meal:')) {
      return savedMealAltsById.get(ref.slice('lib:saved_meal:'.length))
    }
    return undefined
  }

  const matches: LibrarySearchResult[] = []
  for (const m of meals) {
    const aliases = m.tags ?? []
    const score = guardedLibraryNameSimilarity(searchQuery, m.name ?? '', aliases)
    if (score < minScore) continue
    matches.push(savedMealToCandidate(m, score))
  }
  for (const p of products) {
    const displayName =
      p.brand && !p.name.toLowerCase().startsWith(p.brand.toLowerCase())
        ? `${p.brand} ${p.name}`
        : p.name
    const score = guardedLibraryNameSimilarity(searchQuery, displayName, [])
    if (score < minScore) continue
    matches.push(productToCandidate(p, score))
  }
  for (const h of hourlies) {
    const score = guardedLibraryNameSimilarity(searchQuery, h.name, [])
    if (score < minScore) continue
    const candidate = hourlyGoToCandidate(h, score)
    // Backfill unit_alternatives from the product/saved_meal the hourly
    // entry's source_ref points at (when present).
    candidate.unit_alternatives = altsForRef(candidate.source_ref)
    matches.push(candidate)
  }

  const deduped = dedupeAndSortLibraryResults(matches)

  return { results: deduped.slice(0, limit) }
}

// ---------- Anthropic tool schema ----------

export const SEARCH_USER_LIBRARY_TOOL: Tool = {
  name: 'search_user_library',
  description:
    "Search the user's personal food library for previously-logged or " +
    'explicitly-saved entries. Returns matches across (in priority order): ' +
    "favorited saved meals, hourly-relevant logged foods at the user's " +
    'current hour, and the rest of saved meals + product catalog. Always ' +
    'call this BEFORE search_food_database for any food that might be a ' +
    'recurring meal. Returns up to N results with match_confidence based ' +
    'on name similarity to the query. The "total" field is per-serving; ' +
    'use it directly when scaling to user qty. "yield_servings" + ' +
    '"total_batch" are provided for transparency.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Phrase or name fragment to search. Matched against entry name + aliases. ' +
          'Issue 2-3 queries per food candidate covering different naming angles ' +
          '(meal name, ingredient name, brand-anchored phrase). Keep queries short (2-4 tokens).',
      },
      min_score: {
        type: 'number',
        default: 0.7,
        description:
          'Minimum match_confidence score. Library matches below this should generally be ignored.',
      },
      limit: {
        type: 'integer',
        default: 3,
        minimum: 1,
        maximum: 10,
      },
    },
    required: ['query'],
  },
}
