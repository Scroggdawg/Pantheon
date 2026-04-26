export type DayType = 'lift' | 'zone2' | 'rest'
export type LogMethod = 'voice' | 'photo' | 'barcode' | 'quick' | 'manual' | 'ocr'
export type SessionType = 'lift' | 'bjj' | 'zone2' | 'other'
export type Confidence = 'low' | 'medium' | 'high'
export type WeightSource = 'wyze_sync' | 'manual'
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

export interface FoodItem {
  name: string
  qty: number
  unit: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  confidence?: Confidence
  notes?: string | null
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

export interface ParsedMealResponse {
  foods: FoodItem[]
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  meal_label: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  clarification_needed: string | null
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

// Provisions arc (migration 008) — recipes, meal plans, shopping lists
export type RecipeSource = 'user' | 'ai_generated' | 'imported'
export type MealPlanStatus = 'draft' | 'active' | 'archived'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type MealEntryStatus = 'planned' | 'eaten' | 'skipped' | 'swapped'
export type ShoppingListStatus = 'draft' | 'sent_to_agent' | 'cart_filled' | 'ordered' | 'delivered'

export interface RecipeIngredient {
  name: string
  qty: number
  unit: string
  notes?: string | null
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
  created_at: string
  updated_at: string
}

export interface MealPlanEntry {
  id: string
  plan_id: string
  recipe_id: string | null
  meal_date: string
  slot: MealSlot
  servings: number
  status: MealEntryStatus
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
