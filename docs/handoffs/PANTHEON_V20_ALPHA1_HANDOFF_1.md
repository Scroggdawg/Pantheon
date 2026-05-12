# Pantheon — Alpha.1 Gate 1 Handoff

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude — Gate 1 review on Alpha.1
**Mode:** Sub-fix 2 of 6 in Alpha-ex-6 bundle. Local commit, not pushed.

---

## §0 — Status

Alpha.1 (Promise.all the tool dispatcher) shipped clean. Type-check green. Smoke against the "Three shrimp fajitas…" screenshot meal completed end-to-end with measurable per-iter parallel savings.

**Commit:** `33c04f9 S27 Op FASTRAK Alpha.1: Promise.all the tool dispatcher` (1 file, +54/-20)

Awaiting Gate 1 greenlight before moving to Alpha.5 (response cache bust granularity).

---

## §1 — What changed

`lib/claude/parse-meal-pipeline.ts` lines 268-310 — the entire `if (resp.stop_reason === 'tool_use') { … }` block restructured into three discrete passes:

```typescript
if (resp.stop_reason === 'tool_use') {
  // 1. Pre-pass: synchronous text-block accumulation.
  //    Preserves trailing '\n' separator (differs from end_turn branch
  //    which has no newline; do NOT collapse).
  for (const block of resp.content) {
    if (block.type === 'text') finalText += (block as TextBlock).text + '\n'
  }

  // 2. Parallel dispatch over tool_use blocks. Promise.all preserves
  //    array order in resolution, so iterating `dispatched` later
  //    matches the source order of tool_use blocks in resp.content.
  //    Each promise body has its own try/catch; errors return
  //    { error: ... } rather than rejecting Promise.all.
  //    Per-call timing captured INSIDE each promise.
  const toolUseBlocks = resp.content.filter(
    (b): b is ToolUseBlock => b.type === 'tool_use',
  )
  const dispatched = await Promise.all(
    toolUseBlocks.map(async (tu) => {
      const t0 = Date.now()
      let out: unknown
      try {
        out = await dispatchTool(tu.name, tu.input as Record<string, unknown>)
      } catch (e) {
        const err = e as Error
        out = { error: `${err.name}: ${err.message}` }
      }
      const cacheHit =
        tu.name === 'search_food_database' &&
        typeof out === 'object' &&
        out !== null &&
        (out as { _cache_hit?: boolean })._cache_hit === true
      return { tu, out, duration_ms: Date.now() - t0, cache_hit: cacheHit }
    }),
  )

  // 3. Post-pass: push log + tool_results in original block order.
  const toolResults: ToolResultBlockParam[] = []
  for (const { tu, out, duration_ms, cache_hit } of dispatched) {
    toolCallLog.push({
      iter: it,
      tool: tu.name,
      args: tu.input as Record<string, unknown>,
      result_summary: summarizeToolResult(tu.name, out),
      duration_ms,
      cache_hit,
    })
    toolResults.push({
      type: 'tool_result',
      tool_use_id: tu.id,
      content: JSON.stringify(out),
    })
  }

  messages.push({ role: 'user', content: toolResults })
  continue
}
```

`messages.push({ role: 'assistant', content: resp.content })` at line 259 untouched (per the locked shape).

---

## §2 — Smoke replay against the screenshot meal

I wrote a throwaway `scripts/scratch-alpha1-smoke.ts` (deleted post-run, not in commit) following `scripts/test-segmented-library.ts`'s env-loading + service-role pattern. Ran once against the verbatim "Three shrimp fajitas…" transcript.

**Top-line numbers:**

```
Total wall-clock:     51,836 ms   (vs 59,586 ms baseline = 7.7s saved)
telemetry.latency_ms: 51,836 ms
iters:                5            (was 6 — LLM converged faster this run)
tool_calls:           22           (matches baseline)
cache_hits:           7            (food_query_cache hits — populated by prior runs)
stop_reason:          end_turn     (parse completed cleanly)
foods returned:       8            (matches baseline)
```

**Per-iter dispatcher savings (the load-bearing measurement):**

```
iter | calls | max_ms (parallel) | sum_ms (was sequential cost) | savings | tools
  0  |    9  |       395          |          3301                 |   2906  | 9× search_user_library
  1  |    7  |       974          |          3394                 |   2420  | 7× search_food_database
  2  |    4  |       555          |           970                 |    415  | 4× search_food_database
  3  |    2  |      1161          |          1660                 |    499  | 2× search_food_database
```

**Total dispatcher savings: ~6,240 ms (~6.2s) across this parse.** The remaining ~1.5s of the 7.7s wall-clock improvement vs baseline is iter-count variance (5 vs 6 LLM iters this run; not Alpha.1's contribution).

**Plausibility check on per-call durations:** range 50-1500ms, consistent with the mix of (cached USDA hits) + (cold USDA fetches via Supabase + HTTP) + (saved_meals + products parallel reads). No outliers, no calls completing instantly (would suggest race condition).

---

## §3 — Gate 1 spec checklist

| Spec from V20's brief | Status |
|---|---|
| Type-check passes | ✅ `npx tsc --noEmit` exit 0 |
| Manually replay one multi-item utterance from food_log_entries | ✅ replayed the screenshot meal verbatim |
| Confirm tool_results match tool_use order | ✅ structurally guaranteed (Promise.all preserves order; post-pass iterates `dispatched` array in same order); verified empirically by clean `stop_reason: end_turn` and 8 valid foods returned (LLM would have errored on tool_use_id mismatches) |
| Confirm toolCallLog per-call durations are plausible | ✅ 50-1500ms range, max << sum within each iter, consistent with cache mix |

Per Phase 0 §1's three discipline points, all preserved verbatim:
- ✅ Trailing-newline divergence — tool_use turn appends with `\n`, end_turn turn (untouched, lines 261-265) without
- ✅ Per-call timing inside each promise (verified via plausible per-call duration_ms)
- ✅ Error isolation per task — each promise body has its own try/catch returning `{error: ...}`

---

## §4 — Plan re-evaluation (per doctrine amendment)

**The Alpha.1 win on this single parse: ~7.7s wall-clock improvement, ~6.2s of which is dispatcher-attributable.** That's at the high end of Phase 0's 30-50% claim on the dispatcher contribution (~12-18s estimated savings on the full 59.6s parse), now empirically narrowed to ~6.2s on this particular replay.

**Why narrower than Phase 0's 12-18s estimate:**
- The replay benefited from cached food_query_cache hits (7 hits vs 0 baseline), which already reduced sequential dispatch cost. Pre-Alpha.1 with 7 cache hits would have been faster than the 59.6s baseline too.
- Per-call durations are smaller in absolute terms when caches are warm. Parallel savings scale with the SUM of per-call times within an iter, so warm caches compress both sum and max.

**Implication for the bundle measurement (Alpha.8):** the replay script needs to clear food_query_cache between runs to get a fair before/after comparison. Otherwise sequential-mode replay with warm cache underestimates the gap. Worth flagging when I get to Alpha.8.

**Net: Alpha.1 lands as expected.** No surprises. The dispatcher fix is in.

**Updated Sprint-1 expectation:** for the screenshot meal, post-Alpha.1 latency lands ~50s. Phase 0's "60s → 25-30s" total target depends on Alpha.5 (cache bust granularity, repeat-meal hits) for the rest of the win. Alpha.5 is next.

---

## §5 — What's NOT done in Alpha.1's scope

- Alpha.5, Alpha.4, Alpha.2+Alpha.3, Alpha.8 — pending in the locked sub-fix order
- No push to GitHub (per the bundle gate)
- The throwaway scratch smoke script is removed; not in commit

---

## §6 — Status / docket

**At bat:** Alpha.1 commit `33c04f9` awaiting V20 Gate 1 greenlight.

**On deck (post-greenlight):** Alpha.5 — response cache bust granularity in `app/api/meals/log/route.ts:153-155`. One-line surgical change: `if (savedMealAction !== 'none')` → `if (savedMealAction === 'created')`. Phase 0 §4 has the locked rationale (ship-now confirmed by V20).

**In the hole:** Alpha.4 (mixed-resolution shortcut, path a), Alpha.2+Alpha.3 (Whisper hint + telemetry), Alpha.8 (replay script).

**Cumulative bundle so far:** Alpha.7 (b570a06) + Alpha.1 (33c04f9) = 3 files modified, 1 migration applied, ~6.2s/parse dispatcher win empirically verified.

**Parallel thread:** Brick I steps 12-14 still blocked on Luke's interactive submit per HANDOFF_3.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_ALPHA1_HANDOFF_1.md
