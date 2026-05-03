// S26 Step 4f — pipeline-level library shortcut.
//
// Sits between the response cache lookup and Sonnet synthesis.
// When the user transcript yields a single high-confidence library
// hit (score >= SHORTCUT_SCORE_THRESHOLD AND gap-to-second-place >=
// SHORTCUT_GAP_THRESHOLD), returns a one-food ParsedMealResponse
// built directly from the library row — bypassing Sonnet entirely.
//
// Frame (Step 4e vs Step 4f):
//   Step 4e: identical-transcript hash hit → ~100ms.
//   Step 4f: variant phrasing of a known library entry → ~200ms.
//
// On miss (no results, low score, or ambiguous gap), returns null
// so the route falls through to the existing Sonnet pipeline with
// no behavioral change.
//
// Shortcut hits do NOT write to the response cache — library lookup
// is already fast, no compounding gain. Sonnet path retains its
// own cache write.

import type { SupabaseClient } from '@supabase/supabase-js'

import type { FoodItem, ParsedMealResponse } from '@/types/database'

import { searchUserLibrary } from './tools/search-user-library'

// Threshold tuning per V15: starting values, refine based on real
// usage telemetry. Score gate alone is insufficient — gap gate
// prevents shortcut firing on ambiguous-brand cases (multiple
// close library matches, e.g. several Yasso flavors).
const SHORTCUT_SCORE_THRESHOLD = 0.85
const SHORTCUT_GAP_THRESHOLD = 0.15

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
