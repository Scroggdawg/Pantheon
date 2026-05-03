// S26 Step 4d Phase 1b — deterministic per-food classifier.
//
// Replaces the Sonnet synthesis loop. Given a single enumerated item plus
// the library + database search results for it, decides:
//   auto_commit  — top match clears score + gap + token-overlap gates
//   candidates   — multiple plausible matches; surface top 3 to user
//   unresolved   — no match; user must edit / quick-add
//
// Special cases handled before library/db classification:
//   * recited macros — user dictated package label values; short-circuit
//     to a synthetic auto_commit with source='user_recited'. Guarded by
//     shouldTrustRecitedMacros() — weight units (lb/oz/g/kg) trigger
//     unit-conversion arithmetic Haiku gets wrong, so we discard the
//     recited values and fall through to library/db lookup.
//   * target_calories — user said "a 500-calorie X". After classification,
//     scale the chosen food so kcal = target. Only applied on auto_commit
//     so user-picked candidates aren't surprise-scaled.
//
// Pure module: no I/O, no async. Tool calls happen upstream in the
// pipeline; this just classifies their outputs.
//
// All types and helpers exported for unit-test friendliness even though
// no harness exists yet (P1B.6 validation runs against fixtures via a
// /tmp probe, similar to P0.5/P0.6).

import type {
  DisambiguationCandidate,
  FoodItem,
  FoodItemSource,
  FoodItemState,
  MatchConfidence,
} from '@/types/database'
import { CONFIDENCE_HIGH_THRESHOLD } from '@/lib/claude/tools/constants'
import type { EnumeratedItem } from '@/lib/claude/tools/report-food-items'
import type { FoodSearchResult } from '@/lib/claude/tools/search-food-database'
import type { LibrarySearchResult } from '@/lib/claude/tools/search-user-library'

// ---------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------

// Minimum gap between top and runner-up scores for auto_commit. Below
// this gap, top is plausible but ambiguous → present candidates.
export const AUTO_COMMIT_SCORE_GAP = 0.1

// Minimum token-overlap between the user's enumerated label and the
// candidate's name. Catches the S4c "Quaker Protein Oats vs '1 cup
// oatmeal'" trap — high library similarity but the candidate isn't
// what the user said.
export const AUTO_COMMIT_TOKEN_OVERLAP_FLOOR = 0.6

// Stop tokens excluded from token-overlap (don't count "the" / "a"
// matching as meaningful overlap).
const STOP_TOKENS = new Set([
  'a',
  'an',
  'the',
  'of',
  'with',
  'and',
  'or',
  'in',
  'on',
])

// Weight units that trigger Haiku's unit-conversion arithmetic
// failures. P0.6 confirmed: "0.7 lbs of chicken, 4 oz serving size,
// 180 cal" → Haiku miscomputes 3.5–4.5 servings instead of 2.8.
// When qty unit is one of these AND the user recited macros, we
// discard the recited values and fall through to library/db lookup.
const WEIGHT_UNITS = new Set([
  'lb',
  'lbs',
  'pound',
  'pounds',
  'oz',
  'ounce',
  'ounces',
  'g',
  'gram',
  'grams',
  'kg',
  'kilogram',
  'kilograms',
])

// ---------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------

export interface ClassificationResult {
  state: FoodItemState
  food: FoodItem
  candidates: DisambiguationCandidate[]
  // Telemetry: true when the recited-macros short-circuit was bypassed
  // because qty unit was a weight unit (the safety net fired). Helps
  // measure how often this guard activates in production.
  recited_rejected_by_unit_guard?: boolean
}

// ---------------------------------------------------------------------
// Token-overlap helper
// ---------------------------------------------------------------------

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOP_TOKENS.has(t))
}

// Fraction of the user's label tokens that appear in the candidate's
// name. Asymmetric: |userTokens ∩ candTokens| / |userTokens|. So
// "oatmeal" vs "Quaker Protein Oats" → 0/1 = 0 (oatmeal not in oats).
// And "rice" vs "Cooked white rice" → 1/1 = 1.
export function computeTokenOverlap(userQuery: string, candidateName: string): number {
  const userTokens = tokenize(userQuery)
  if (userTokens.length === 0) return 0
  const candTokens = new Set(tokenize(candidateName))
  let hits = 0
  for (const t of userTokens) {
    if (candTokens.has(t)) hits += 1
  }
  return hits / userTokens.length
}

// ---------------------------------------------------------------------
// Recited-macros safety net
// ---------------------------------------------------------------------

// Returns true when the recited values can be trusted as-is. False when
// either: no recited values present, OR qty unit is a weight unit
// (Haiku's unit-conversion arithmetic is unreliable in single-call
// forced-tool-choice; see P0.6 case 5 / lb-conversion failure).
export function shouldTrustRecitedMacros(item: EnumeratedItem): boolean {
  if (item.recited_calories === undefined) return false
  const u = item.unit.toLowerCase().trim()
  if (WEIGHT_UNITS.has(u)) return false
  return true
}

// ---------------------------------------------------------------------
// Food builders
// ---------------------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Build a FoodItem from user-recited macros. recited_* values are
// already total-consumed (Haiku multiplied by servings per the
// ENUMERATION_SYSTEM_PROMPT instructions). source_ref is null
// because nothing in the library/db backed this.
export function foodFromRecitedMacros(item: EnumeratedItem): FoodItem {
  const matchConfidence: MatchConfidence = {
    score: 1,
    label: 'high',
    warnings: [],
  }
  return {
    name: item.label,
    qty: item.qty,
    unit: item.unit,
    calories: item.recited_calories!,
    protein_g: item.recited_protein_g ?? 0,
    carbs_g: item.recited_carbs_g ?? 0,
    fat_g: item.recited_fat_g ?? 0,
    source: 'user_recited',
    source_ref: null,
    match_confidence: matchConfidence,
    notes: null,
  }
}

// Build a FoodItem from a library hit. LibrarySearchResult.total is
// per-serving (kcal/protein_g/carbs_g/fat_g). Multiply by item.qty
// to scale to the user's consumed amount.
export function foodFromLibraryHit(hit: LibrarySearchResult, item: EnumeratedItem): FoodItem {
  const t = hit.total
  const q = item.qty
  return {
    name: hit.name,
    qty: item.qty,
    unit: item.unit,
    calories: round2(t.kcal * q),
    protein_g: round2(t.protein_g * q),
    carbs_g: round2(t.carbs_g * q),
    fat_g: round2(t.fat_g * q),
    source: 'library',
    source_ref: hit.library_id,
    match_confidence: {
      score: hit.match_confidence.score,
      label: hit.match_confidence.label,
      warnings: [],
    },
    notes: null,
  }
}

// Build a FoodItem from a database hit. Prefers per_user_serving
// (already scaled to user's quantity for weight/volume units); falls
// back to per_serving × qty for non-weight units like "cup"/"slice"
// where the search backend can't auto-convert.
export function foodFromDbHit(hit: FoodSearchResult, item: EnumeratedItem): FoodItem {
  const sourceRef = hit.id // already in "usda:<fdcId>" or "off:<upc>" form
  const isExactish = hit.match_confidence.score >= CONFIDENCE_HIGH_THRESHOLD
  const source: FoodItemSource = isExactish ? 'database_exact' : 'database_estimated'

  let calories = 0
  let protein = 0
  let carbs = 0
  let fat = 0

  if (hit.per_user_serving) {
    calories = hit.per_user_serving.kcal
    protein = hit.per_user_serving.protein_g
    carbs = hit.per_user_serving.carbs_g
    fat = hit.per_user_serving.fat_g
  } else {
    // Non-weight unit (cup, slice, container, ...) — backend can't
    // convert. Use per_serving × qty as the best estimate.
    const ps = hit.per_serving
    const q = item.qty
    calories = round2((ps.kcal ?? 0) * q)
    protein = round2((ps.protein_g ?? 0) * q)
    carbs = round2((ps.carbs_g ?? 0) * q)
    fat = round2((ps.fat_g ?? 0) * q)
  }

  return {
    name: hit.name,
    qty: item.qty,
    unit: item.unit,
    calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    source,
    source_ref: sourceRef,
    match_confidence: {
      score: hit.match_confidence.score,
      label: hit.match_confidence.label,
      warnings: [...hit.match_confidence.warnings],
    },
    notes: null,
  }
}

// Stub food for candidates / unresolved states. When a top candidate
// is provided, mirror its values so the user sees a reasonable
// estimate while the picker is open. When null (unresolved), emit
// zeros with source='quick_add' — the user must edit.
export function placeholderFood(
  item: EnumeratedItem,
  topCandidate: DisambiguationCandidate | null,
): FoodItem {
  if (!topCandidate) {
    return {
      name: item.label,
      qty: item.qty,
      unit: item.unit,
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      // 'llm_estimated' — system couldn't find a match. Native renders
      // this with the ~ glyph (estimated). 'quick_add' is reserved for
      // user-initiated entries with no LLM lookup involved.
      source: 'llm_estimated',
      source_ref: null,
      match_confidence: { score: 0, label: 'low', warnings: ['no_candidates_found'] },
      notes: null,
    }
  }
  // Top candidate is per_serving; scale to qty.
  const q = item.qty
  const p = topCandidate.per_serving
  return {
    name: topCandidate.name,
    qty: item.qty,
    unit: item.unit,
    calories: round2(p.calories * q),
    protein_g: round2(p.protein_g * q),
    carbs_g: round2(p.carbs_g * q),
    fat_g: round2(p.fat_g * q),
    source: topCandidate.source,
    source_ref: topCandidate.source_ref,
    match_confidence: {
      score: topCandidate.match_confidence.score,
      label: topCandidate.match_confidence.label,
      warnings: [...topCandidate.match_confidence.warnings],
    },
    notes: null,
  }
}

// ---------------------------------------------------------------------
// Candidate merger
// ---------------------------------------------------------------------

function libraryHitToCandidate(hit: LibrarySearchResult): DisambiguationCandidate {
  const t = hit.total // per-serving
  return {
    name: hit.name,
    source: 'library',
    source_ref: hit.library_id,
    per_serving: {
      calories: t.kcal,
      protein_g: t.protein_g,
      carbs_g: t.carbs_g,
      fat_g: t.fat_g,
    },
    match_confidence: {
      score: hit.match_confidence.score,
      label: hit.match_confidence.label,
      warnings: [],
    },
  }
}

function dbHitToCandidate(hit: FoodSearchResult): DisambiguationCandidate {
  const ps = hit.per_serving
  const isExactish = hit.match_confidence.score >= CONFIDENCE_HIGH_THRESHOLD
  const source: FoodItemSource = isExactish ? 'database_exact' : 'database_estimated'
  return {
    name: hit.name,
    source,
    source_ref: hit.id,
    per_serving: {
      calories: ps.kcal ?? 0,
      protein_g: ps.protein_g ?? 0,
      carbs_g: ps.carbs_g ?? 0,
      fat_g: ps.fat_g ?? 0,
    },
    match_confidence: {
      score: hit.match_confidence.score,
      label: hit.match_confidence.label,
      warnings: [...hit.match_confidence.warnings],
    },
  }
}

// Merge library and database results into a single ranked candidate
// list. Sorts by score descending, dedupes by source_ref.
export function mergeAndRankCandidates(
  libResults: LibrarySearchResult[],
  dbResults: FoodSearchResult[],
): DisambiguationCandidate[] {
  const merged: DisambiguationCandidate[] = []
  const seenRefs = new Set<string>()

  for (const h of libResults) {
    if (seenRefs.has(h.library_id)) continue
    seenRefs.add(h.library_id)
    merged.push(libraryHitToCandidate(h))
  }
  for (const h of dbResults) {
    if (seenRefs.has(h.id)) continue
    seenRefs.add(h.id)
    merged.push(dbHitToCandidate(h))
  }

  merged.sort((a, b) => b.match_confidence.score - a.match_confidence.score)
  return merged
}

// ---------------------------------------------------------------------
// Calorie-anchor scaler
// ---------------------------------------------------------------------

// Scale all macros so total kcal equals targetKcal. Applied only when
// classification.state === 'auto_commit' (user-picked candidates
// shouldn't be surprise-scaled — they can edit in the native UI).
export function scaleToTargetCalories(food: FoodItem, targetKcal: number): FoodItem {
  if (food.calories <= 0) return food
  const factor = targetKcal / food.calories
  return {
    ...food,
    calories: targetKcal,
    protein_g: round1(food.protein_g * factor),
    carbs_g: round1(food.carbs_g * factor),
    fat_g: round1(food.fat_g * factor),
  }
}

// ---------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------

export function classifyFoodMatch(
  item: EnumeratedItem,
  libResults: LibrarySearchResult[],
  dbResults: FoodSearchResult[],
): ClassificationResult {
  // ---- 1. Recited-macros short-circuit (with safety net) ----
  if (item.recited_calories !== undefined) {
    if (shouldTrustRecitedMacros(item)) {
      return {
        state: 'auto_commit',
        food: maybeScaleForTarget(item, foodFromRecitedMacros(item)),
        candidates: [],
      }
    }
    // Safety net fired: weight unit + recited macros = unreliable.
    // Fall through to library/db classification, but log the bypass.
    return classifyByLibraryAndDatabase(item, libResults, dbResults, true)
  }

  // ---- 2. Normal library/database classification ----
  return classifyByLibraryAndDatabase(item, libResults, dbResults, false)
}

function classifyByLibraryAndDatabase(
  item: EnumeratedItem,
  libResults: LibrarySearchResult[],
  dbResults: FoodSearchResult[],
  recitedRejected: boolean,
): ClassificationResult {
  // ---- Library auto_commit gate ----
  const libTop = libResults[0]
  if (libTop && libTop.match_confidence.score >= CONFIDENCE_HIGH_THRESHOLD) {
    const gap = libTop.match_confidence.score - (libResults[1]?.match_confidence.score ?? 0)
    const overlap = computeTokenOverlap(item.label, libTop.name)
    if (gap >= AUTO_COMMIT_SCORE_GAP && overlap >= AUTO_COMMIT_TOKEN_OVERLAP_FLOOR) {
      const food = foodFromLibraryHit(libTop, item)
      const allMerged = mergeAndRankCandidates(libResults, dbResults)
      return {
        state: 'auto_commit',
        food: maybeScaleForTarget(item, food),
        candidates: allMerged.slice(1, 4),
        ...(recitedRejected ? { recited_rejected_by_unit_guard: true } : {}),
      }
    }
  }

  // ---- Database auto_commit gate (only if library has nothing) ----
  if (libResults.length === 0) {
    const dbTop = dbResults[0]
    if (dbTop && dbTop.match_confidence.score >= CONFIDENCE_HIGH_THRESHOLD) {
      const gap = dbTop.match_confidence.score - (dbResults[1]?.match_confidence.score ?? 0)
      const hasMacroMismatch = dbTop.match_confidence.warnings.some((w) =>
        /^macro_math_mismatch_/.test(w),
      )
      if (gap >= AUTO_COMMIT_SCORE_GAP && !hasMacroMismatch) {
        const food = foodFromDbHit(dbTop, item)
        return {
          state: 'auto_commit',
          food: maybeScaleForTarget(item, food),
          candidates: dbResults.slice(1, 4).map(dbHitToCandidate),
          ...(recitedRejected ? { recited_rejected_by_unit_guard: true } : {}),
        }
      }
    }
  }

  // ---- Candidates state ----
  const all = mergeAndRankCandidates(libResults, dbResults)
  if (all.length > 0) {
    return {
      state: 'candidates',
      food: placeholderFood(item, all[0]),
      candidates: all.slice(0, 3),
      ...(recitedRejected ? { recited_rejected_by_unit_guard: true } : {}),
    }
  }

  // ---- Unresolved ----
  return {
    state: 'unresolved',
    food: placeholderFood(item, null),
    candidates: [],
    ...(recitedRejected ? { recited_rejected_by_unit_guard: true } : {}),
  }
}

// Apply target_calories scaling on auto_commit foods. No-op for other
// states (candidates/unresolved foods aren't user-confirmed yet).
function maybeScaleForTarget(item: EnumeratedItem, food: FoodItem): FoodItem {
  if (item.target_calories === undefined) return food
  return scaleToTargetCalories(food, item.target_calories)
}
