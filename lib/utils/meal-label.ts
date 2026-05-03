// Time-of-day → meal_label heuristic. Used by web logging surfaces
// (TextLogModal, VoiceLogger, CoachPanel) to populate
// food_log_entries.meal_label when the V2 parse pipeline no longer
// returns a meal_label field. Native uses an explicit slot picker and
// does not need this helper.

export type MealLabel = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/**
 * Map an hour-of-day (0..23) to a coarse meal label.
 *   <11  → breakfast
 *   <15  → lunch
 *   <21  → dinner
 *   else → snack
 */
export function hourToMealLabel(hour: number): MealLabel {
  if (hour < 11) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}
