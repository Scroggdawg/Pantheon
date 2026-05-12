import { parseWorkout } from '@/lib/claude/workout'
import { createClient } from '@/lib/supabase/server'
import { estimateCalories } from '@/lib/claude/calories'

const MAX_TRANSCRIPT_CHARS = 2000

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json()

    if (!transcript || typeof transcript !== 'string') {
      return Response.json({ error: 'transcript is required' }, { status: 400 })
    }
    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      return Response.json(
        { error: `transcript must be ${MAX_TRANSCRIPT_CHARS} characters or less` },
        { status: 413 },
      )
    }

    // Fetch most recent weight for calorie estimation
    const supabase = await createClient()
    const { data: weightRow } = await supabase
      .from('weight_readings')
      .select('weight_lbs')
      .order('measured_at', { ascending: false })
      .limit(1)
      .single()
    const weightLbs = weightRow?.weight_lbs ? Number(weightRow.weight_lbs) : 198

    console.log('[parse-workout] Parsing:', transcript)
    const parsed = await parseWorkout(transcript)
    console.log('[parse-workout] Success:', parsed.exercises.length, 'exercises')

    // Estimate calorie burn
    const calResult = estimateCalories({
      session_type: parsed.session_type,
      duration_min: parsed.duration_min,
      distance_miles: parsed.distance_miles,
      weight_lbs: weightLbs,
      activity_detail: parsed.activity_detail,
    })

    return Response.json({
      ...parsed,
      estimated_cal_burned: calResult.estimated_cal_burned,
      cal_assumption: calResult.cal_assumption,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[parse-workout] ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
