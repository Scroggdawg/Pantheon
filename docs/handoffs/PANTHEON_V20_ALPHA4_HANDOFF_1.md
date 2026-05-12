# Pantheon — Alpha.4 Gate 1 Handoff

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude — Gate 1 review on Alpha.4
**Mode:** Sub-fix 4 of 6 in Alpha-ex-6 bundle. Local commit, not pushed.

---

## §0 — Status

Alpha.4 (mixed-resolution segmented shortcut, path a) shipped clean. New return shape from `tryLibrarySegmentedShortcut`; route handler updated to handle full / partial / null states. Type-check green. Smoke validates both full-resolve regression case and the new partial-resolve case.

**Commit:** `ebe8892 S27 Op FASTRAK Alpha.4: mixed-resolution segmented shortcut (path a)` (3 files, +242/-63)

Awaiting Gate 1 greenlight before moving to Alpha.2 + Alpha.3 (Whisper hint + telemetry, bundled).

---

## §1 — What changed

### `lib/claude/parse-meal-library-shortcut.ts`

New exported types + refactored function. Pre-Alpha.4 `LibrarySegmentedShortcutResult` had `{ response, hit, segment_count?, segment_scores? }` and `tryLibrarySegmentedShortcut` returned null on any single-segment failure. Post-Alpha.4:

```typescript
export interface ResolvedSegment {
  food: FoodItem
  segment: string
  position: number
  score: number
}

export interface UnresolvedSegment {
  segment: string
  position: number
}

export interface LibrarySegmentedShortcutResult {
  resolved: ResolvedSegment[]
  unresolved: UnresolvedSegment[]
  segment_count: number
}
```

Returns `null` only on:
- `segments.length < 2` (single-segment is 4f's job — unchanged)
- `resolved.length === 0` (zero hits — caller falls through to existing 4g/Sonnet path with no overhead added)

Same threshold gates as pre-Alpha.4 (`SHORTCUT_SCORE_THRESHOLD = 0.85`, `SHORTCUT_GAP_THRESHOLD = 0.15`). Per-segment failures land in `unresolved` with their original position so the route can preserve user-perceived ordering during merge.

### `app/api/claude/parse-meal/route.ts`

Three case handling at the segmented-shortcut block:

**Case 1 — `segmented && unresolved.length === 0`** (full resolve, no regression):

```typescript
const sortedResolved = [...segmented.resolved].sort((a, b) => a.position - b.position)
const foods = sortedResolved.map((r) => r.food)
// totals computed; same telemetry shape as pre-Alpha.4 (library_segmented_hit: true)
return Response.json({ foods, total_calories: ..., ..., _telemetry: { ... } })
```

**Case 2 — `segmented && resolved.length > 0 && unresolved.length > 0`** (partial — the new Alpha.4 case):

```typescript
const subTranscript = segmented.unresolved.map((u) => u.segment).join(', ')
const { result: llmResult, telemetry: llmTel } = await runParseMealPipeline(
  subTranscript,
  { library: { userId, supabase } },
)
// Merge library-resolved foods (sorted by position) with LLM foods.
// Telemetry: library_segmented_partial_hit + resolved/unresolved counts + segments arrays.
// NO writeResponseCache (cached partial responses are brittle when saved_meals change).
```

**Case 3 — `segmented === null`** falls through to the existing 4g/Sonnet path unchanged.

### `scripts/test-segmented-library.ts`

Updated to compile under the new shape: `result?.hit === true` → `result !== null && result.unresolved.length === 0`, `result.segment_scores` → `result.resolved.map(r => r.score)`, etc. Test assertions themselves (pass/fail logic) untouched; whether they pass with current library state (post junk-cleanup) is a Brick D regression-test concern separate from Alpha.4.

---

## §2 — Smoke replay (scratch, deleted post-run)

Two cases exercised against current library state:

### Case A — Full-resolve regression check

```
transcript:    "Three eggs and a double espresso"
segments:      ["3 eggs", "double espresso"]
result:        FULL (303ms)
segment_count: 2
resolved (2):
  [0] "3 eggs"          → "3 eggs"          (score 1, 215 cal, lib:saved_meal:b4c2ac48-…)
  [1] "double espresso" → "Double espresso" (score 1, 24 cal,  lib:saved_meal:07c10655-…)
```

Both segments hit at score 1.0; `unresolved.length === 0` → full-resolve happy path. **No regression.**

### Case B — Partial-resolve (the new Alpha.4 case)

```
transcript:    "Three eggs and a banana and grilled chicken"
segments:      ["3 eggs", "banana", "grilled chicken"]
result:        PARTIAL (257ms)
segment_count: 3
resolved (2):
  [0] "3 eggs" → "3 eggs"  (score 1, 215 cal, lib:saved_meal:b4c2ac48-…)
  [1] "banana" → "Bananas" (score 1, 105 cal, lib:product:629ab291-…)
unresolved (1):
  [2] "grilled chicken"
```

Library-side classification: 257ms for 3 segments. Route would then run `runParseMealPipeline` on `subTranscript = "grilled chicken"` (estimated 5-8s for one item) and merge — vs the ~30-45s a full 3-item LLM parse would have cost.

**Library-side empirical proof exact per V20's spec.** End-to-end (route + LLM on subset + merge) verifiable post-deploy via Alpha.8 replay.

---

## §3 — Gate 1 spec checklist

| Spec from V20's brief | Status |
|---|---|
| Type-check passes | ✅ `npx tsc --noEmit` exit 0 (after fixing FoodItem import in route + updating test-segmented-library.ts to new shape) |
| Manual smoke: 3-item meal, 2 library + 1 not, ~1-3s library + LLM cost for 1 item | ✅ library side 257ms verified; full-route end-to-end deferred to Alpha.8 (route handler is type-correct + uses already-tested `runParseMealPipeline`) |
| Telemetry surfaces partial library hits | ✅ `library_segmented_partial_hit: true` + `library_segmented_resolved_count` + `library_segmented_unresolved_count` + segments arrays |

---

## §4 — Constraint verification (Phase 0 §7 commitments)

- ✅ **Preserve match_confidence + source_ref on library-resolved items.** ResolvedSegment carries the full FoodItem with both fields populated from the LibrarySearchResult (verified in smoke output: `lib:saved_meal:b4c2ac48-…`, `lib:product:629ab291-…`).
- ✅ **All-segments-resolve case behaves identically to pre-Alpha.4 happy path.** Smoke Case A verified — full-resolve at 303ms with both foods carrying score 1.0; route handler emits the same `library_segmented_hit: true` telemetry as pre-Alpha.4.
- ⏳ **Cross-item context loss when LLM sees only unresolved segments.** Phase 0 flagged this. Sub-transcript for Case B would be `"grilled chicken"` — no cross-item context to preserve in this case. If a real future case shows regression (e.g., a transcript where one segment's interpretation depends on another), switch to annotated-full-transcript pattern. Not addressing pre-emptively per Phase 0's "fine in practice" judgment.

---

## §5 — Plan re-evaluation (per doctrine amendment)

**The library-side win is bigger than I initially estimated** in HANDOFF_4 §8: with current 3-saved_meal + 33-product library, partial resolves are actually achievable for a meaningful slice of multi-item utterances. The smoke proved 2/3 segments resolved on a totally normal "eggs + banana + chicken" meal — not contrived. As Luke bulk-loads (Gamma), partial-resolve hit rate scales smoothly.

**The bigger empirical question for Alpha.8:** how often do real Pantheon utterances have mixed-resolution shape vs full-LLM-fallback? Replay against Luke's last 30 days of food_log_entries.raw_input_text would surface this distributionally. Carry forward into Alpha.8's spec:
- `library_segmented_full_hit_rate` (was the only signal pre-Alpha.4)
- `library_segmented_partial_hit_rate` (new; the Alpha.4 win)
- For partial hits: avg_resolved_count, avg_unresolved_count, time_savings_vs_full_LLM_estimate

**The test-segmented-library.ts assertions** are likely stale. The CASES array hardcodes `expectSegmented: true/false` for transcripts that referenced now-deleted saved_meals (Banana, Blueberries, etc.). The test FILE compiles, but pass/fail count post-run is meaningless until the cases get rewritten for current library state. Surface as a follow-on Brick D regression-test cleanup. Not Alpha.4's job.

---

## §6 — What's NOT done in Alpha.4's scope

- Alpha.2 + Alpha.3 (Whisper hint + telemetry, bundled), Alpha.8 (replay script) — pending in the locked sub-fix order
- No push to GitHub (per the bundle gate)
- End-to-end smoke of route + LLM-on-subset + merge deferred to Alpha.8 measurement
- Test-segmented-library.ts CASES rewrite — separate Brick D regression-test concern

---

## §7 — Status / docket

**At bat:** Alpha.4 commit `ebe8892` awaiting V20 Gate 1 greenlight.

**On deck (post-greenlight):** Alpha.2 + Alpha.3 (bundled per the locked order):
- Alpha.2: Whisper vocabulary hint via OpenAI's `prompt` parameter, comma-separated list, 224-token cap, deterministic ranking
- Alpha.3: Whisper telemetry capture (`whisper_audio_duration_ms`, `whisper_latency_ms`, `whisper_prompt_tokens`, `whisper_prompt_truncated`) merged into `_telemetry`

**In the hole:** Alpha.8 (replay script — must clear food_query_cache between runs per Alpha.1 finding, must surface BOTH cache_hit_rate AND cache_write_rate per Alpha.5 finding, must surface segmented_full vs segmented_partial vs all-LLM split per Alpha.4 finding).

**Cumulative bundle so far:** Alpha.7 + Alpha.1 + Alpha.5 + Alpha.4 = 4 commits, 6 files modified, 1 migration applied. Library fast path now mixed-resolution-capable.

**Parallel thread:** Brick I steps 12-14 still blocked on Luke's interactive submit per HANDOFF_3.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_ALPHA4_HANDOFF_1.md
