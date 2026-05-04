// search_user_library — looks up entries in the user's saved_meals table
// (filtered by user_id) AND the global products catalog. Phase 3 wiring
// against real Supabase.
//
// Per prototype semantics (V15 H2 mod #6): match_confidence = name_similarity
// only — library/product entries are pre-validated, so brand_match and
// macro_consistency penalties don't apply. times_logged stays as ranking
// metadata in output, NOT in the confidence score.
//
// Per V15 H0 Q6: saved_meals.total_* are per-batch totals; we divide by
// yield_servings before exposing to the LLM (with yield_servings + raw
// total_batch retained as metadata for completeness).

import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'

import { applyBrandAliases } from '@/lib/brand-voice-aliases'
import type { FoodItem } from '@/types/database'

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
  library_id: string                           // "lib:saved_meal:<uuid>" | "lib:product:<uuid>"
  source: 'saved_meal' | 'product'
  name: string
  aliases: string[]
  components: LibraryComponent[]
  total: LibraryTotal                          // per-serving (after yield_servings divide for saved_meals)
  yield_servings: number                       // 1 for products
  total_batch: LibraryTotal | null             // raw saved_meals totals (null for products)
  times_logged: number | null
  last_logged_at: string | null
  match_confidence: LibraryMatchConfidence
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
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(s: string | null | undefined): Set<string> {
  return new Set(normalize(s).split(' ').filter((t) => t.length > 0))
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
}

function savedMealToCandidate(row: SavedMealRow, score: number): LibrarySearchResult {
  const ys = row.yield_servings && row.yield_servings > 0 ? row.yield_servings : 1
  const totalBatch: LibraryTotal = {
    kcal: row.total_calories ?? 0,
    protein_g: Number(row.total_protein_g ?? 0),
    carbs_g: Number(row.total_carbs_g ?? 0),
    fat_g: Number(row.total_fat_g ?? 0),
  }
  // Per-serving (V15 H0 Q6)
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
  return {
    library_id: `lib:saved_meal:${row.id}`,
    source: 'saved_meal',
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
  return {
    library_id: `lib:product:${row.id}`,
    source: 'product',
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
        source_ref: `lib:product:${row.id}`,
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
  }
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

  // Fetch all rows (single-tenant; saved_meals is small per-user, products is
  // global but bounded). Score in TS via libraryNameSimilarity. Server-side
  // ilike pre-filter could be added later if row counts grow.
  const [mealsRes, productsRes] = await Promise.all([
    ctx.supabase
      .from('saved_meals')
      .select(
        'id, name, foods_json, total_calories, total_protein_g, total_carbs_g, total_fat_g, yield_servings, times_logged, last_logged_at, tags',
      )
      .eq('user_id', ctx.userId),
    ctx.supabase
      .from('products')
      .select(
        'id, name, brand, unit, serving_size_g, calories_per_serving, protein_g_per_serving, fat_g_per_serving, carbs_g_per_serving',
      ),
  ])

  if (mealsRes.error) {
    console.error('[search_user_library] saved_meals query failed:', mealsRes.error.message)
  }
  if (productsRes.error) {
    console.error('[search_user_library] products query failed:', productsRes.error.message)
  }

  const meals = (mealsRes.data ?? []) as SavedMealRow[]
  const products = (productsRes.data ?? []) as ProductRow[]

  const matches: LibrarySearchResult[] = []
  for (const m of meals) {
    const aliases = m.tags ?? []
    const score = libraryNameSimilarity(searchQuery, m.name ?? '', aliases)
    if (score < minScore) continue
    matches.push(savedMealToCandidate(m, score))
  }
  for (const p of products) {
    // S26 Step 4g — same brand-prefix-dedup logic as productToCandidate
    const displayName =
      p.brand && !p.name.toLowerCase().startsWith(p.brand.toLowerCase())
        ? `${p.brand} ${p.name}`
        : p.name
    const score = libraryNameSimilarity(searchQuery, displayName, [])
    if (score < minScore) continue
    matches.push(productToCandidate(p, score))
  }

  matches.sort((a, b) => b.match_confidence.score - a.match_confidence.score)
  return { results: matches.slice(0, limit) }
}

// ---------- Anthropic tool schema ----------

export const SEARCH_USER_LIBRARY_TOOL: Tool = {
  name: 'search_user_library',
  description:
    "Search the user's personal food library for previously-logged or " +
    'explicitly-saved entries (saved meals + product catalog). Library ' +
    'entries reflect the user\'s own validated macros and accept multiple ' +
    'aliases. Always call this BEFORE search_food_database for any food ' +
    'that might be a recurring meal. Returns up to N results with ' +
    'match_confidence based on name similarity to the query. The "total" ' +
    'field is per-serving; use it directly when scaling to user qty. ' +
    '"yield_servings" + "total_batch" are provided for transparency.',
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
