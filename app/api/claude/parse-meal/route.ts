import { parseMeal } from '@/lib/claude/claude'

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json()

    if (!transcript || typeof transcript !== 'string') {
      return Response.json({ error: 'transcript is required' }, { status: 400 })
    }

    console.log('[parse-meal] Parsing:', transcript)
    const parsed = await parseMeal(transcript)
    console.log('[parse-meal] Success:', JSON.stringify(parsed).slice(0, 200))
    return Response.json(parsed)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error('[parse-meal] FULL ERROR:', message)
    if (stack) console.error('[parse-meal] Stack:', stack)
    return Response.json(
      { error: message },
      { status: 500 }
    )
  }
}
