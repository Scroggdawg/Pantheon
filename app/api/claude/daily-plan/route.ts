import { client } from '@/lib/claude/claude'
import { createClient } from '@/lib/supabase/server'
import { DAY_TYPE_ADJUSTMENTS } from '@/types/database'
import type { DayType, FoodLogEntry, WorkoutSession, FoodItem } from '@/types/database'

interface PlanMeal {
  name: string
  description: string
  portions: string
  macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  prep_minutes: number
  cuisine: string
  from_saved: boolean
  saveable: boolean
  foods_json: FoodItem[]
}

interface PlanResponse {
  meals: PlanMeal[]
  projected_score_if_followed: string | null
  low_cal_message: string | null
}

function getLAHour(isoTime: string): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'America/Los_Angeles',
  }).format(new Date(isoTime))
  return parseInt(hour)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      day_type,
      current_time_iso,
      entries,
      workouts,
    } = body as {
      day_type: DayType
      current_time_iso: string
      entries: FoodLogEntry[]
      workouts: WorkoutSession[]
    }

    const supabase = await createClient()

    // Fetch user for base targets
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .limit(1)
      .single()

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // Compute day targets
    const adj = DAY_TYPE_ADJUSTMENTS[day_type]
    const calorieTarget = (user.base_calories_target || 2250) + adj.calories
    const proteinTarget = user.base_protein_g || 200
    const carbsTarget = (user.base_carbs_g || 160) + adj.carbs_g
    const fatTarget = user.base_fat_g || 90

    // Current totals from entries
    const grossCal = entries.reduce((s: number, e: FoodLogEntry) => s + (e.total_calories || 0), 0)
    const totalProtein = entries.reduce((s: number, e: FoodLogEntry) => s + (e.total_protein_g || 0), 0)
    const totalCarbs = entries.reduce((s: number, e: FoodLogEntry) => s + (e.total_carbs_g || 0), 0)
    const totalFat = entries.reduce((s: number, e: FoodLogEntry) => s + (e.total_fat_g || 0), 0)

    const remainingCal = calorieTarget - grossCal
    const remainingProtein = Math.round(proteinTarget - totalProtein)
    const remainingCarbs = Math.round(carbsTarget - totalCarbs)
    const remainingFat = Math.round(fatTarget - totalFat)

    // Low calorie check — skip Claude call
    if (remainingCal < 400) {
      const resp: PlanResponse = {
        meals: [],
        projected_score_if_followed: null,
        low_cal_message:
          'You are almost at your target for today. Focus on hitting protein — Greek yogurt or cottage cheese gets you there without blowing the budget.',
      }
      return Response.json(resp)
    }

    // Fetch saved meals and pantry items
    const [{ data: savedMeals }, { data: pantryItems }] = await Promise.all([
      supabase.from('saved_meals').select('*').eq('user_id', user.id),
      supabase.from('pantry_items').select('*').eq('user_id', user.id),
    ])

    const laHour = getLAHour(current_time_iso)

    // Determine meal context based on time
    let mealTimeContext: string
    if (laHour < 11) {
      mealTimeContext = 'breakfast/brunch time'
    } else if (laHour < 15) {
      mealTimeContext = 'lunch time'
    } else if (laHour < 18) {
      mealTimeContext = 'afternoon snack or early dinner'
    } else {
      mealTimeContext = 'dinner time'
    }

    // Build food names already logged today
    const loggedFoods = entries.flatMap((e: FoodLogEntry) =>
      (e.foods_json || []).map((f: FoodItem) => f.name)
    )

    // Build system prompt
    const systemPrompt = `You are the Pantheon meal planner. Generate meals for the rest of today.

REMAINING MACROS:
- Calories: ${remainingCal}
- Protein: ${remainingProtein}g
- Carbs: ${remainingCarbs}g
- Fat: ${remainingFat}g

CONTEXT:
- Day type: ${day_type} (${adj.label})
- Current time: ${mealTimeContext} (${laHour}:00 LA time)
- Already logged: ${loggedFoods.length > 0 ? loggedFoods.join(', ') : 'nothing yet'}
- Workouts today: ${workouts.length > 0 ? workouts.map((w: WorkoutSession) => w.session_type).join(', ') : 'none'}

${(savedMeals && savedMeals.length > 0) ? `SAVED MEALS (prefer these when they fit remaining macros):\n${savedMeals.map((m: { name: string; total_calories: number; total_protein_g: number; total_carbs_g: number; total_fat_g: number }) => `- ${m.name}: ${m.total_calories} cal, ${m.total_protein_g}g P, ${m.total_carbs_g}g C, ${m.total_fat_g}g F`).join('\n')}` : ''}

${(pantryItems && pantryItems.length > 0) ? `PANTRY ITEMS (incorporate when possible):\n${pantryItems.map((p: { name: string; calories_per_100g: number | null; protein_per_100g: number | null }) => `- ${p.name}${p.calories_per_100g ? ` (${p.calories_per_100g} cal/100g, ${p.protein_per_100g}g P/100g)` : ''}`).join('\n')}` : ''}

RULES:
1. Total planned calories MUST be within 50 cal of remaining (${remainingCal}).
2. Prioritize hitting protein target (${remainingProtein}g remaining).
3. No same main protein source as already logged today.
4. Use exact gram weights for portions.
5. If using a saved meal, set from_saved=true and saveable=false.
6. New meals: set from_saved=false and saveable=true.
7. Suggest 1-3 meals depending on remaining calories and time of day.
8. Include cuisine variety. Lean toward Mediterranean, Asian, or Mexican.
9. Keep prep under 30 minutes per meal.
10. HARD RULE: Never plan below 1800 total daily calories (current gross: ${grossCal}).

After the meals, write a one-sentence projected score summary if meals are followed.

Return ONLY valid JSON:
{
  "meals": [
    {
      "name": "string",
      "description": "one sentence",
      "portions": "exact weights like '150g chicken breast, 200g rice'",
      "macros": { "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number },
      "prep_minutes": number,
      "cuisine": "string",
      "from_saved": boolean,
      "saveable": boolean,
      "foods_json": [
        { "name": "string", "qty": number, "unit": "g or ml or piece", "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number }
      ]
    }
  ],
  "projected_score_if_followed": "string or null"
}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Generate my meal plan for the rest of today.' }],
    })

    const block = response.content[0]
    let text = block.type === 'text' ? block.text : '{}'
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()

    let parsed: { meals?: PlanMeal[]; projected_score_if_followed?: string | null }
    try {
      parsed = JSON.parse(text)
    } catch {
      console.error('[daily-plan] Failed to parse Claude response:', text)
      return Response.json({ error: 'Failed to parse plan response' }, { status: 500 })
    }

    const resp: PlanResponse = {
      meals: parsed.meals || [],
      projected_score_if_followed: parsed.projected_score_if_followed || null,
      low_cal_message: null,
    }

    return Response.json(resp)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[daily-plan] ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
