// Tuning constants for the parse-meal pipeline. Mirrors prototype's
// constants.py (Step 2 sandbox); change here to retune in production.

// ----- match_confidence label thresholds -----
export const CONFIDENCE_HIGH_THRESHOLD = 0.85
export const CONFIDENCE_MEDIUM_THRESHOLD = 0.6

export type ConfidenceLabel = 'high' | 'medium' | 'low'

export function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= CONFIDENCE_HIGH_THRESHOLD) return 'high'
  if (score >= CONFIDENCE_MEDIUM_THRESHOLD) return 'medium'
  return 'low'
}

// ----- Composite formula weights -----
// When user provides a brand:  base = NAME_WEIGHT * name_sim + BRAND_WEIGHT * brand_match
// When user does not:          base = name_sim
export const NAME_WEIGHT = 0.65
export const BRAND_WEIGHT = 0.35

// ----- Macro-consistency penalty bands -----
// pct_off = |reported_kcal - (4P + 4C + 9F)| / max(reported_kcal, 1)
export const MACRO_CONS_NO_PENALTY_PCT = 0.05    // < 5%   → 1.0
export const MACRO_CONS_LIGHT_PENALTY_PCT = 0.10 // 5-10%  → 0.7  ; >=10% → 0.3
export const MACRO_CONS_NO_PENALTY_VALUE = 1.0
export const MACRO_CONS_LIGHT_PENALTY_VALUE = 0.7
export const MACRO_CONS_HARD_PENALTY_VALUE = 0.3
export const MACRO_CONS_UNKNOWN_VALUE = 0.5

// ----- Brand match scoring -----
export const BRAND_MATCH_NO_USER_BRAND = 1.0
export const BRAND_MATCH_EXACT = 1.0
export const BRAND_MATCH_USER_BRAND_GENERIC_FOOD = 0.5
export const BRAND_MATCH_DIFFERENT = 0.2

// ----- API endpoints -----
export const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'
export const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product/{barcode}.json'

// Required by OFF terms; courtesy header for USDA
export const USER_AGENT = 'Pantheon/1.0 (luke@scrog.dev)'

// ----- Anthropic model -----
// Matches Step 2 prototype which validated 21 cases on this model.
export const CLAUDE_MODEL = 'claude-sonnet-4-5'
export const CLAUDE_MAX_TOKENS = 4096
export const PARSE_MEAL_MAX_ITERS = 10

// ----- USDA nutrient IDs -----
export const NUTRIENT_PROTEIN = 1003
export const NUTRIENT_FAT = 1004
export const NUTRIENT_CARBS = 1005
export const NUTRIENT_KCAL = 1008
export const NUTRIENT_SUGARS = 2000
export const NUTRIENT_FIBER = 1079
