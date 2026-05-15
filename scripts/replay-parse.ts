// Op FASTRAK Alpha.8 — historical-telemetry replay measurement script.
//
// The §15 measurement spine. Iterates over food_log_entries rows from
// the last N days, re-runs each row's raw_input_text through the
// CURRENT parse-meal route handler (full cascade — response cache,
// library shortcut, segmented shortcut [Alpha.4 mixed-resolution],
// candidates mode, LLM tool-loop [Alpha.1 Promise.all]), captures the
// new _telemetry, and diffs against the historical _telemetry stored
// at parse time.
//
// Why the route, not just runParseMealPipeline:
//   The pipeline measures only the LLM tool-loop layer. The route
//   measures the FULL cascade (cache, shortcut, segmented full,
//   segmented partial, candidates, LLM). Post-Alpha.4 the partial-
//   resolve case is a real win that pipeline-only measurement would
//   miss. Diverges from the original Phase 0 §6 "default mode=local
//   = direct import of runParseMealPipeline" framing — the route is
//   what the user actually hits and what the bundle should be measured
//   against.
//
// Run from the web repo root:
//   npm run replay -- [flags]
//
// Flags:
//   --since=<duration>    default 30d.  Accepts <N>d for days.
//   --json                Emit metrics as JSON to stdout (default:
//                         human-readable table).
//   --no-clear-cache      Skip the cache clear step before replay
//                         (warm-cache run; default is cold-cache).
//   --limit=<N>           Cap utterance count for quick smoke runs.
//   --golden              Replay scripts/fixtures/parse-golden-utterances.json
//                         instead of historical food_log_entries rows.
//
// Cumulative spec carried forward from Alpha sub-fix gates:
//   (a) Clear food_query_cache between runs (Alpha.1).
//   (b) Surface response_cache_hit_rate AND response_cache_write_rate
//       distinctly (Alpha.5).
//   (c) Surface library_segmented_full_hit_rate vs
//       library_segmented_partial_hit_rate distinctly with
//       avg_resolved/unresolved_count (Alpha.4).
//   (d) Whisper telemetry only flows for post-deploy logs; treat
//       missing whisper_* fields gracefully (Alpha.2/3).
//
// FIELD-NAMING CALLOUT (per Phase 0 §6):
//   `cache_hits` (plural) = COUNT of food_query_cache hits inside the
//                            LLM tool loop, recorded inside
//                            telemetry.tool_call_log.
//   `response_cache_hit` (singular) = BOOLEAN, layer-1 transcript-hash
//                            cache hit at the route's first check.
//   These look similar. They are unrelated. Don't conflate.
//
// Telemetry coverage edges:
//   - log_method='quick' rows skip parse-meal entirely → exclude.
//   - Pre-2026-05-03 ~22:00 UTC rows have no _telemetry → exclude
//     via filter on claude_parse_json IS NOT NULL.
//   - Some _telemetry shapes lack library_shortcut_hit field
//     (~2026-05-03 22:28 era) → null-coalesce to false.

import { readFileSync } from 'fs'
import { join } from 'path'

function loadEnvLocal() {
  try {
    const path = join(__dirname, '..', '.env.local')
    const content = readFileSync(path, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch (err) {
    console.warn('Could not load .env.local:', (err as Error).message)
  }
}

loadEnvLocal()

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { POST as parseMealPOST } from '../app/api/claude/parse-meal/route'

// ----- arg parsing -----

interface Args {
  sinceMs: number
  json: boolean
  clearCache: boolean
  limit: number | null
  golden: boolean
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  let sinceMs = 30 * 24 * 60 * 60 * 1000
  let json = false
  let clearCache = true
  let limit: number | null = null
  let golden = false

  for (const arg of argv) {
    if (arg === '--json') json = true
    else if (arg === '--golden') golden = true
    else if (arg === '--no-clear-cache') clearCache = false
    else if (arg.startsWith('--since=')) {
      const val = arg.slice('--since='.length)
      const m = /^(\d+)d$/.exec(val)
      if (m) sinceMs = parseInt(m[1], 10) * 24 * 60 * 60 * 1000
      else throw new Error(`--since must be <N>d (got ${val})`)
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.slice('--limit='.length), 10)
    } else {
      throw new Error(`Unknown arg: ${arg}`)
    }
  }
  return { sinceMs, json, clearCache, limit, golden }
}

// ----- types -----

interface TelemetrySnapshot {
  latency_ms?: number
  tool_calls?: number
  iters?: number
  cache_hits?: number
  response_cache_hit?: boolean
  library_shortcut_hit?: boolean
  library_segmented_hit?: boolean
  library_segmented_partial_hit?: boolean
  library_segmented_resolved_count?: number
  library_segmented_unresolved_count?: number
  library_candidates_hit?: boolean
  fallback_llm_hit?: boolean
  total_route_latency_ms?: number
  cache_lookup_ms?: number
  library_shortcut_lookup_ms?: number
  library_segmented_lookup_ms?: number
  library_candidates_lookup_ms?: number
  llm_latency_ms?: number
  whisper_latency_ms?: number
}

interface FoodLogRow {
  id: string
  user_id: string
  logged_at: string
  log_method: string | null
  raw_input_text: string | null
  claude_parse_json: { _telemetry?: TelemetrySnapshot; foods?: unknown[] } | null
  created_at: string
}

interface ReplayTarget {
  id: string
  raw_input_text: string
  baseline: TelemetrySnapshot
}

interface GoldenUtterance {
  id: string
  transcript: string
  notes?: string
  target_path?: string
}

interface ReplayCase {
  row_id: string
  raw_input_text: string
  baseline: TelemetrySnapshot
  replayed: TelemetrySnapshot
  replay_foods_count: number | null
  replay_error?: string
}

// ----- main -----

async function main() {
  const args = parseArgs()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // (a) Clear food_query_cache + response_cache for fair before/after.
  // food_query_cache is the LLM-loop-internal USDA cache; warm cache
  // would compress sequential cost in pre-Alpha.1 framing. response_cache
  // is the layer-1 cache; we want to measure cold-path latency in the
  // baseline pass.
  if (args.clearCache) {
    process.stderr.write('Clearing food_query_cache + parse_meal_response_cache…\n')
    const fqc = await supabase
      .from('food_query_cache')
      .delete()
      .gt('created_at', '1970-01-01')
    if (fqc.error) console.warn('food_query_cache clear failed:', fqc.error.message)
    const pmrc = await supabase
      .from('parse_meal_response_cache')
      .delete()
      .gt('created_at', '1970-01-01')
    if (pmrc.error) console.warn('parse_meal_response_cache clear failed:', pmrc.error.message)
  }

  const rows = args.golden
    ? loadGoldenTargets()
    : await loadHistoricalTargets(supabase, args.sinceMs)

  const limit = args.limit ?? rows.length
  const target = rows.slice(0, limit)
  process.stderr.write(
    args.golden
      ? `Replaying ${target.length} golden utterances (loaded ${rows.length})…\n`
      : `Replaying ${target.length} utterances (filtered ${rows.length} candidates from last ${args.sinceMs / (24 * 60 * 60 * 1000)}d)…\n`,
  )

  const cases: ReplayCase[] = []
  for (let i = 0; i < target.length; i++) {
    const row = target[i]
    process.stderr.write(`  [${i + 1}/${target.length}] "${row.raw_input_text!.slice(0, 60)}…"`)

    const req = new Request('http://localhost/api/claude/parse-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: row.raw_input_text }),
    })

    const t0 = Date.now()
    let replayed: TelemetrySnapshot = {}
    let replayFoodsCount: number | null = null
    let replayError: string | undefined

    try {
      const res = await parseMealPOST(req)
      const json = (await res.json()) as { _telemetry?: TelemetrySnapshot; foods?: unknown[]; error?: string }
      if (json.error) {
        replayError = json.error
      } else {
        replayed = json._telemetry ?? {}
        replayFoodsCount = Array.isArray(json.foods) ? json.foods.length : null
      }
    } catch (e) {
      replayError = (e as Error).message
    }

    const wallClockMs = Date.now() - t0
    if (typeof replayed.latency_ms !== 'number') replayed.latency_ms = wallClockMs

    process.stderr.write(`  → ${replayError ? 'ERR' : `${replayed.latency_ms}ms`}\n`)

    cases.push({
      row_id: row.id,
      raw_input_text: row.raw_input_text,
      baseline: row.baseline,
      replayed,
      replay_foods_count: replayFoodsCount,
      replay_error: replayError,
    })
  }

  reportMetrics(cases, args)
}

function loadGoldenTargets(): ReplayTarget[] {
  const path = join(__dirname, 'fixtures', 'parse-golden-utterances.json')
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as GoldenUtterance[]
  return parsed.map((item) => ({
    id: item.id,
    raw_input_text: item.transcript,
    baseline: {},
  }))
}

async function loadHistoricalTargets(
  supabase: SupabaseClient,
  sinceMs: number,
): Promise<ReplayTarget[]> {
  // Query historical food_log_entries with parse-meal _telemetry present.
  const sinceIso = new Date(Date.now() - sinceMs).toISOString()
  const queryRes = await supabase
    .from('food_log_entries')
    .select('id, user_id, logged_at, log_method, raw_input_text, claude_parse_json, created_at')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true })
  if (queryRes.error) throw new Error(`food_log_entries query: ${queryRes.error.message}`)

  return ((queryRes.data ?? []) as FoodLogRow[])
    // Filter:
    //   - log_method != 'quick' (skip — bypass parse-meal entirely)
    //   - claude_parse_json._telemetry present (skip pre-instrumentation)
    //   - raw_input_text non-empty
    .filter((r) => {
      if (r.log_method === 'quick') return false
      if (!r.raw_input_text || r.raw_input_text.length === 0) return false
      if (!r.claude_parse_json?._telemetry) return false
      return true
    })
    .map((r) => ({
      id: r.id,
      raw_input_text: r.raw_input_text!,
      baseline: r.claude_parse_json!._telemetry!,
    }))
}

// ----- metrics -----

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const m = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2
}

function p95(arr: number[]): number {
  return percentile(arr, 0.95)
}

function p99(arr: number[]): number {
  return percentile(arr, 0.99)
}

function percentile(arr: number[], pct: number): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.ceil(sorted.length * pct) - 1
  return sorted[Math.min(idx, sorted.length - 1)]
}

function rate(numTrue: number, total: number): number {
  return total === 0 ? 0 : numTrue / total
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((acc, n) => acc + n, 0) / arr.length
}

function numbersFor(cases: ReplayCase[], field: keyof TelemetrySnapshot): number[] {
  return cases
    .map((c) => c.replayed[field])
    .filter((v): v is number => typeof v === 'number')
}

function reportMetrics(cases: ReplayCase[], args: Args) {
  const ok = cases.filter((c) => !c.replay_error)
  const errored = cases.filter((c) => c.replay_error)

  const baselineLatencies = ok
    .map((c) => c.baseline.latency_ms)
    .filter((v): v is number => typeof v === 'number')
  const replayedLatencies = ok
    .map((c) => c.replayed.latency_ms)
    .filter((v): v is number => typeof v === 'number')

  const replayedShortcutHit = ok.filter((c) => c.replayed.library_shortcut_hit === true).length
  const replayedSegFullHit = ok.filter((c) => c.replayed.library_segmented_hit === true).length
  const replayedSegPartialHit = ok.filter(
    (c) => c.replayed.library_segmented_partial_hit === true,
  ).length
  const replayedCandidatesHit = ok.filter((c) => c.replayed.library_candidates_hit === true).length
  const replayedResponseCacheHit = ok.filter((c) => c.replayed.response_cache_hit === true).length

  // (b) response_cache_write_rate proxy: how often did the LLM path execute
  // (= how often would a cache write have occurred). LLM path runs when
  // none of the cascade layers short-circuited.
  const replayedLlmPath = ok.filter(
    (c) =>
      !c.replayed.response_cache_hit &&
      !c.replayed.library_shortcut_hit &&
      !c.replayed.library_segmented_hit &&
      !c.replayed.library_segmented_partial_hit &&
      !c.replayed.library_candidates_hit,
  ).length
  const replayedUnder5s = ok.filter((c) => (c.replayed.latency_ms ?? Infinity) <= 5000).length
  const replayedOver10s = ok.filter((c) => (c.replayed.latency_ms ?? 0) > 10000).length
  const replayedOver20s = ok.filter((c) => (c.replayed.latency_ms ?? 0) > 20000).length

  const baselineShortcutHit = ok.filter((c) => c.baseline.library_shortcut_hit === true).length
  const baselineSegFullHit = ok.filter((c) => c.baseline.library_segmented_hit === true).length

  // (c) avg_resolved/unresolved_count for the partial-hit cases
  const partialResolveCases = ok.filter((c) => c.replayed.library_segmented_partial_hit === true)
  const avgResolved =
    partialResolveCases.length === 0
      ? 0
      : partialResolveCases.reduce(
          (acc, c) => acc + (c.replayed.library_segmented_resolved_count ?? 0),
          0,
        ) / partialResolveCases.length
  const avgUnresolved =
    partialResolveCases.length === 0
      ? 0
      : partialResolveCases.reduce(
          (acc, c) => acc + (c.replayed.library_segmented_unresolved_count ?? 0),
          0,
        ) / partialResolveCases.length

  const meanToolCalls =
    ok.length === 0 ? 0 : ok.reduce((acc, c) => acc + (c.replayed.tool_calls ?? 0), 0) / ok.length
  const meanIters =
    ok.length === 0 ? 0 : ok.reduce((acc, c) => acc + (c.replayed.iters ?? 0), 0) / ok.length
  const fallbackCases = ok.filter(
    (c) =>
      c.replayed.fallback_llm_hit === true ||
      (!c.replayed.response_cache_hit &&
        !c.replayed.library_shortcut_hit &&
        !c.replayed.library_segmented_hit &&
        !c.replayed.library_segmented_partial_hit &&
        !c.replayed.library_candidates_hit),
  )

  const metrics = {
    cases_total: cases.length,
    cases_ok: ok.length,
    cases_errored: errored.length,
    latency_baseline_median_ms: median(baselineLatencies),
    latency_baseline_p95_ms: p95(baselineLatencies),
    latency_baseline_p99_ms: p99(baselineLatencies),
    latency_replay_median_ms: median(replayedLatencies),
    latency_replay_p95_ms: p95(replayedLatencies),
    latency_replay_p99_ms: p99(replayedLatencies),
    latency_delta_median_ms: median(replayedLatencies) - median(baselineLatencies),
    sla_under_5s_rate_replay: rate(replayedUnder5s, ok.length),
    over_10s_rate_replay: rate(replayedOver10s, ok.length),
    over_20s_rate_replay: rate(replayedOver20s, ok.length),
    library_shortcut_hit_rate_baseline: rate(baselineShortcutHit, ok.length),
    library_shortcut_hit_rate_replay: rate(replayedShortcutHit, ok.length),
    library_segmented_full_hit_rate_baseline: rate(baselineSegFullHit, ok.length),
    library_segmented_full_hit_rate_replay: rate(replayedSegFullHit, ok.length),
    library_segmented_partial_hit_rate_replay: rate(replayedSegPartialHit, ok.length),
    library_candidates_hit_rate_replay: rate(replayedCandidatesHit, ok.length),
    response_cache_hit_rate_replay: rate(replayedResponseCacheHit, ok.length),
    response_cache_write_rate_replay: rate(replayedLlmPath, ok.length),
    fallback_llm_rate_replay: rate(replayedLlmPath, ok.length),
    partial_resolve_avg_resolved_count: avgResolved,
    partial_resolve_avg_unresolved_count: avgUnresolved,
    mean_tool_calls_replay: meanToolCalls,
    mean_iters_replay: meanIters,
    avg_total_route_latency_ms: mean(numbersFor(ok, 'total_route_latency_ms')),
    avg_cache_lookup_ms: mean(numbersFor(ok, 'cache_lookup_ms')),
    avg_library_shortcut_lookup_ms: mean(numbersFor(ok, 'library_shortcut_lookup_ms')),
    avg_library_segmented_lookup_ms: mean(numbersFor(ok, 'library_segmented_lookup_ms')),
    avg_library_candidates_lookup_ms: mean(numbersFor(ok, 'library_candidates_lookup_ms')),
    avg_llm_latency_ms: mean(numbersFor(fallbackCases, 'llm_latency_ms')),
    avg_whisper_latency_ms: mean(numbersFor(ok, 'whisper_latency_ms')),
  }

  if (args.json) {
    process.stdout.write(JSON.stringify({ metrics, cases }, null, 2) + '\n')
    return
  }

  // Human-readable table
  console.log('')
  console.log('═══ Op FASTRAK Alpha.8 — replay measurement ═══')
  console.log('')
  console.log(`Cases:                                ${metrics.cases_ok} ok / ${metrics.cases_errored} errored / ${metrics.cases_total} total`)
  console.log('')
  console.log('LATENCY (baseline = stored ._telemetry from original parse)')
  console.log(`  baseline median ms:                 ${metrics.latency_baseline_median_ms}`)
  console.log(`  baseline p95 ms:                    ${metrics.latency_baseline_p95_ms}`)
  console.log(`  baseline p99 ms:                    ${metrics.latency_baseline_p99_ms}`)
  console.log(`  replay   median ms:                 ${metrics.latency_replay_median_ms}`)
  console.log(`  replay   p95 ms:                    ${metrics.latency_replay_p95_ms}`)
  console.log(`  replay   p99 ms:                    ${metrics.latency_replay_p99_ms}`)
  console.log(`  median delta (replay - baseline):   ${metrics.latency_delta_median_ms} ms`)
  console.log(`  SLA <= 5s rate:                     ${(metrics.sla_under_5s_rate_replay * 100).toFixed(1)}%`)
  console.log(`  over 10s rate:                      ${(metrics.over_10s_rate_replay * 100).toFixed(1)}%`)
  console.log(`  over 20s rate:                      ${(metrics.over_20s_rate_replay * 100).toFixed(1)}%`)
  console.log('')
  console.log('CASCADE HIT RATES (replay run)')
  console.log(`  library_shortcut_hit:               ${(metrics.library_shortcut_hit_rate_replay * 100).toFixed(1)}%   (baseline ${(metrics.library_shortcut_hit_rate_baseline * 100).toFixed(1)}%)`)
  console.log(`  library_segmented_full_hit:         ${(metrics.library_segmented_full_hit_rate_replay * 100).toFixed(1)}%   (baseline ${(metrics.library_segmented_full_hit_rate_baseline * 100).toFixed(1)}%)`)
  console.log(`  library_segmented_partial_hit:      ${(metrics.library_segmented_partial_hit_rate_replay * 100).toFixed(1)}%   (Alpha.4 NEW — baseline always 0%)`)
  console.log(`  library_candidates_hit:             ${(metrics.library_candidates_hit_rate_replay * 100).toFixed(1)}%`)
  console.log(`  response_cache_hit:                 ${(metrics.response_cache_hit_rate_replay * 100).toFixed(1)}%`)
  console.log(`  response_cache_write_rate (proxy):  ${(metrics.response_cache_write_rate_replay * 100).toFixed(1)}%`)
  console.log(`  fallback_llm_rate:                  ${(metrics.fallback_llm_rate_replay * 100).toFixed(1)}%`)
  console.log('')
  console.log('PARTIAL-RESOLVE BREAKDOWN (Alpha.4)')
  console.log(`  avg resolved per partial case:      ${metrics.partial_resolve_avg_resolved_count.toFixed(2)}`)
  console.log(`  avg unresolved per partial case:    ${metrics.partial_resolve_avg_unresolved_count.toFixed(2)}`)
  console.log('')
  console.log('LLM-LOOP MEAN COSTS (replay)')
  console.log(`  mean tool_calls:                    ${metrics.mean_tool_calls_replay.toFixed(2)}`)
  console.log(`  mean iters:                         ${metrics.mean_iters_replay.toFixed(2)}`)
  console.log('')
  console.log('STAGE TIMINGS (mean ms where present)')
  console.log(`  total route:                        ${metrics.avg_total_route_latency_ms.toFixed(0)}`)
  console.log(`  response cache lookup:              ${metrics.avg_cache_lookup_ms.toFixed(0)}`)
  console.log(`  library shortcut lookup:            ${metrics.avg_library_shortcut_lookup_ms.toFixed(0)}`)
  console.log(`  segmented lookup:                   ${metrics.avg_library_segmented_lookup_ms.toFixed(0)}`)
  console.log(`  candidates lookup:                  ${metrics.avg_library_candidates_lookup_ms.toFixed(0)}`)
  console.log(`  LLM fallback/partial:               ${metrics.avg_llm_latency_ms.toFixed(0)}`)
  console.log(`  Whisper client telemetry:           ${metrics.avg_whisper_latency_ms.toFixed(0)}`)
  console.log('')
  console.log('PER-CASE DETAIL (top 10 by replay latency)')
  const detailRows = [...ok]
    .sort((a, b) => (b.replayed.latency_ms ?? 0) - (a.replayed.latency_ms ?? 0))
    .slice(0, 10)
  console.log('  baseline → replay   path                     transcript')
  for (const c of detailRows) {
    const path = c.replayed.response_cache_hit
      ? 'cache'
      : c.replayed.library_shortcut_hit
      ? 'shortcut'
      : c.replayed.library_segmented_hit
      ? 'seg-full'
      : c.replayed.library_segmented_partial_hit
      ? 'seg-partial'
      : c.replayed.library_candidates_hit
      ? 'candidates'
      : 'llm'
    const baseLatency = c.baseline.latency_ms ?? 0
    const replayLatency = c.replayed.latency_ms ?? 0
    console.log(
      `  ${String(baseLatency).padStart(6)}ms → ${String(replayLatency).padStart(6)}ms  ${path.padEnd(12)}  "${c.raw_input_text.slice(0, 50)}${c.raw_input_text.length > 50 ? '…' : ''}"`,
    )
  }
  if (errored.length > 0) {
    console.log('')
    console.log('ERRORED CASES')
    for (const c of errored) console.log(`  ${c.row_id}  "${c.raw_input_text.slice(0, 50)}…"  ${c.replay_error}`)
  }
  console.log('')
}

main().catch((err) => {
  console.error('Replay FAILED:', err)
  process.exit(1)
})
