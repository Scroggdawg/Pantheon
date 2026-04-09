import { parseWorkout } from '@/lib/claude/workout'

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json()

    if (!transcript || typeof transcript !== 'string') {
      return Response.json({ error: 'transcript is required' }, { status: 400 })
    }

    console.log('[parse-workout] Parsing:', transcript)
    const parsed = await parseWorkout(transcript)
    console.log('[parse-workout] Success:', parsed.exercises.length, 'exercises')
    return Response.json(parsed)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[parse-workout] ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
