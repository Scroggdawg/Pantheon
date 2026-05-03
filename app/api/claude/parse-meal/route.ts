// S26 Step 4e — pre-pipeline transcript-level response cache.
// S26 Step 4f — single-hit library shortcut.
// S26 Step 4g — multi-hit library candidates mode.
//
// Order of operations:
//   1. Response cache lookup (Step 4e — exact-transcript hash)
//   2. Library shortcut single-hit (Step 4f — high-confidence)
//   3. Library candidates mode (Step 4g — 2+ plausible matches)
//   4. Sonnet synthesis (existing fallback path)
//
// Layers 1-3 return ~100-200ms. Sonnet path runs ~7-19s and
// writes its result to the response cache on success.
// Layers 2+3 do NOT write cache — library lookups are already
// fast and a candidates-mode response isn't the user's final
// pick.

import {
  tryLibraryCandidates,
  tryLibraryShortcut,
} from '@/lib/claude/parse-meal-library-shortcut'
import { runParseMealPipeline, summarizeToolCalls } from '@/lib/claude/parse-meal-pipeline'
import {
  lookupResponseCache,
  writeResponseCache,
} from '@/lib/claude/parse-meal-response-cache'
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
    const userId = userRow.id

    // Step 4e — response cache lookup
    const cacheStarted = Date.now()
    const cachedResponse = await lookupResponseCache(supabase, userId, transcript)
    const cacheLookupMs = Date.now() - cacheStarted

    if (cachedResponse) {
      console.log({
        type: 'parse_meal_telemetry',
        latency_ms: cacheLookupMs,
        response_cache_hit: true,
        library_shortcut_hit: false,
        library_candidates_hit: false,
      })
      return Response.json({
        ...cachedResponse,
        _telemetry: {
          latency_ms: cacheLookupMs,
          response_cache_hit: true,
          library_shortcut_hit: false,
          library_candidates_hit: false,
          tool_calls: 0,
          iters: 0,
          cache_hits: 0,
        },
      })
    }

    // Step 4f — library shortcut (single high-confidence hit)
    const shortcutStarted = Date.now()
    const shortcut = await tryLibraryShortcut(supabase, userId, transcript)
    const shortcutLookupMs = Date.now() - shortcutStarted

    if (shortcut?.hit) {
      console.log({
        type: 'parse_meal_telemetry',
        latency_ms: shortcutLookupMs,
        library_shortcut_hit: true,
        library_shortcut_top_score: shortcut.top_score,
        library_shortcut_gap: shortcut.gap,
        library_candidates_hit: false,
        response_cache_hit: false,
      })
      return Response.json({
        ...shortcut.response,
        _telemetry: {
          latency_ms: shortcutLookupMs,
          library_shortcut_hit: true,
          library_candidates_hit: false,
          response_cache_hit: false,
          tool_calls: 0,
          iters: 0,
          cache_hits: 0,
        },
      })
    }

    // Step 4g — library candidates mode (2+ plausible matches)
    const candidatesStarted = Date.now()
    const candidates = await tryLibraryCandidates(supabase, userId, transcript)
    const candidatesLookupMs = Date.now() - candidatesStarted

    if (candidates?.hit) {
      console.log({
        type: 'parse_meal_telemetry',
        latency_ms: candidatesLookupMs,
        library_candidates_hit: true,
        library_candidates_count: candidates.candidate_count,
        library_candidates_top_score: candidates.top_score,
        library_shortcut_hit: false,
        response_cache_hit: false,
      })
      return Response.json({
        ...candidates.response,
        _telemetry: {
          latency_ms: candidatesLookupMs,
          library_candidates_hit: true,
          library_shortcut_hit: false,
          response_cache_hit: false,
          tool_calls: 0,
          iters: 0,
          cache_hits: 0,
        },
      })
    }

    console.log('[parse-meal] Parsing:', transcript)
    const { result, telemetry } = await runParseMealPipeline(transcript, {
      library: { userId, supabase },
    })

    console.log({
      type: 'parse_meal_telemetry',
      latency_ms: telemetry.latency_ms,
      input_tokens: telemetry.input_tokens,
      output_tokens: telemetry.output_tokens,
      iters: telemetry.iters,
      tool_calls_summary: summarizeToolCalls(telemetry.tool_call_log),
      stop_reason: telemetry.stop_reason,
      response_cache_hit: false,
      library_shortcut_hit: false,
      library_shortcut_top_score: shortcut?.top_score,
      library_candidates_hit: false,
    })

    if (!result) {
      return Response.json(
        { error: 'pipeline returned no parseable JSON', telemetry },
        { status: 502 },
      )
    }

    // Step 4e — response cache write (best-effort, awaited for
    // serverless correctness)
    await writeResponseCache(supabase, userId, transcript, result)

    return Response.json({
      ...result,
      _telemetry: {
        latency_ms: telemetry.latency_ms,
        tool_calls: telemetry.tool_calls,
        iters: telemetry.iters,
        cache_hits: telemetry.cache_hits,
        response_cache_hit: false,
        library_shortcut_hit: false,
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
