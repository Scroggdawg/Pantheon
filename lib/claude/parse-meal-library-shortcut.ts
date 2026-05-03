// S26 Step 4f — pipeline-level library shortcut (single-hit).
// S26 Step 4g — pipeline-level library candidates mode (multi-hit).
//
// Two complementary helpers in front of Sonnet synthesis:
//
//   tryLibraryShortcut: single high-confidence library hit
//     (score >= 0.85, gap >= 0.15 from second-place) → returns
//     a one-food ParsedMealResponse, ~200ms.
//
//   tryLibraryCandidates: 2+ library entries score >= 0.6 but
//     no single one clears the shortcut threshold → surfaces
//     the top 3 via the existing disambiguation UI, ~200ms,
//     ordered by recency-then-score-then-name.
//
// On miss either helper returns null so the route falls through
// to the next layer (candidates after shortcut, Sonnet after
// candidates) with no behavioral change.
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
