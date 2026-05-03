// S26 Step 3 — calls runParseMealPipeline directly so we can surface
// telemetry (tokens, latency, tool-call summary) into Vercel Functions
// logs. parseMeal() wrapper in lib/claude/claude.ts is gone; library
// context is resolved here from the single-tenant users row.

import { runParseMealPipeline, summarizeToolCalls } from '@/lib/claude/parse-meal-pipeline'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json()

    if (!transcript || typeof transcript !== 'string') {
      return Response.json({ error: 'transcript is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id')
      .limit(1)
      .single()
    if (userErr || !userRow) {
      console.error('[parse-meal] failed to resolve user:', userErr?.message)
      return Response.json({ error: 'no user' }, { status: 500 })
    }

    console.log('[parse-meal] Parsing:', transcript)
    const { result, telemetry } = await runParseMealPipeline(transcript, {
      library: { userId: userRow.id, supabase },
    })

    console.log({
      type: 'parse_meal_telemetry',
      latency_ms: telemetry.latency_ms,
      input_tokens: telemetry.input_tokens,
      output_tokens: telemetry.output_tokens,
      iters: telemetry.iters,
      tool_calls_summary: summarizeToolCalls(telemetry.tool_call_log),
      stop_reason: telemetry.stop_reason,
    })

    if (!result) {
      return Response.json(
        { error: 'pipeline returned no parseable JSON', telemetry },
        { status: 502 },
      )
    }
    return Response.json({
      ...result,
      _telemetry: {
        latency_ms: telemetry.latency_ms,
        tool_calls: telemetry.tool_calls,
        iters: telemetry.iters,
        cache_hits: telemetry.cache_hits,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error('[parse-meal] FULL ERROR:', message)
    if (stack) console.error('[parse-meal] Stack:', stack)
    return Response.json({ error: message }, { status: 500 })
  }
}
