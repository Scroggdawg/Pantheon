# Pantheon — Alpha.5 Gate 1 Handoff

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude — Gate 1 review on Alpha.5
**Mode:** Sub-fix 3 of 6 in Alpha-ex-6 bundle. Local commit, not pushed.

---

## §0 — Status

Alpha.5 (response cache bust granularity) shipped clean. Surgical one-line conditional change with comment refresh documenting Alpha.5 rationale + Shape E forward-compatibility.

**Commit:** `9458a8d S27 Op FASTRAK Alpha.5: response cache bust granularity` (1 file, +17/-4)

Awaiting Gate 1 greenlight before moving to Alpha.4 (mixed-resolution shortcut, path a).

---

## §1 — What changed

`app/api/meals/log/route.ts` — single substantive change at the bust call site, plus comment update:

```diff
-  // S26 Step 4e — bust user's parse-meal response cache when their
-  // library changes (saved_meals upsert). Best-effort; helper logs
-  // its own warnings on failure and does not throw.
-  if (savedMealAction !== 'none') {
+  // S26 Step 4e + Op FASTRAK Alpha.5 — bust user's parse-meal response
+  // cache only when a NEW saved_meal was created (library state actually
+  // changed). Pre-Alpha.5 this fired on every log because savedMealAction
+  // is unreachable as 'none' under current auto-promote semantics — every
+  // meal log was wiping the user's response cache, so the 90-day TTL was
+  // meaningless and repeat-meal parses always missed cache.
+  //
+  // 'incremented' (re-log of an existing saved_meal) does not change
+  // library state and therefore must not invalidate cached responses.
+  // 'created' (novel saved_meal) genuinely mutates the library and must
+  // bust so the next parse surfaces the new entry. Best-effort; helper
+  // logs its own warnings on failure and does not throw.
+  //
+  // Post-Shape E (Alpha.6, future), 'created' becomes unreachable from
+  // this path — bust semantics relocate to the heart-icon save handler,
+  // preserving the same "bust on novel library write" pattern.
+  if (savedMealAction === 'created') {
     await bustResponseCacheForUser(supabase, body.user_id)
   }
```

Single behavioral change: `!== 'none'` → `=== 'created'`. The comment block expands to document the architectural reasoning for any reader who hits this code in a future session.

---

## §2 — Gate 1 spec checklist

| Spec from V20's brief | Status |
|---|---|
| Type-check passes | ✅ `npx tsc --noEmit` exit 0 |
| Confirm the bust only fires on 'created' path | ✅ verified by grep — single call site at meals/log/route.ts:196 gated on `savedMealAction === 'created'` |
| Manual smoke: log same single-food meal twice via library-shortcut path; second log should hit response_cache | ⏳ deferred — see §3 |

---

## §3 — Why the V20 smoke spec needs nuance

V20's smoke as written ("log same single-food meal twice via library-shortcut path; second log should hit response_cache") doesn't reproduce empirically under current code semantics. Worth surfacing the reasoning so it's not a Gate 1 surprise:

**The cache only writes on the LLM path** (parse-meal-pipeline.ts → writeResponseCache after Sonnet returns). Library shortcut returns at the route layer BEFORE the LLM round-trip, so it never populates the cache. A repeat parse of a transcript that hits library shortcut on attempt 1 will also hit library shortcut on attempt 2 — at the same ~100ms cost, regardless of cache state. So "second log hits response_cache" via that path doesn't happen.

**The actual scenario where Alpha.5 delivers a cache hit:**

1. User parses transcript T1 that doesn't trigger the (strict) library shortcut threshold but DOES find a library entry inside the LLM tool loop. Example: `"Protein shake with dextrose."` against a saved_meal `"Protein Shake A - Pre-Workout"` — too low a name-similarity score for the 0.85 fast-path gate, but search_user_library called by Sonnet finds it.
2. LLM emits final foods with `source: "library", source_ref: "lib:saved_meal:<UUID>"`.
3. response_cache populated with the parsed result.
4. User logs. The native client picks `library_source_ref = "lib:saved_meal:<UUID>"` from foods[].source_ref. Route classifies as `isSavedMealRef` → `savedMealAction = 'incremented'`.
5. **Post-Alpha.5: NO bust.** Cache row survives.
6. User re-parses T1 hours later. response_cache HIT → ~100ms (saved 10-15s vs cold LLM round-trip).

This IS the win. But it requires (a) a saved_meal that the LLM finds via tool loop but the shortcut doesn't, AND (b) the user re-parses same transcript. Library is currently 3 entries post-cleanup, so the surface for this is small TODAY but expands as Luke bulk-loads (BRICK PANTRY).

**Net for Gate 1:** the change is correct by inspection. The deployed-route empirical smoke that V20 specified is observable in production telemetry once Alpha.5 ships and Luke logs a repeat-LLM-path parse — same deferral pattern as Alpha.7's two ⏳ items. The replay script (Alpha.8) will exercise this case empirically against historical utterances.

---

## §4 — Plan re-evaluation (per doctrine amendment)

**Today's library size limits Alpha.5's near-term impact.** With 3 saved_meals (3 eggs / Churro / Double espresso), the LLM-path-finds-library-entry case is rare. Most parses of novel foods go: LLM path → cache write → user logs novel meal → savedMealAction = 'created' → bust fires. So cache stays empty under typical usage even post-Alpha.5.

**The fix lands its full value with Alpha.6 Shape E + library growth (Gamma).** Once auto-promote stops creating saved_meals on every log, savedMealAction = 'none' becomes reachable. At that point the bust never fires from this route at all, and cache hit rate climbs as the library grows and more parses route through the LLM-finds-library-entry path.

**For Sprint-1 measurement: Alpha.5 won't move the response_cache_hit_rate metric significantly with current library size.** That's expected and not a regression. The fix is correct; the volume of hits is data-bounded, not code-bounded.

**For Alpha.8's replay script:** must surface BOTH the response_cache_hit metric AND the cache-write-rate metric. Cache-write-rate (how often a parse populates cache) is what Alpha.5 directly affects. Cache-hit-rate is the delivered win, gated by library size + repeat behavior.

---

## §5 — What's NOT done in Alpha.5's scope

- Alpha.4, Alpha.2+Alpha.3, Alpha.8 — pending in the locked sub-fix order
- No push to GitHub (per the bundle gate)
- Deployed-route smoke deferred to Alpha.8 measurement / first post-push log

---

## §6 — Status / docket

**At bat:** Alpha.5 commit `9458a8d` awaiting V20 Gate 1 greenlight.

**On deck (post-greenlight):** Alpha.4 — mixed-resolution shortcut in `lib/claude/parse-meal-library-shortcut.ts:tryLibrarySegmentedShortcut`. Path (a) per V20's lock: return `{ resolved: FoodItem[], unresolved: { segment, position }[] } | null`; route invokes LLM tool-loop on unresolved subset; assembly merges by position.

**In the hole:** Alpha.2+Alpha.3 (Whisper hint + telemetry, bundled), Alpha.8 (replay script).

**Cumulative bundle so far:** Alpha.7 (b570a06) + Alpha.1 (33c04f9) + Alpha.5 (9458a8d) = 3 commits, 4 files modified, 1 migration applied, ~6.2s/parse dispatcher win + cache bust corrected.

**Parallel thread:** Brick I steps 12-14 still blocked on Luke's interactive submit per HANDOFF_3.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_ALPHA5_HANDOFF_1.md
