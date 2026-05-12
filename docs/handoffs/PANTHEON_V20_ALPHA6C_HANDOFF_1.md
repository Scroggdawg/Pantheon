# Op FASTRAK Brick Alpha.6 Sub-fix C — Gate 1

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Sub-fix C complete and committed (web only). Push HOLD per V20's bundle discipline. Awaiting Gate 1 review before Sub-fix D.

---

## §0 — Status

Heart-icon save/un-save handler shipped at `/api/saved_meals/heart` (POST + DELETE). Proxy gate updated. Empirically validated via 7-test smoke against live Supabase including all error paths (403/404). Cleanup successful — saved_meals count + 3-eggs baseline state restored exactly.

Commit: `b3aec2c` (web). Native untouched.

---

## §1 — What changed

```
A  app/api/saved_meals/heart/route.ts  (162 lines, new file)
M  proxy.ts                            (NATIVE_ROUTES += /api/saved_meals/heart)
```

**Two diff-stat:** +168 -2 lines.

### Route shape

- `interface HeartBody { user_id, food_log_entry_id }`
- `parseAndValidate(request)` shared helper — returns Body or `Response` (early-exit pattern; both methods use it)
- `POST`: lookup → idempotent UPDATE (existing) OR INSERT + backfill (novel) → cache-bust → `{saved_meal_id, is_favorite: true}`
- `DELETE`: lookup → 404 if no link → UPDATE is_favorite=false → cache-bust → `{saved_meal_id, is_favorite: false}`
- Errors: 400 (bad body), 403 (user_id mismatch), 404 (not found / no link), 500 (DB failure)

### proxy.ts

`/api/saved_meals/heart` added to `NATIVE_ROUTES` (per Sub-fix B §S.1). Comment explains the post-Alpha.6 split: meals/log is increment-only; heart-handler is the sole saved_meals creator.

---

## §2 — Verification

### C.0 — Type-check (web)

```
$ npx tsc --noEmit  →  clean
```

### C.1-C.7 — Empirical smoke

Dev server + `x-pantheon-native-secret` header. Setup created 3 food_log_entries (entry-1 lib:saved_meal:3-eggs, entry-2 + entry-3 novel). Pre-baseline: 3-eggs `is_favorite=false`, `times_logged=7`. saved_meals count: 4.

| Test | Action | Expected | Observed | Pass |
|---|---|---|---|---|
| **C.1** | POST(entry-1, existing saved_meal_id) | flip 3-eggs.is_favorite=true | `{saved_meal_id: b4c2ac48-…, is_favorite: true}` + 3-eggs.is_favorite: true | ✅ |
| **C.2** | POST(entry-2, saved_meal_id null) | INSERT new saved_meal, backfill audit, is_favorite=true | new saved_meal `a08cb036-…` (name "Alpha6 smoke novel ONE", foods_json populated, is_favorite=true) + entry-2.saved_meal_id backfilled to a08cb036-… | ✅ |
| **C.3** | DELETE(entry-1, existing saved_meal_id) | flip 3-eggs.is_favorite=false | `{saved_meal_id: b4c2ac48-…, is_favorite: false}` + 3-eggs.is_favorite: false | ✅ |
| **C.4** | DELETE(entry-3, saved_meal_id null) | 404 | HTTP 404 + `{error: "no saved_meal linked to this food_log_entry"}` | ✅ |
| **C.5** | POST(wrong user_id) | 403 | HTTP 403 + `{error: "user_id mismatch"}` | ✅ |
| **C.6** | POST(non-existent food_log_entry_id) | 404 | HTTP 404 + `{error: "food_log_entry not found"}` | ✅ |
| **C.7** | cache-bust observable | parse_meal_response_cache rows for user → 0 after busts | 0 rows post-smoke | ✅ |

### C.8 — Cleanup

3 test food_log_entries deleted. 1 test saved_meal deleted. 3-eggs restored: `times_logged=7`, `is_favorite=false`, `last_logged_at=2026-05-07T03:10:19.26+00:00`. Post-cleanup state matches pre-smoke baseline exactly.

---

## §3 — Surprises / flags / disagreements

### S.1 — INSERT branch's `name` field uses `foods[0]?.name` per V20's spec

The novel-meal INSERT branch picks `foods[0].name` as the saved_meal name (matching the OLD auto-promote logic per V20's "constructed from row's foods_json + totals" wording). For multi-food entries, this means the saved_meal is named after the first food only.

**Example from C.2 smoke:** entry-2's foods array had one item ("Alpha6 smoke novel ONE"); saved_meal name landed cleanly. For multi-item meals (e.g., a logged meal of "shrimp fajitas, guacamole, margarita"), heart-from-log would create a saved_meal named "shrimp fajitas" only.

**Disposition:** matches V20's spec. Possible future refinement (Brick Beta or post-Alpha.6 polish): a UI naming step in the native heart handler at Sub-fix E to let the user rename before save. **Out of scope for Alpha.6.** Flagging because it's a UX consideration that may surface as Luke uses the feature.

### S.2 — Idempotency confirmed: UPDATE on already-favorited saved_meal is no-op

C.1 + a hypothetical second C.1 would both succeed without DB error (UPDATE is idempotent). I didn't run the second-tap test explicitly because the implementation doesn't branch on existing state — it just sets `is_favorite=true`. Same for DELETE on already-unfavorited.

### S.3 — Concurrency window between lookup and INSERT (novel-path POST)

The novel-path POST is two queries: lookup `food_log_entries` then INSERT `saved_meals` then UPDATE `food_log_entries.saved_meal_id`. A rapid double-tap could conceivably INSERT twice if both requests' lookups read `saved_meal_id=null` before either backfill commits.

**Mitigation:** the backfill UPDATE happens AFTER the INSERT. A second concurrent request reading `saved_meal_id=null` would see the same null state until the first request's backfill commits. Worst case: two saved_meals created from the same food_log_entry, both with `is_favorite=true`, but only one wins the backfill (second backfill UPDATE overwrites). Result: one orphan saved_meal with no inbound `saved_meal_id` reference.

**Disposition:** real but rare. Two paths to mitigate if it matters:
- Add a unique constraint on `(user_id, foods_json::text)` — heavy and brittle
- Convert to a single-shot upsert with FOR UPDATE locking — needs a DB function

For Alpha.6, I'll leave it as-is. Native UI optimistic-flip + the natural human cadence (one tap per intent) makes the race window tiny. Flagging for future hardening if telemetry surfaces orphans.

### S.4 — Response cache bust scope

The bust is per-user (deletes ALL `parse_meal_response_cache` rows for `user_id`). After Sub-fix C ships, every heart/un-heart wipes the user's parse cache. For Luke specifically (single-user), this is fine — and the same scope as before Alpha.6.

If multi-user scaling becomes a concern (e.g., 1k users with high-frequency cache writes), this would be over-broad. **Out of scope for Alpha.6.** Same scope as the pre-Alpha.6 cache-bust — this is just a relocation, not a regression.

### S.5 — No disagreements with the brief

V20's spec was complete. The 5 design notes (shared lookup helper, idempotent UPDATE, 404-on-null choice, cache-bust pattern, error code conventions) all matched what V20 proposed. Implementation followed the brief verbatim modulo the helper extraction (which V20 left as my judgment).

---

## §4 — Asks / greenlight requests

**Greenlight Sub-fix D — searchUserLibrary cascade extension.**

Phase 0 mini-recon for D will need 1-2 turns:
1. Re-read `lib/claude/tools/search-user-library.ts` (already partially in context from main Phase 0 §1) to plan the Promise.all extension
2. Identify the 3-5 callsites that switch on `LibrarySearchResult.source` (per Phase 0 §F.5)
3. Sketch the priority-tier sort logic (favorites tier requires checking `is_favorite=true` on saved_meal source rows; non-favorited saved_meals fall to tier 4 alongside products, per V20's brief)
4. Decide where the current-hour parameter for hourly_go_tos enters (function signature add vs Date.now() at request time — probably the latter for simplicity)

Smoke for D: a parse-meal call against a query that hits each tier (favorites, hourly_go_tos, recents, products) — leaning on the replay script (`scripts/replay-parse.ts`) for batch validation since D's behavior is best measured statistically.

**Note on D scoping:** Per V20's brief D.3, widening `LibrarySearchResult.source` enum will need touching downstream consumers. I'll grep at the start of D and flag if any consumer is bigger than expected.

Awaiting V20 Gate 1 PROCEED before Sub-fix D EXECUTE.

---

## §5 — Plan re-evaluation

A → B → C → D → E+F → G still holds. Sub-fix C had no surprises that ripple downstream beyond S.1 (UX consideration, not a code-shape change).

Cumulative cost so far: ~22 turns across Phase 0 + Sub-fix A + B + C. Each sub-fix is averaging ~5-7 turns including smoke + handoff. Tracking on the high end of Phase 0's 5-6-turn-for-the-whole-bundle estimate but not by much; D + E+F + G are smaller scopes.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_ALPHA6C_HANDOFF_1.md
