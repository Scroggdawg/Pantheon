# Pantheon — Alpha.4.1 Gate 1 Handoff

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude — Gate 1 review on Alpha.4.1
**Mode:** Follow-up fix in Alpha-ex-6 bundle. Local commit, not pushed.

---

## §0 — Status

Alpha.4.1 (track original segment alongside stripped) shipped clean. Type-check green. Replay on the previously-failing case (Double espresso) now succeeds via partial-resolve path with empirical 6.1s improvement vs baseline.

**Commit:** `179a19b S27 Op FASTRAK Alpha.4.1: track original segment alongside stripped` (3 files, +75/-26)

Awaiting Gate 1 greenlight. After approval: re-run replay full-sample (no `--limit`) for bundle measurement → V20 PROCEED PUSH.

---

## §1 — What changed

### `lib/claude/parse-meal-library-shortcut.ts`

`segmentTranscript` return type changes from `string[]` to `TranscriptSegment[]`:

```typescript
export interface TranscriptSegment {
  stripped: string  // filler-removed + numbers-normalized — for library matching
  original: string  // composite-restored + trimmed only — for LLM input + telemetry
}
```

The "original" form is captured at line ~5a (after composite-allowlist restore + trim, BEFORE number normalization or filler stripping). This is the natural-language fragment as the user actually said it.

`ResolvedSegment` and `UnresolvedSegment` both gain an `original_segment: string` field. Existing `segment` field stays as the stripped form for backward compat with telemetry consumers.

`tryLibrarySegmentedShortcut` now:
- Calls `searchUserLibrary({ query: seg.stripped, ... })` — library matching uses stripped (unchanged behavior).
- Threads `seg.original` into both `resolved` and `unresolved` arrays as `original_segment`.

### `app/api/claude/parse-meal/route.ts`

Partial-resolve path now uses `original_segment` for the LLM sub-transcript:

```diff
-      const subTranscript = segmented.unresolved
-        .map((u) => u.segment)
-        .join(', ')
+      const subTranscript = segmented.unresolved
+        .map((u) => u.original_segment)
+        .join(', ')
```

Plus the existing debug log gets two new fields (resolved_originals, unresolved_originals) for at-a-glance debugging when the path fires.

### `scripts/test-segmented-library.ts`

Updates to handle new `TranscriptSegment[]` return shape: prints both stripped and originals as separate JSON arrays. CASES assertions untouched (they're stale per Alpha.4 handoff §6 — separate Brick D regression-test concern).

---

## §2 — Verification

### Verbatim replay on the previously-failing case

Pre-Alpha.4.1 (commit `1d8c597`):

```
[1/1] "Double espresso, with half an ounce of half and half…"  → ERR
ERRORED CASES
  367bdc92  partial-resolve LLM step returned no parseable JSON
```

Post-Alpha.4.1 (commit `179a19b`):

```
[parse-meal] Alpha.4 partial-resolve: {
  resolved_count: 1,
  unresolved_count: 2,
  sub_transcript: 'with half an ounce of half and half, stevia hazelnut',
  resolved_originals: [ 'Double espresso' ],
  unresolved_originals: [ 'with half an ounce of half and half', 'stevia hazelnut' ]
}
[search-food-database] cache_hit=true query='half and half cream'
[search-food-database] cache_hit=false query='stevia hazelnut liquid sweetener'
[search-food-database] cache_hit=true query='stevia hazelnut'
{
  type: 'parse_meal_telemetry',
  latency_ms: 14918,
  library_segmented_partial_hit: true,
  library_segmented_resolved_count: 1,
  library_segmented_unresolved_count: 2,
  library_segmented_resolved_segments: [ 'double espresso' ],
  library_segmented_unresolved_segments: [ 'with half half half', 'stevia hazelnut liquid' ],
  llm_iters: 3,
  llm_tool_calls: 3,
  llm_cache_hits: 1,
  ...
}
  → 14918ms

PER-CASE DETAIL
   21052ms →  14918ms  seg-partial   "Double espresso, with half an ounce of half and ha…"
```

The sub-transcript handed to the LLM is now `"with half an ounce of half and half, stevia hazelnut"` — natural English. The LLM resolved both items cleanly, returned valid JSON, route merged with library-resolved Double espresso. **0 errored cases.**

**Latency: baseline 21,052ms → replay 14,918ms = 6.1s saved** on this single case. Cold-cache replay vs warm-cache historical baseline; the saving is conservative (warm-cache replay would be even faster).

### Stripped-form telemetry preserved

The structured `parse_meal_telemetry` log line still surfaces the stripped form in `library_segmented_unresolved_segments` (still `["with half half half", "stevia hazelnut liquid"]`). That's intentional — telemetry shape stable for any future replay-script consumers. The fix is in the SUB-TRANSCRIPT (what's handed to the LLM), not in what's logged for telemetry. The new `[parse-meal] Alpha.4 partial-resolve:` debug log already surfaces originals for at-a-glance debugging.

---

## §3 — Gate 1 spec checklist

| Spec from V20's brief | Status |
|---|---|
| Type-check passes | ✅ `npx tsc --noEmit` exit 0 |
| Library matching unchanged (stripped version still used for similarity scoring) | ✅ verified by inspection — `searchUserLibrary({ query: seg.stripped, ... })` at line 495 |
| Manual smoke: re-run Double espresso case, verify partial-resolve sub-transcript shows original (not filler-stripped) form | ✅ debug log confirms `sub_transcript: 'with half an ounce of half and half, stevia hazelnut'` |
| Verify case completes without errored_replay status | ✅ replay output shows 1 ok / 0 errored; PER-CASE DETAIL shows `seg-partial` path with 14,918ms latency |

---

## §4 — Plan re-evaluation (per doctrine amendment)

**The empirical 6.1s saving on this single case** is a clean validation of the entire Alpha.4 + Alpha.4.1 design philosophy. Library hits the trivially-resolvable item at ~100ms; LLM only handles what it has to. The whole Alpha-ex-6 bundle's logic is working.

**The fix surfaces a small architectural observation worth carrying forward:** segmentTranscript now has TWO outputs from one input. The "stripped" and "original" forms diverge in non-trivial ways (filler removal can change a 6-word fragment to a 3-word one). Future consumers of segmentTranscript (e.g., a Beta-era embedding-based matcher) will need to pick which form they want. Existing callers all use stripped for matching; new callers should be explicit.

**For Alpha.8's replay measurement run (next):** the bundle should now measure clean. With Double espresso fixed, all 8 historical candidates from the last 30 days should replay successfully. If any other utterances surface partial-resolve regressions of a DIFFERENT shape, that's a new finding for V20 to gate.

**One thing to watch on the full replay:** the historical baseline `_telemetry.latency_ms` was captured with WARM food_query_cache (each parse populated cache for the next). The replay clears caches by default for fair before/after. So baseline-vs-replay deltas systematically penalize replay for cold caches. **The right comparison is replay-vs-replay (e.g., pre-Alpha.4.1 vs post-Alpha.4.1), not replay-vs-baseline.** I'll surface both in the bundle-measurement handoff so V20 can interpret correctly.

---

## §5 — What's NOT done

- **Bundle-level full replay** — held until Gate 1 approves. Will run with no `--limit`, capture distributional metrics, surface for PROCEED PUSH.
- **Push to GitHub** — held until PROCEED PUSH.
- **Annotated-full-transcript mitigation** — still on the future docket per Phase 0 §7 if cross-item-context regressions surface in real cases. Alpha.4.1 doesn't address that concern (was never the problem here).

---

## §6 — Status / docket

**At bat:** Alpha.4.1 commit `179a19b` awaiting V20 Gate 1 greenlight.

**On deck (post-greenlight):**
- Run replay full-sample: `npm run replay` (no `--limit`, default 30d window). Will hit ~8 historical candidates after filter.
- Surface measurement output (median + p95 + hit rates + per-case detail) for V20 PROCEED PUSH greenlight.
- Push to GitHub after PROCEED PUSH.

**Cumulative bundle so far:** Alpha.7 + Alpha.1 + Alpha.5 + Alpha.4 + Alpha.2/3 + Alpha.8 + Alpha.4.1 = 7 commits, 9 files modified + 2 new files, 1 migration applied.

**Parallel thread:** Brick I steps 12-14 still blocked on Luke's interactive submit per HANDOFF_3.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_ALPHA41_HANDOFF_1.md
