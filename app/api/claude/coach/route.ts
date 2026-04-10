import { client } from '@/lib/claude/claude'
import { createClient } from '@/lib/supabase/server'
import { DAY_TYPE_ADJUSTMENTS } from '@/types/database'
import type { DayType, FoodLogEntry, WorkoutSession, WeightReading, SavedMeal } from '@/types/database'

function getLADate(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

function computeWeightTrendPerWeek(readings: WeightReading[]): number | null {
  if (readings.length < 3) return null
  const sorted = [...readings].sort(
    (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime()
  )
  const oldest = sorted[0]
  const newest = sorted[sorted.length - 1]
  const daysBetween =
    (new Date(newest.measured_at).getTime() - new Date(oldest.measured_at).getTime()) /
    (1000 * 60 * 60 * 24)
  if (daysBetween < 1) return null
  const weeksBetween = daysBetween / 7
  const lbsLost = Number(oldest.weight_lbs) - Number(newest.weight_lbs)
  return lbsLost / weeksBetween
}

function computeTDEE(
  entries: FoodLogEntry[],
  readings: WeightReading[]
): { tdee: number; avgCalories: number; lbsPerWeek: number } | null {
  // Activation gate: >= 14 readings, >= 10 distinct log days
  if (readings.length < 14) return null

  const distinctDates = new Set(
    entries.map((e) =>
      new Date(e.logged_at).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })
    )
  )
  if (distinctDates.size < 10) return null

  // Average daily calories
  const totalCal = entries.reduce((s, e) => s + (e.total_calories || 0), 0)
  const avgCalories = Math.round(totalCal / distinctDates.size)

  // Weight trend
  const lbsPerWeek = computeWeightTrendPerWeek(readings)
  if (lbsPerWeek === null) return null

  // TDEE = avg_daily_calories + (actual_lbs_per_week * 500)
  const tdee = Math.round(avgCalories + lbsPerWeek * 500)

  return { tdee, avgCalories, lbsPerWeek }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      message,
      conversation_history,
      day_type,
      current_time_iso,
    } = body as {
      message: string
      conversation_history: { role: string; content: string }[]
      day_type: DayType
      current_time_iso: string
    }

    const supabase = await createClient()
    const today = getLADate(new Date(current_time_iso))

    // Fetch all context in parallel
    const [foodRes, workoutRes, weightRes, mealsRes, pantryRes, userRes] = await Promise.all([
      supabase
        .from('food_log_entries')
        .select('*')
        .gte('logged_at', `${today}T00:00:00`)
        .lte('logged_at', `${today}T23:59:59`),
      supabase
        .from('workout_sessions')
        .select('*')
        .gte('trained_at', `${today}T00:00:00`)
        .lte('trained_at', `${today}T23:59:59`),
      supabase
        .from('weight_readings')
        .select('*')
        .order('measured_at', { ascending: false })
        .limit(14),
      supabase.from('saved_meals').select('name, total_calories, total_protein_g, total_carbs_g, total_fat_g, yield_servings'),
      supabase.from('pantry_items').select('name'),
      supabase.from('users').select('*').limit(1).single(),
    ])

    const user = userRes.data
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const entries: FoodLogEntry[] = (foodRes.data || []) as FoodLogEntry[]
    const workouts: WorkoutSession[] = (workoutRes.data || []) as WorkoutSession[]
    const weightReadings: WeightReading[] = (weightRes.data || []) as WeightReading[]

    // Compute day targets
    const adj = DAY_TYPE_ADJUSTMENTS[day_type]
    const calorieTarget = (user.base_calories_target || 2250) + adj.calories
    const proteinTarget = user.base_protein_g || 200
    const carbsTarget = (user.base_carbs_g || 160) + adj.carbs_g
    const fatTarget = user.base_fat_g || 90

    // Current totals
    const grossCal = entries.reduce((s, e) => s + (e.total_calories || 0), 0)
    const totalProtein = entries.reduce((s, e) => s + (e.total_protein_g || 0), 0)
    const totalCarbs = entries.reduce((s, e) => s + (e.total_carbs_g || 0), 0)
    const totalFat = entries.reduce((s, e) => s + (e.total_fat_g || 0), 0)

    const remainingCal = calorieTarget - grossCal
    const remainingProtein = Math.round(proteinTarget - totalProtein)
    const remainingCarbs = Math.round(carbsTarget - totalCarbs)
    const remainingFat = Math.round(fatTarget - totalFat)

    // Workout info
    const totalCalBurned = workouts.reduce((s, w) => s + (w.estimated_cal_burned || 0), 0)
    const workoutSummary = workouts.length > 0
      ? workouts.map((w) => `${w.session_type} (${w.duration_min || '?'} min, ${w.estimated_cal_burned || 0} cal burned)`).join(', ')
      : 'none'

    // Weight info
    const currentWeight = weightReadings.length > 0 ? Number(weightReadings[0].weight_lbs) : null
    const trendPerWeek = computeWeightTrendPerWeek(weightReadings)

    // TDEE
    const tdeeResult = computeTDEE(entries, weightReadings)

    // Days to goal
    const daysRemaining = Math.ceil(
      (new Date('2026-06-19').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    )

    // Saved meals and pantry for context
    const savedMeals: SavedMeal[] = (mealsRes.data || []) as SavedMeal[]
    const pantryNames = (pantryRes.data || []).map((p: { name: string }) => p.name)

    // Build entry/workout/weight ID listings for CRUD
    const entryListing = entries.map((e) => {
      const foods = e.foods_json.map((f) => f.name).join(', ')
      return `  [${e.id}] ${e.meal_label || 'snack'}: ${foods} — ${e.total_calories} cal`
    }).join('\n')

    const workoutListing = workouts.map((w) => {
      const details: string[] = []
      if (w.duration_min) details.push(`${w.duration_min} min`)
      if (w.estimated_cal_burned) details.push(`${w.estimated_cal_burned} cal burned`)
      return `  [${w.id}] ${w.session_type} ${details.join(', ')}`
    }).join('\n')

    const recentWeightListing = weightReadings.slice(0, 3).map((r) => {
      const date = new Date(r.measured_at).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })
      return `  [${r.id}] ${Number(r.weight_lbs).toFixed(1)} lbs on ${date}`
    }).join('\n')

    const savedMealListing = savedMeals.map((m) => {
      const ys = m.yield_servings || 1
      const perCal = Math.round(m.total_calories / ys)
      const perP = Math.round(m.total_protein_g / ys)
      return `  "${m.name}" — ${perCal} cal/srv, ${perP}g protein/srv${ys > 1 ? ` (${ys} servings)` : ''}`
    }).join('\n')

    const systemPrompt = `You are the Pantheon AI Coach — a direct, data-driven training partner. You have full access to the user's nutrition, workout, and body composition data.

TODAY'S DATA:
- Day type: ${day_type} (${adj.label})
- Food logged: ${grossCal} cal consumed / ${calorieTarget} target (${remainingCal} remaining)
- Protein: ${Math.round(totalProtein)}g / ${proteinTarget}g (${remainingProtein}g remaining)
- Carbs: ${Math.round(totalCarbs)}g / ${carbsTarget}g (${remainingCarbs}g remaining)
- Fat: ${Math.round(totalFat)}g / ${fatTarget}g (${remainingFat}g remaining)
- Workouts: ${workoutSummary} (${totalCalBurned} cal burned total)

TODAY'S FOOD ENTRIES (use these IDs for edit/delete):
${entryListing || '  (none)'}

TODAY'S WORKOUTS (use these IDs for edit/delete):
${workoutListing || '  (none)'}

RECENT WEIGHT READINGS (use these IDs for delete):
${recentWeightListing || '  (none)'}

BODY COMPOSITION:
- Current weight: ${currentWeight ? `${currentWeight} lbs` : 'no reading today'}
- Weight trend: ${trendPerWeek !== null ? `${trendPerWeek.toFixed(2)} lbs/week loss` : 'insufficient data (< 3 readings)'}
- Goal: 185 lbs by June 19, 2026 (${daysRemaining} days remaining)
- Target rate: 1.3 lbs/week
- Split: 3 lift + 3 zone2 + 1 rest per week

${tdeeResult ? `TDEE ESTIMATE:
- Estimated TDEE: ${tdeeResult.tdee} cal/day
- Based on: avg ${tdeeResult.avgCalories} cal/day intake, ${tdeeResult.lbsPerWeek.toFixed(2)} lbs/week loss
` : 'TDEE: Not enough data yet (need 14 weight readings + 10 days of food logging)'}

${savedMeals.length > 0 ? `SAVED MEALS (use name for log_saved_meal):\n${savedMealListing}` : ''}
${pantryNames.length > 0 ? `PANTRY: ${pantryNames.join(', ')}` : ''}

RULES:
1. Be direct and specific. Reference actual numbers, not generic advice.
2. HARD FLOOR: Never recommend net calories below 1800/day.
3. For projections, derive from actual weight_readings trend. If < 7 readings, give a range not a specific number.
4. Tone: like a knowledgeable training partner. Brief, not verbose.
5. If the user wants to log, edit, or delete anything — return the appropriate action.
6. If the user asks about pantry tracking: "Pantry tracking coming in a future update."

ACTIONS — when the user's message implies an action, include it in your response JSON:

Create:
- Log food: { "type": "log_food", "params": { "description": "the food to parse" } }
- Log workout: { "type": "log_workout", "params": { "session_type": "lift|bjj|zone2|other", "duration_min": number, "notes": "string" } }
- Log weight: { "type": "log_weight", "params": { "weight_lbs": number } }
- Log saved meal: { "type": "log_saved_meal", "params": { "meal_name": "exact name", "servings": number } }
- Update day type: { "type": "update_day_type", "params": { "day_type": "lift|zone2|rest" } }

Edit food entry (two modes):
- Re-describe (user changes WHAT the food is): { "type": "edit_food_entry", "params": { "entry_id": "uuid", "mode": "reparse", "description": "new food description" } }
- Scale portion (user changes HOW MUCH): { "type": "edit_food_entry", "params": { "entry_id": "uuid", "mode": "scale", "scale_factor": number } }
  Use scale mode when: "I only had half", "change to 1.5 cups", "make it 2 servings" → scale_factor is the multiplier (0.5, 1.5, 2.0, etc.)
  Use reparse mode when: "change that to grilled chicken and rice", "it was actually a burrito" → completely different food

Edit workout: { "type": "edit_workout", "params": { "session_id": "uuid", "session_type?": "string", "duration_min?": number, "notes?": "string" } }

Delete:
- Delete food entry: { "type": "delete_food_entry", "params": { "entry_id": "uuid" } }
- Delete workout: { "type": "delete_workout", "params": { "session_id": "uuid" } }
- Delete weight: { "type": "delete_weight", "params": { "reading_id": "uuid" } }

Return ONLY valid JSON:
{ "message": "your response text", "action": { "type": "...", "params": { ... } } | null }`

    // Build messages array with conversation history
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      ...conversation_history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: systemPrompt,
      messages,
    })

    const block = response.content[0]
    let text = block.type === 'text' ? block.text : '{}'
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()

    let parsed: { message?: string; action?: { type: string; params: Record<string, unknown> } | null }
    try {
      parsed = JSON.parse(text)
    } catch {
      // If Claude didn't return valid JSON, use raw text as message
      parsed = { message: text, action: null }
    }

    return Response.json({
      message: parsed.message || '',
      action: parsed.action || null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[coach] ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
