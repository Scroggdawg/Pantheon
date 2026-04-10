import { client } from '@/lib/claude/claude'
import { createClient } from '@/lib/supabase/server'
import { DAY_TYPE_ADJUSTMENTS } from '@/types/database'
import type { DayType, FoodLogEntry, WorkoutSession, WeightReading } from '@/types/database'

const ROMAN_MAP: [number, string][] = [
  [9.5, 'X'], [8.5, 'IX'], [7.5, 'VIII'], [6.5, 'VII'],
  [5.5, 'VI'], [4.5, 'V'], [3.5, 'IV'], [2.5, 'III'],
  [1.5, 'II'], [0, 'I'],
]

function toRoman(score: number): string {
  for (const [threshold, numeral] of ROMAN_MAP) {
    if (score >= threshold) return numeral
  }
  return 'I'
}

function getLAHour(isoTime: string): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'America/Los_Angeles',
  }).format(new Date(isoTime))
  return parseInt(hour)
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
      weight_readings?: WeightReading[]
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

    // Fetch last 7 weight readings server-side (no date filter)
    const { data: weightData } = await supabase
      .from('weight_readings')
      .select('*')
      .order('measured_at', { ascending: false })
      .limit(7)

    const weightReadings: WeightReading[] = (weightData || []) as WeightReading[]

    // Compute day targets
    const adj = DAY_TYPE_ADJUSTMENTS[day_type]
    const calorieTarget = (user.base_calories_target || 2250) + adj.calories
    const proteinTarget = user.base_protein_g || 200
    const carbsTarget = (user.base_carbs_g || 160) + adj.carbs_g
    const fatTarget = user.base_fat_g || 90

    // Compute current totals from entries
    const grossCal = entries.reduce((s: number, e: FoodLogEntry) => s + (e.total_calories || 0), 0)
    const totalProtein = entries.reduce((s: number, e: FoodLogEntry) => s + (e.total_protein_g || 0), 0)
    const totalCarbs = entries.reduce((s: number, e: FoodLogEntry) => s + (e.total_carbs_g || 0), 0)
    const totalFat = entries.reduce((s: number, e: FoodLogEntry) => s + (e.total_fat_g || 0), 0)

    // Time check
    const laHour = getLAHour(current_time_iso)
    const isBefore2pm = laHour < 14

    // Weight trend
    const trendPerWeek = computeWeightTrendPerWeek(weightReadings)
    const hasTrend = trendPerWeek !== null

    // --- SCORE COMPONENTS ---

    // 1. Protein (30% or 35% if no trend)
    const proteinScore = Math.min(10, Math.max(0, 10 - Math.abs(totalProtein - proteinTarget) / 10))

    // 2. Calories (25% or 30% if no trend) — GROSS vs day target
    const calorieScore = Math.min(10, Math.max(0, 10 - Math.abs(grossCal - calorieTarget) / 100))

    // 3. Workout (20%)
    let workoutScore: number
    if (day_type === 'rest') {
      workoutScore = 10
    } else {
      const hasMatchingWorkout = workouts.some((w: WorkoutSession) => {
        if (day_type === 'lift') return w.session_type === 'lift'
        // zone2 day: zone2 or bjj with >= 20 min
        return (
          (w.session_type === 'zone2' || w.session_type === 'bjj') &&
          (w.duration_min == null || w.duration_min >= 20)
        )
      })
      if (hasMatchingWorkout) {
        workoutScore = 10
      } else if (isBefore2pm) {
        workoutScore = 5
      } else {
        workoutScore = 0
      }
    }

    // 4. Weight trend (15% or 0% if insufficient data)
    let trendScore = 0
    if (hasTrend) {
      // Full points if within 0.2 lbs/week of 1.3 target
      trendScore = Math.min(10, Math.max(0, 10 - Math.abs(trendPerWeek - 1.3) * 5))
    }

    // 5. Carbs + Fat (10%)
    const carbScore = Math.min(10, Math.max(0, 10 - Math.abs(totalCarbs - carbsTarget) / 15))
    const fatScore = Math.min(10, Math.max(0, 10 - Math.abs(totalFat - fatTarget) / 10))
    const macroScore = (carbScore + fatScore) / 2

    // Weighted sum
    let weightedScore: number
    if (hasTrend) {
      weightedScore =
        proteinScore * 0.30 +
        calorieScore * 0.25 +
        workoutScore * 0.20 +
        trendScore * 0.15 +
        macroScore * 0.10
    } else {
      // Redistribute trend 15%: protein gets 35%, calories gets 30%
      weightedScore =
        proteinScore * 0.35 +
        calorieScore * 0.30 +
        workoutScore * 0.20 +
        macroScore * 0.15
    }

    const finalScore = Math.min(10, Math.max(0, weightedScore))
    const roman = toRoman(finalScore)
    const is_projected = isBefore2pm

    // Remaining macros for context
    const remainingCal = calorieTarget - grossCal
    const remainingProtein = proteinTarget - totalProtein
    const remainingCarbs = carbsTarget - totalCarbs
    const remainingFat = fatTarget - totalFat

    // Total workout calories burned today
    const totalCalBurned = workouts.reduce(
      (s: number, w: WorkoutSession) => s + (w.estimated_cal_burned || 0),
      0
    )

    // Current weight
    const currentWeight = weightReadings.length > 0 ? Number(weightReadings[0].weight_lbs) : null

    // Call Claude for verdict + recommendation
    const verdictPrompt = `You are the Greek God Bod Score coach for Pantheon. Given these component scores and data, write:
1. A one-sentence verdict — specific numbers, no generic phrases.
2. A two-sentence recommendation — actionable, time-aware.

HARD RULE: Never recommend net calories below 1800/day.

${is_projected ? 'This is a PROJECTED score (before 2pm LA time). Add "(Projected — final score at 8pm)" at the end of the verdict.' : ''}
${!hasTrend ? 'Weight trend is unavailable due to fewer than 3 readings. Mention this briefly.' : ''}
${workoutScore === 5 && day_type !== 'rest' ? 'No workout logged yet but it is before 2pm — mention there is still time.' : ''}

Return ONLY valid JSON:
{"verdict": "string", "recommendation": "string"}`

    const contextMsg = JSON.stringify({
      score: finalScore.toFixed(1),
      roman,
      day_type,
      la_hour: laHour,
      components: {
        protein: { score: proteinScore.toFixed(1), actual: Math.round(totalProtein), target: proteinTarget },
        calories: { score: calorieScore.toFixed(1), actual: grossCal, target: calorieTarget },
        workout: { score: workoutScore, logged: workouts.length > 0, type: workouts[0]?.session_type ?? 'none' },
        trend: hasTrend
          ? { score: trendScore.toFixed(1), rate: trendPerWeek.toFixed(2), target: 1.3 }
          : { score: 'N/A', reason: 'fewer than 3 weight readings' },
        carbs_fat: { score: macroScore.toFixed(1), carbs: Math.round(totalCarbs), carbs_target: carbsTarget, fat: Math.round(totalFat), fat_target: fatTarget },
      },
      remaining: { calories: remainingCal, protein: Math.round(remainingProtein), carbs: Math.round(remainingCarbs), fat: Math.round(remainingFat) },
      cal_burned_today: totalCalBurned,
      current_weight: currentWeight,
    })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: verdictPrompt,
      messages: [{ role: 'user', content: contextMsg }],
    })

    const block = response.content[0]
    let text = block.type === 'text' ? block.text : '{}'
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()

    let verdict = ''
    let recommendation = ''
    try {
      const parsed = JSON.parse(text)
      verdict = parsed.verdict || ''
      recommendation = parsed.recommendation || ''
    } catch {
      verdict = text
      recommendation = ''
    }

    return Response.json({
      score: Math.round(finalScore * 10) / 10,
      roman,
      verdict,
      recommendation,
      is_projected,
      components: {
        protein_score: Math.round(proteinScore * 10) / 10,
        calorie_score: Math.round(calorieScore * 10) / 10,
        workout_score: workoutScore,
        trend_score: hasTrend ? Math.round(trendScore * 10) / 10 : null,
        macro_score: Math.round(macroScore * 10) / 10,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[score] ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
