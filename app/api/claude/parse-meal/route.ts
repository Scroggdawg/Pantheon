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
  tryLibrarySegmentedShortcut,
  tryLibraryShortcut,
  tryProteinShakeIngredientShortcut,
} from '@/lib/claude/parse-meal-library-shortcut'
import { runParseMealPipeline, summarizeToolCalls } from '@/lib/claude/parse-meal-pipeline'
import {
  lookupResponseCache,
  writeResponseCache,
} from '@/lib/claude/parse-meal-response-cache'
import { createClient } from '@/lib/supabase/server'
import type { FoodItem } from '@/types/database'

const MAX_TRANSCRIPT_CHARS = 2000

const QUANTITY_DESCRIPTOR_TOKENS = new Set([
  'a',
  'an',
  'and',
  'bag',
  'bags',
  'box',
  'container',
  'containers',
  'entire',
  'full',
  'half',
  'kit',
  'of',
  'one',
  'ounce',
  'ounces',
  'oz',
  'package',
  'serving',
  'servings',
  'the',
  'whole',
])

function isNumericToken(token: string): boolean {
  return /^\d+(?:\.\d+)?$/.test(token) || /^\d+\/\d+$/.test(token)
}

function isQuantityOnlySegment(value: string): boolean {
  const tokens = value
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9/.]+/)
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length === 0) return false

  let hasQuantitySignal = false
  for (const token of tokens) {
    if (isNumericToken(token) || QUANTITY_DESCRIPTOR_TOKENS.has(token)) {
      hasQuantitySignal = true
      continue
    }
    return false
  }

  return hasQuantitySignal
}

// Op FASTRAK Alpha.3 layer 3 — accept whisper telemetry forwarded from
// the transcribe route (via the native client; web uses Web Speech API
// and never has whisper data) and merge into _telemetry. Fields are
// namespaced (whisper_*) so they can't collide with parse-meal's own
// telemetry fields. All four are optional — pre-Alpha.3 clients omit
// the wrapper entirely; older food_log_entries simply lack these fields.
interface WhisperTelemetry {
  whisper_audio_duration_ms?: number
  whisper_latency_ms?: number
  whisper_prompt_tokens?: number
  whisper_prompt_truncated?: boolean
}

export async function POST(request: Request) {
  const routeStarted = Date.now()
  try {
    const body = await request.json()
    const transcript = body?.transcript
    const whisperTelemetry: WhisperTelemetry = body?.whisper_telemetry ?? {}

    if (!transcript || typeof transcript !== 'string') {
      return Response.json({ error: 'transcript is required' }, { status: 400 })
    }
    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      return Response.json(
        { error: `transcript must be ${MAX_TRANSCRIPT_CHARS} characters or less` },
        { status: 413 },
      )
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

    // Narrow deterministic shortcut for Luke's Isopure + NutriCost shake
    // variants. Run before returning response-cache hits so stale cached
    // LLM outputs cannot keep double-counting protein after this fix.
    const shakeStarted = Date.now()
    const shake = await tryProteinShakeIngredientShortcut(supabase, userId, transcript)
    const shakeLookupMs = Date.now() - shakeStarted

    if (shake?.hit) {
      console.log({
        type: 'parse_meal_telemetry',
        latency_ms: shakeLookupMs,
        protein_shake_ingredient_shortcut_hit: true,
        protein_shake_lookup_count: shake.lookup_count ?? 0,
        response_cache_hit: false,
      })
      return Response.json({
        ...shake.response,
        _telemetry: {
          latency_ms: shakeLookupMs,
          protein_shake_ingredient_shortcut_hit: true,
          protein_shake_lookup_count: shake.lookup_count ?? 0,
          response_cache_hit: false,
          library_shortcut_hit: false,
          library_candidates_hit: false,
          tool_calls: 0,
          iters: 0,
          cache_hits: 0,
          total_route_latency_ms: Date.now() - routeStarted,
          cache_lookup_ms: cacheLookupMs,
          protein_shake_lookup_ms: shakeLookupMs,
          ...whisperTelemetry,
        },
      })
    }

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
          total_route_latency_ms: Date.now() - routeStarted,
          cache_lookup_ms: cacheLookupMs,
          ...whisperTelemetry,
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
          total_route_latency_ms: Date.now() - routeStarted,
          cache_lookup_ms: cacheLookupMs,
          library_shortcut_lookup_ms: shortcutLookupMs,
          ...whisperTelemetry,
        },
      })
    }

    // Step 4f.5 + Op FASTRAK Alpha.4 — mixed-resolution segmented shortcut.
    // Pre-Alpha.4 this returned only on full-resolve; now it returns
    // resolved+unresolved arrays so the route can handle partial cases by
    // running the LLM pipeline ONLY on the unresolved subset.
    const segStarted = Date.now()
    const segmented = await tryLibrarySegmentedShortcut(supabase, userId, transcript)
    const segLookupMs = Date.now() - segStarted

    if (segmented && segmented.unresolved.length === 0) {
      // FULL RESOLVE — same behavior as the pre-Alpha.4 happy path.
      // Assemble ParsedMealResponse from resolved foods (sorted by
      // position to preserve user-perceived ordering).
      const sortedResolved = [...segmented.resolved].sort(
        (a, b) => a.position - b.position,
      )
      const foods = sortedResolved.map((r) => r.food)
      const totalCal = foods.reduce((acc, f) => acc + f.calories, 0)
      const totalProt = foods.reduce((acc, f) => acc + f.protein_g, 0)
      const totalCarbs = foods.reduce((acc, f) => acc + f.carbs_g, 0)
      const totalFat = foods.reduce((acc, f) => acc + f.fat_g, 0)

      console.log({
        type: 'parse_meal_telemetry',
        latency_ms: segLookupMs,
        library_segmented_hit: true,
        library_segmented_segment_count: segmented.segment_count,
        library_segmented_segment_scores: sortedResolved.map((r) => r.score),
        library_shortcut_hit: false,
        library_candidates_hit: false,
        response_cache_hit: false,
      })
      return Response.json({
        foods,
        total_calories: Math.round(totalCal),
        total_protein_g: Math.round(totalProt * 100) / 100,
        total_carbs_g: Math.round(totalCarbs * 100) / 100,
        total_fat_g: Math.round(totalFat * 100) / 100,
        clarification_needed: null,
        disambiguation: null,
        _telemetry: {
          latency_ms: segLookupMs,
          library_segmented_hit: true,
          library_shortcut_hit: false,
          library_candidates_hit: false,
          response_cache_hit: false,
          tool_calls: 0,
          iters: 0,
          cache_hits: 0,
          total_route_latency_ms: Date.now() - routeStarted,
          cache_lookup_ms: cacheLookupMs,
          library_shortcut_lookup_ms: shortcutLookupMs,
          library_segmented_lookup_ms: segLookupMs,
          ...whisperTelemetry,
        },
      })
    }

    if (segmented && segmented.resolved.length > 0 && segmented.unresolved.length > 0) {
      const unresolvedForLlm = segmented.unresolved.filter(
        (u) => !isQuantityOnlySegment(u.original_segment),
      )
      const ignoredQuantityOnly = segmented.unresolved.filter((u) =>
        isQuantityOnlySegment(u.original_segment),
      )

      if (unresolvedForLlm.length === 0) {
        const sortedResolved = [...segmented.resolved].sort(
          (a, b) => a.position - b.position,
        )
        const foods = sortedResolved.map((r) => r.food)
        const totalCal = foods.reduce((acc, f) => acc + f.calories, 0)
        const totalProt = foods.reduce((acc, f) => acc + f.protein_g, 0)
        const totalCarbs = foods.reduce((acc, f) => acc + f.carbs_g, 0)
        const totalFat = foods.reduce((acc, f) => acc + f.fat_g, 0)

        console.log({
          type: 'parse_meal_telemetry',
          latency_ms: segLookupMs,
          library_segmented_partial_hit: true,
          library_segmented_quantity_only_ignored_count: ignoredQuantityOnly.length,
          library_segmented_resolved_count: segmented.resolved.length,
          library_segmented_unresolved_count: 0,
          library_segmented_ignored_segments: ignoredQuantityOnly.map(
            (u) => u.original_segment,
          ),
          response_cache_hit: false,
          library_shortcut_hit: false,
        })

        return Response.json({
          foods,
          total_calories: Math.round(totalCal),
          total_protein_g: Math.round(totalProt * 100) / 100,
          total_carbs_g: Math.round(totalCarbs * 100) / 100,
          total_fat_g: Math.round(totalFat * 100) / 100,
          clarification_needed: null,
          disambiguation: null,
          _telemetry: {
            latency_ms: segLookupMs,
            tool_calls: 0,
            iters: 0,
            cache_hits: 0,
            response_cache_hit: false,
            library_shortcut_hit: false,
            library_segmented_partial_hit: true,
            library_segmented_quantity_only_ignored_count: ignoredQuantityOnly.length,
            library_segmented_resolved_count: segmented.resolved.length,
            library_segmented_unresolved_count: 0,
            fallback_llm_hit: false,
            total_route_latency_ms: Date.now() - routeStarted,
            cache_lookup_ms: cacheLookupMs,
            library_shortcut_lookup_ms: shortcutLookupMs,
            library_segmented_lookup_ms: segLookupMs,
            llm_latency_ms: 0,
            ...whisperTelemetry,
          },
        })
      }

      // PARTIAL RESOLVE — run LLM pipeline on the unresolved subset only,
      // then merge with library-resolved foods by position.
      //
      // Sub-transcript shape: comma-joined unresolved ORIGINAL segments
      // (Alpha.4.1 fix — pre-fix this used the stripped form, which the
      // LLM couldn't parse on cases where filler removal degraded the
      // fragment into gibberish; the replay script caught the regression
      // on "Double espresso, with half an ounce of half and half, …" →
      // "with half half half"). Phase 0 §7 considered passing the full
      // transcript with <resolved> annotations to preserve cross-item
      // context; we keep the "send only unresolved fragments, in their
      // natural-language form" path. If a real cross-item-context case
      // surfaces, switch to annotated-full.
      const subTranscript = unresolvedForLlm
        .map((u) => u.original_segment)
        .join(', ')

      console.log('[parse-meal] Alpha.4 partial-resolve:', {
        resolved_count: segmented.resolved.length,
        unresolved_count: unresolvedForLlm.length,
        ignored_quantity_only_count: ignoredQuantityOnly.length,
        sub_transcript: subTranscript,
        resolved_originals: segmented.resolved.map((r) => r.original_segment),
        unresolved_originals: unresolvedForLlm.map((u) => u.original_segment),
        ignored_originals: ignoredQuantityOnly.map((u) => u.original_segment),
      })

      const llmStarted = Date.now()
      const { result: llmResult, telemetry: llmTel } = await runParseMealPipeline(
        subTranscript,
        { library: { userId, supabase } },
      )
      const llmLatencyMs = Date.now() - llmStarted
      const totalLatencyMs = segLookupMs + llmLatencyMs

      if (!llmResult) {
        // LLM step on the unresolved subset returned no parseable JSON.
        // Surface as 502 (same shape as the all-LLM-fail case below).
        return Response.json(
          {
            error: 'partial-resolve LLM step returned no parseable JSON',
            telemetry: llmTel,
          },
          { status: 502 },
        )
      }

      // Merge: resolved foods first (in position order), then LLM foods
      // appended in their emit order. LLM cardinality may not match
      // segment cardinality (one segment can decompose into multiple
      // foods), so strict position-alignment isn't possible across the
      // boundary; "library foods first, LLM foods after" is the
      // pragmatic ordering that preserves user-perceived order on the
      // common case.
      const sortedResolved = [...segmented.resolved].sort(
        (a, b) => a.position - b.position,
      )
      const foods: FoodItem[] = [
        ...sortedResolved.map((r) => r.food),
        ...llmResult.foods,
      ]
      const totalCal = foods.reduce((acc, f) => acc + f.calories, 0)
      const totalProt = foods.reduce((acc, f) => acc + f.protein_g, 0)
      const totalCarbs = foods.reduce((acc, f) => acc + f.carbs_g, 0)
      const totalFat = foods.reduce((acc, f) => acc + f.fat_g, 0)

      console.log({
        type: 'parse_meal_telemetry',
        latency_ms: totalLatencyMs,
        library_segmented_partial_hit: true,
        library_segmented_resolved_count: segmented.resolved.length,
        library_segmented_unresolved_count: unresolvedForLlm.length,
        library_segmented_resolved_segments: sortedResolved.map((r) => r.segment),
        library_segmented_unresolved_segments: unresolvedForLlm.map(
          (u) => u.segment,
        ),
        library_segmented_quantity_only_ignored_count: ignoredQuantityOnly.length,
        llm_iters: llmTel.iters,
        llm_tool_calls: llmTel.tool_calls,
        llm_cache_hits: llmTel.cache_hits,
        response_cache_hit: false,
        library_shortcut_hit: false,
      })

      // We do NOT writeResponseCache here. A cached response keyed on the
      // FULL transcript that internally mixes library hits + LLM output
      // is brittle: if the underlying saved_meal changes, the cached
      // hit becomes stale, and re-resolving the library portion is
      // already cheap (~100ms). Cache writes stay scoped to the
      // pure-LLM path.
      return Response.json({
        foods,
        total_calories: Math.round(totalCal),
        total_protein_g: Math.round(totalProt * 100) / 100,
        total_carbs_g: Math.round(totalCarbs * 100) / 100,
        total_fat_g: Math.round(totalFat * 100) / 100,
        clarification_needed: llmResult.clarification_needed ?? null,
        disambiguation: llmResult.disambiguation ?? null,
        _telemetry: {
          latency_ms: totalLatencyMs,
          tool_calls: llmTel.tool_calls,
          iters: llmTel.iters,
          cache_hits: llmTel.cache_hits,
          response_cache_hit: false,
          library_shortcut_hit: false,
          library_segmented_partial_hit: true,
          library_segmented_resolved_count: segmented.resolved.length,
          library_segmented_unresolved_count: unresolvedForLlm.length,
          library_segmented_quantity_only_ignored_count: ignoredQuantityOnly.length,
          fallback_llm_hit: false,
          total_route_latency_ms: Date.now() - routeStarted,
          cache_lookup_ms: cacheLookupMs,
          library_shortcut_lookup_ms: shortcutLookupMs,
          library_segmented_lookup_ms: segLookupMs,
          llm_latency_ms: llmLatencyMs,
          ...whisperTelemetry,
        },
      })
    }
    // segmented === null → fall through to 4g (candidates mode) below.

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
        library_segmented_hit: false,
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
          total_route_latency_ms: Date.now() - routeStarted,
          cache_lookup_ms: cacheLookupMs,
          library_shortcut_lookup_ms: shortcutLookupMs,
          library_segmented_lookup_ms: segLookupMs,
          library_candidates_lookup_ms: candidatesLookupMs,
          ...whisperTelemetry,
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
      library_segmented_hit: false,
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
        fallback_llm_hit: true,
        total_route_latency_ms: Date.now() - routeStarted,
        cache_lookup_ms: cacheLookupMs,
        library_shortcut_lookup_ms: shortcutLookupMs,
        library_segmented_lookup_ms: segLookupMs,
        library_candidates_lookup_ms: candidatesLookupMs,
        llm_latency_ms: telemetry.latency_ms,
        ...whisperTelemetry,
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
