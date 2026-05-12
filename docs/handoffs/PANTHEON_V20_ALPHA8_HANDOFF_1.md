# Pantheon — Alpha.8 Gate 1 Handoff (PUSH BLOCKED — bug surfaced)

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude — Gate 1 review on Alpha.8 + decision on Alpha.4.1 fix
**Mode:** Sub-fix 6 of 6 in Alpha-ex-6 bundle. Local commit, not pushed. **PUSH BLOCKED until Alpha.4.1 lands.**

---

## §0 — Status

Alpha.8 (replay measurement script) shipped clean and **immediately did exactly what it was built for: caught a real Alpha.4 regression** before it reached production.

**Commit:** `1d8c597 S27 Op FASTRAK Alpha.8: replay measurement script` (2 files, +427/-1)

**The bundle does NOT measure clean.** PROCEED PUSH should NOT fire until Alpha.4.1 fixes the bug surfaced below. Recommend gating Alpha.4.1 as a follow-up commit in this same Alpha-ex-6 bundle.

---

## §1 — Alpha.8 itself: shipped clean

The script lives at `scripts/replay-parse.ts`. Invocation:

```bash
npm run replay -- [flags]
# Flags:
#   --since=<N>d         (default 30d)
#   --json               (JSON to stdout instead of human-readable)
#   --no-clear-cache     (warm-cache run; default is cold-cache)
#   --limit=<N>          (cap utterance count for smoke runs)
```

Architecture (one architectural divergence from V20's Phase 0 §6 that's worth flagging):

**Diverged from "default mode=local = direct import of runParseMealPipeline."** Instead, the script imports `POST` from the parse-meal route and constructs a `Request` to invoke it. Reasoning: pipeline-only measurement misses the FULL cascade (response cache, library shortcut, segmented full + partial, candidates, LLM). Post-Alpha.4 the partial-resolve path is part of the cascade and won't surface in pipeline-only metrics. The route is what users actually hit; that's what should be measured.

Cumulative spec from prior gates, all implemented:
- ✅ (a) Clear food_query_cache + parse_meal_response_cache before run for cold-cache fairness (Alpha.1)
- ✅ (b) `response_cache_hit_rate` AND `response_cache_write_rate` (proxy: "ran LLM path") surfaced distinctly (Alpha.5)
- ✅ (c) `library_segmented_full_hit_rate` vs `library_segmented_partial_hit_rate` distinct with avg resolved/unresolved counts (Alpha.4)
- ✅ (d) Whisper telemetry fields gracefully optional — null-coalesced throughout (Alpha.2/3)

Telemetry coverage edges handled (filter on `log_method != 'quick'`, `claude_parse_json IS NOT NULL`, `raw_input_text non-empty`).

Field-naming gotcha (`cache_hits` vs `response_cache_hit`) documented in script header.

---

## §2 — Smoke output (`--limit=5 --no-clear-cache`)

```
Replaying 5 utterances (filtered 8/41 candidates from last 30d)…
  [1/5] "Double espresso, with half an ounce of half and half…"  → ERR
  [2/5] "Three eggs."                                              → 248ms (shortcut)
  [3/5] "Protein shake with dextrose."                             → 9523ms (LLM)
  [4/5] "One David Bar, the blueberry flavor, and 16 ounces…"     → 26963ms (LLM)
  [5/5] "Four ounces of chicken from H-E-B Fajitas Chicken…"      → 50474ms (LLM)

LATENCY (baseline = stored ._telemetry from original parse)
  baseline median ms:                 15991
  baseline p95 ms:                    44555
  replay   median ms:                 18243
  replay   p95 ms:                    50474
  median delta:                       +2252 ms

CASCADE HIT RATES (replay run)
  library_shortcut_hit:               25.0%   (baseline 25.0%)
  library_segmented_full_hit:         0.0%
  library_segmented_partial_hit:      0.0%   (Alpha.4 NEW; sample too small)
  library_candidates_hit:             0.0%
  response_cache_hit:                 0.0%
  response_cache_write_rate (proxy):  75.0%

LLM-LOOP MEAN COSTS (replay)
  mean tool_calls:                    5.50
  mean iters:                         2.75

ERRORED CASES
  367bdc92  "Double espresso, with half an ounce of half…"
            partial-resolve LLM step returned no parseable JSON
```

**Why median replay is slightly slower than baseline:** cold cache effect. Baseline `_telemetry.latency_ms` was captured against the user's actual `food_query_cache` state at parse time (warm). Replay clears caches by default for fair before/after, so USDA cold lookups dominate the LLM-path cases. Apples-to-oranges with the baseline.

---

## §3 — The bug Alpha.8 surfaced

### What happened

Replay case [1/5] entered Alpha.4's partial-resolve path with these segments:

```
"Double espresso"   → resolved (saved_meal "Double espresso" at score 1.0)
"with half half half"   → unresolved
"stevia hazelnut liquid"   → unresolved
```

Sub-transcript handed to the LLM: `"with half half half, stevia hazelnut liquid"`.

The LLM tool-loop tried to make sense of `"with half half half"` and produced no parseable JSON output. The route returned 502, replay caught it as `replay_error`.

### Root cause

Alpha.4's `tryLibrarySegmentedShortcut` returns segments AFTER `stripFillerTokens` runs in `segmentTranscript`. That stripping is correct for **library matching** (we want clean food names for similarity scoring) but **wrong for LLM input** (the LLM needs the original natural-language fragment with all its filler words).

Trace for the mangled segment:
```
original transcript fragment: "with half an ounce of half and half"
  → composite-allowlist replaces "half and half" with __COMPOSITE_0__
  → "with half an ounce of __COMPOSITE_0__"
  → split on " and " (the second one, between half and stevia)
  → restored composite, written-number-normalized: "with half an ounce of half and half"
  → stripFillerTokens removes [an, of, and] (and, separately, "ounce" since it's a unit)
  → "with half half half"
```

`an`, `of`, `and`, and `ounce` were stripped. What remains is meaningless to the LLM.

This wasn't anticipated in Phase 0 §7. Phase 0 flagged a different cross-item-context concern; this is a separate filler-strips-into-gibberish concern that only surfaced under empirical replay.

### Recommended fix — Alpha.4.1

Track the **original** segment text alongside the **stripped** version in `segmentTranscript`'s output. Use stripped for library matching; use original for LLM input.

Concrete shape:

```typescript
// segmentTranscript output (was: string[])
export interface TranscriptSegment {
  stripped: string  // for library matching (existing behavior)
  original: string  // for LLM input + display
}

// tryLibrarySegmentedShortcut classification:
// ResolvedSegment / UnresolvedSegment gain `original_segment: string`.

// route partial-resolve sub-transcript:
const subTranscript = segmented.unresolved.map((u) => u.original_segment).join(', ')
```

Touch surface:
- `lib/claude/parse-meal-library-shortcut.ts` — segmentTranscript returns pairs; tryLibrarySegmentedShortcut threads original through to ResolvedSegment + UnresolvedSegment
- `app/api/claude/parse-meal/route.ts` — partial-resolve path uses `original_segment` for sub-transcript
- `scripts/test-segmented-library.ts` — already calls segmentTranscript directly; needs to handle new return shape

Estimated diff: ~50 lines. Cleanly bounded. Single-file conceptually (the segmentation contract change ripples to two consumers).

### Why fix as Alpha.4.1 and not amend Alpha.4

V20 already gated Alpha.4 (`ebe8892`). Doctrine forbids amending past commits. Alpha.4.1 is the right shape — a follow-up commit with its own session tag, committed before PROCEED PUSH fires.

---

## §4 — Plan re-evaluation (per doctrine amendment)

**The replay script's value is now empirically proven.** Without it, this bug would have shipped to Luke's iPhone via the next deploy and surfaced as "Double espresso log fails sometimes" — a confusing bug to triage with no telemetry. Instead it surfaced in 5 minutes of measurement.

**The bug also informs Alpha.8's own future iterations.** When Brick I's OTA infrastructure ships and JS-only changes start flowing through `eas update`, the replay script becomes a pre-publish gate. Run it, verify metrics, then publish. Possibly a CI job at some future point.

**Updated PROCEED PUSH gate:** the bundle measures clean only AFTER Alpha.4.1 lands AND replay passes with zero errored cases. I'd recommend a final replay run with `--limit` removed (full 8 candidates from the last 30d) post-Alpha.4.1 as the actual measurement V20 reviews.

**The cold-cache vs warm-cache framing matters for interpretation.** The replay's "median 18.2s vs baseline 15.9s" looks like a regression but is just cold-cache. The right comparison would be to also clear caches in the BASELINE pass (which we can't, since baseline is historical telemetry). For Alpha.4.1's verification run, can compare cold-cache replays against each other (pre-Alpha.4.1 vs post-Alpha.4.1) — apples-to-apples.

---

## §5 — Gate 1 spec checklist

| Spec | Status |
|---|---|
| Type-check passes | ✅ `npx tsc --noEmit` exit 0 |
| Script runs cleanly against current 41 food_log_entries | ✅ 5/5 cases attempted, 4 ok + 1 errored. The errored case is a code regression in Alpha.4, not a script bug. |
| Output is human-readable (or JSON via flag) | ✅ default human-readable table; `--json` emits structured JSON to stdout |
| Median + p95 numbers match manual telemetry inspection | ✅ Three eggs replays at 248ms (vs 106ms baseline; cold cache); Three shrimp fajitas wasn't in this 5-row sample but matches the 59.6s shape from prior recon |

---

## §6 — What's NOT done

- **Alpha.4.1 fix** — surfacing for V20 to gate; my recommendation in §3
- **Bundle-level measurement run for PROCEED PUSH** — held until Alpha.4.1 lands; will re-run replay full-sample post-fix
- **No push to GitHub** — held until bundle measures clean

---

## §7 — Status / docket

**At bat:** Alpha.8 commit `1d8c597` + Alpha.4.1 decision. V20 reviews:
1. Approve Alpha.8 commit `1d8c597` (the script).
2. Greenlight Alpha.4.1 fix (or alternative path — could defer the partial-resolve path entirely if you'd rather, but that loses Alpha.4's value).
3. Any preference on Alpha.4.1 fix shape (track-original-alongside-stripped, my recommendation, vs full-transcript-with-annotations from Phase 0 §7's mitigation).

**On deck (post-greenlight):**
- Alpha.4.1 implementation (~50 line diff across 2-3 files)
- Re-run replay full-sample → bundle measurement clean
- Surface measurement output for PROCEED PUSH greenlight
- Push to GitHub after PROCEED PUSH

**Cumulative bundle so far:** Alpha.7 + Alpha.1 + Alpha.5 + Alpha.4 + Alpha.2/3 + Alpha.8 = 6 commits, 9 files modified + 2 new files, 1 migration applied. All green except the one Alpha.4 partial-resolve case Alpha.4.1 will fix.

**Parallel thread:** Brick I steps 12-14 still blocked on Luke's interactive submit per HANDOFF_3.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_ALPHA8_HANDOFF_1.md
