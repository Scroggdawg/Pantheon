export type DayType = 'lift' | 'zone2' | 'rest'
export type LogMethod = 'voice' | 'photo' | 'barcode' | 'quick' | 'manual' | 'ocr'
export type SessionType = 'lift' | 'bjj' | 'zone2' | 'other'
export type Confidence = 'low' | 'medium' | 'high'
// 'wyze_sync' retained for historical weight_readings rows;
// Wyze deprecated Session 15, removed Session 26.
export type WeightSource = 'wyze_sync' | 'manual' | 'withings'
export type CalEstimateMethod = 'MET_estimate' | 'user_override' | 'apple_health'

export interface User {
  id: string
  email: string | null
  name: string | null
  height_in: number | null
  dob: string | null
  sex: string | null
  starting_weight_lbs: number | null
  starting_bf_pct: number | null
  goal_weight_lbs: number | null
  goal_date: string | null
  goal_rate_lbs_per_week: number | null
  base_calories_target: number | null
  base_protein_g: number | null
  base_fat_g: number | null
  base_carbs_g: number | null
  created_at: string
}

// S26 Step 3 — V2 contract for parse-meal pipeline output. The new tool-using
// pipeline (search_user_library + search_food_database) populates every field
// here on every new entry. Historical food_log_entries.foods_json rows
// pre-S26 lack source / source_ref / match_confidence — readers iterating
// FoodLogEntry.foods_json must coerce defensively (treat missing source as
// "user_recited" with no confidence object).
//
// The legacy `confidence?: Confidence` (string enum) field is dropped from
// the type. Historical jsonb rows that have it persist with the field
// ignored at the TS layer; nothing reads it today.
export type FoodItemSource =
  | 'library'           // tool returned a saved_meals or products row the LLM accepted
  | 'database_exact'    // USDA/OFF hit with high match_confidence
  | 'database_estimated' // USDA/OFF hit, scaled or low-confidence
  | 'user_recited'      // user gave macros directly in transcript ("a 200-cal protein bar")
  | 'llm_estimated'     // pure LLM estimate, no tool hit
  | 'quick_add'         // bare-numbers entry, no name attached

// S26 Step 4d — per-food classifier state for the candidates-first
// architecture. Populated by the pipeline-side classifier; legacy rows
// from before Step 4d will not have this field set.
//   auto_commit  — top match cleared the score + gap + token-overlap gates
//   candidates   — multiple plausible matches; surface the top 3 for user pick
//   unresolved   — no match above the floor; user must re-input or quick-add
export type FoodItemState = 'auto_commit' | 'candidates' | 'unresolved'

export interface MatchConfidence {
  score: number              // 0..1
  label: 'high' | 'medium' | 'low'
  warnings: string[]         // human-readable notes ("macro_math_off", "brand_mismatch", etc.)
}

export interface FoodItem {
  name: string
  qty: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  // V2 fields. Optional at the type level for historical-row compat (see
  // header note above); the new pipeline always populates them.
  source?: FoodItemSource
  source_ref?: string | null  // "lib:saved_meal_id", "lib:product_id", "usda:fdcId", "off:upc"
  match_confidence?: MatchConfidence
  notes?: string | null
  // S26 Step 4d — candidates-first fields. Populated by the new
  // pipeline classifier; absent on pre-Step-4d rows. `candidates` is
  // populated when state is 'candidates' or 'unresolved' to give the
  // native UI options to surface inline.
  state?: FoodItemState
  candidates?: DisambiguationCandidate[]
}

// V2 disambiguation surface. When the parse pipeline finds multiple
// plausible matches for an item and can't auto-pick, it emits a
// DisambiguationPrompt for that item; native UI surfaces an inline picker.
export interface DisambiguationCandidate {
  name: string
  source: FoodItemSource
  source_ref: string
  per_serving: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
  match_confidence: MatchConfidence
}

export interface DisambiguationPrompt {
  item_index: number          // index into ParsedMealResponse.foods[]
  query_used: string          // the LLM's query string for this item
  candidates: DisambiguationCandidate[]
}

export interface FoodLogEntry {
  id: string
  user_id: string
  logged_at: string
  meal_label: string | null
  day_type: DayType | null
  foods_json: FoodItem[]
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  log_method: LogMethod | null
  raw_input_text: string | null
  claude_parse_json: Record<string, unknown> | null
  created_at: string
}

export interface DailySummary {
  id: string
  user_id: string
  date: string
  day_type: DayType | null
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  calorie_target: number
  protein_target: number
  carbs_target: number
  fat_target: number
  fully_logged: boolean
}

export interface WeightReading {
  id: string
  user_id: string
  measured_at: string
  weight_lbs: number
  body_fat_pct: number | null
  muscle_mass_lbs: number | null
  bone_mass_lbs: number | null
  water_pct: number | null
  visceral_fat: number | null
  bmi: number | null
  source: WeightSource
  wyze_record_id: string | null
  created_at: string
}

export interface TdeeEstimate {
  id: string
  user_id: string
  week_of: string
  tdee_cal_per_day: number
  calorie_target: number
  avg_weight_lbs: number
  weight_trend_delta_lbs: number
  avg_calories_logged: number
  regression_data_points: number
  confidence: Confidence
  algorithm_version: string
  created_at: string
}

export interface WeeklyCheckin {
  id: string
  user_id: string
  week_of: string
  weight_trend_lbs: number | null
  calories_avg: number | null
  protein_avg_g: number | null
  tdee_estimate: number | null
  prior_tdee_estimate: number | null
  new_calorie_target: number | null
  projection_goal_date_weight_lbs: number | null
  on_track: boolean | null
  coach_message: string | null
  confirmed_at: string | null
  created_at: string
}

export interface SavedMeal {
  id: string
  user_id: string
  name: string
  foods_json: FoodItem[]
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  times_logged: number
  last_logged_at: string | null
  tags: string[]
  yield_servings: number
  is_staple: boolean
  created_at: string
}

export interface PantryItem {
  id: string
  user_id: string
  name: string
  quantity: number | null
  unit: string | null
  calories_per_100g: number | null
  protein_per_100g: number | null
  carbs_per_100g: number | null
  fat_per_100g: number | null
  barcode: string | null
  added_at: string
  expires_at: string | null
}

export interface WorkoutSession {
  id: string
  user_id: string
  trained_at: string
  session_type: SessionType
  duration_min: number | null
  notes: string | null
  raw_input_text: string | null
  image_url: string | null
  total_volume_lbs: number | null
  distance_miles: number | null
  estimated_cal_burned: number | null
  cal_estimate_method: CalEstimateMethod
  avg_heart_rate: number | null
  perceived_effort: number | null
  workout_notes: string | null
  created_at: string
}

export interface WorkoutExercise {
  id: string
  session_id: string
  exercise_name: string
  muscle_groups: string[]
  sets_json: Record<string, unknown>[]
  total_volume_lbs: number | null
  is_pr: boolean
}

// S26 Step 3 — V2 contract. meal_label dropped (was dead per
// log-food.tsx:122 in native; slot is the source of truth post-S25
// redesign). disambiguation added per design doc §6.
export interface ParsedMealResponse {
  foods: FoodItem[]
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  // Free-form copy from the LLM when input is too vague to parse
  // confidently (e.g. "small bowl of cereal" with no specifics).
  // Native surfaces this as a prompt to refine the input.
  clarification_needed: string | null
  // null when the LLM auto-picked confidently for every item;
  // populated when one or more items had multiple plausible
  // matches the LLM couldn't resolve. Native surfaces an inline
  // picker per item per design doc §6.
  disambiguation: DisambiguationPrompt[] | null
}

export interface VoiceCorrection {
  id: string
  user_id: string
  heard: string
  corrected: string
  times_applied: number
  created_at: string
}

// Day type calorie/macro adjustments
export const DAY_TYPE_ADJUSTMENTS: Record<DayType, { calories: number; carbs_g: number; emoji: string; label: string }> = {
  lift: { calories: 200, carbs_g: 50, emoji: '🏋️', label: 'Lift Day' },
  zone2: { calories: 0, carbs_g: 0, emoji: '🫀', label: 'Zone 2 / BJJ' },
  rest: { calories: -150, carbs_g: -30, emoji: '😴', label: 'Rest Day' },
}

// Provisions arc (migration 008 + 009) — recipes, meal plans, shopping lists,
// products, user preferences.
export type RecipeSource = 'user' | 'ai_generated' | 'imported'
export type MealPlanStatus = 'in_hole' | 'on_deck' | 'up' | 'archived'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type MealEntryStatus = 'planned' | 'eaten' | 'skipped' | 'swapped'
export type EntrySourceType = 'recipe' | 'product'
export type ProductFulfillmentSource =
  | 'amazon_fresh' | 'amazon_prime' | 'whole_foods' | 'manual'
export type ShoppingListStatus = 'draft' | 'sent_to_agent' | 'cart_filled' | 'ordered' | 'delivered'

export interface RecipeIngredient {
  name: string
  qty: number
  unit: string
  notes?: string | null
  // Migration 009: optional, indicates how the user expects to obtain
  // this ingredient. JSON-only — no schema change to recipes table.
  fulfillment_source?: 'product' | 'manual' | null
}

export interface Recipe {
  id: string
  name: string
  servings: number
  cuisine: string | null
  protein_type: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  ingredients: RecipeIngredient[]
  notes: string | null
  source: RecipeSource
  created_at: string
  updated_at: string
}

export interface MealPlan {
  id: string
  plan_date_start: string
  plan_date_end: string
  daily_target_macros: {
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
  } | null
  status: MealPlanStatus
  // Migration 009: batch lifecycle metadata.
  batch_position: number | null
  cook_date: string | null
  order_date: string | null
  created_at: string
  updated_at: string
}

export interface MealPlanEntry {
  id: string
  plan_id: string
  // Migration 009: polymorphic source pointer replaces recipe_id.
  // source_id references either recipes.id or products.id depending
  // on source_type. No FK enforcement; validated at the API layer.
  source_type: EntrySourceType
  source_id: string
  meal_date: string
  slot: MealSlot
  servings: number
  // Migration 009: when true, reroll-slot will reject swaps.
  locked: boolean
  status: MealEntryStatus
  notes: string | null
  created_at: string
  updated_at: string
}

// Migration 009: product catalog used by generate-meal-plan
// alongside recipes. Macros are per-serving.
export interface Product {
  id: string
  name: string
  brand: string | null
  unit: string
  serving_size_g: number | null
  calories_per_serving: number
  protein_g_per_serving: number
  fat_g_per_serving: number
  carbs_g_per_serving: number
  fiber_g_per_serving: number | null
  fulfillment_source: ProductFulfillmentSource
  barcode: string | null
  product_url: string | null
  notes: string | null
  tracks_inventory: boolean
  servings_per_unit: number | null
  created_at: string
  updated_at: string
}

// Migration 009: singleton row. Auto-created on first GET of
// /api/user-preferences.
export interface UserPreferences {
  id: string
  daily_target_macros: {
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
  } | null
  cuisine_likes: string[]
  cuisine_dislikes: string[]
  protein_likes: string[]
  protein_dislikes: string[]
  excluded_ingredients: string[]
  default_servings: number
  default_batch_days: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ShoppingListItem {
  name: string
  qty: number
  unit: string
  category?: string | null
  checked?: boolean
}

export interface ShoppingList {
  id: string
  plan_id: string
  generated_at: string
  items: ShoppingListItem[]
  status: ShoppingListStatus
  cart_url: string | null
  order_total: number | null
  created_at: string
  updated_at: string
}
