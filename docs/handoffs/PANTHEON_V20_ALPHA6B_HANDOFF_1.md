# Op FASTRAK Brick Alpha.6 Sub-fix B — Gate 1

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Sub-fix B complete and committed (web only — native untouched). Push HOLD per V20's bundle discipline. Awaiting Gate 1 review before Sub-fix C.

---

## §0 — Status

`meals/log` route surgically edited per Phase 0 §F.6 refinement. Auto-promote create path deleted; increment-only path preserved. Empirically validated against live Supabase (3 POSTs against the dev server, all matching expected response shape and DB state). Cleanup complete — Luke's saved_meals + food_log_entries are back at exact pre-smoke baseline.

Commit: `4908489` (web). Native untouched.

---

## §1 — What changed

```
M  app/api/meals/log/route.ts    (-86 / +25 lines net deleted)
```

Diff summary:

| Range | Disposition |
|---|---|
| Header comment (lines 1-13) | Rewritten for Alpha.6 semantics |
| `import bustResponseCacheForUser` | Deleted (still exported from `lib/claude/parse-meal-response-cache.ts` for Sub-fix C) |
| `SavedMealAction` type union | `'incremented' \| 'created' \| 'none'` → `'incremented' \| 'none'` |
| `isProductRef`, `noLibraryRef` classifiers | Deleted (no longer referenced) |
| `isSavedMealRef` + `savedMealRefUuid` | Kept (audit column still threads through) |
| Lines 120-144 (create branch) | Deleted |
| Lines 166-177 (Alpha.7 created-path backfill) | Deleted |
| Lines 195-197 (Alpha.5 cache-bust) | Deleted (relocates to Sub-fix C) |
| Compensation catch block | Kept; error-message text refined to "saved_meals update step failed" |

---

## §2 — Verification

### B.1 — Type-check (web)

```
$ npx tsc --noEmit  →  clean (no output)
```

### B.2 — Stale-reference grep

```
$ grep "isProductRef|noLibraryRef|bustResponseCacheForUser|'created'" route.ts
→ 0 hits
```

### B.3 — Empirical smoke (dev server, three POST paths)

Test setup:
- Dev server: `npm run dev` on localhost:3000
- Auth: `x-pantheon-native-secret` header per `proxy.ts:30-54` (NATIVE_ROUTES gate)
- Baseline captured + restored post-smoke

| Test | library_source_ref | Expected | Observed | Pass |
|---|---|---|---|---|
| **A — increment** | `lib:saved_meal:b4c2ac48-…` (3 eggs) | `action='incremented'`, saved_meal_id matches, times_logged 7→8, last_logged_at bumped | `{food_log_entry_id: d47fd7d9-…, saved_meal_id: b4c2ac48-…, saved_meal_action: 'incremented'}` + saved_meals.times_logged: 7→8 + last_logged_at: 2026-05-07 → 2026-05-08T14:46:28 + food_log_entries.saved_meal_id audit threaded | ✅ |
| **B — null ref** | `null` | `action='none'`, saved_meal_id=null, no new saved_meal | `{food_log_entry_id: aa2b769b-…, saved_meal_id: null, saved_meal_action: 'none'}` + saved_meals row count: 4 (unchanged) + food_log_entries.saved_meal_id: null | ✅ |
| **C — product-ref** | `lib:product:9d3aa4fe-…` (Eggs - Large) | `action='none'`, saved_meal_id=null, no new saved_meal | `{food_log_entry_id: 4295c81d-…, saved_meal_id: null, saved_meal_action: 'none'}` + saved_meals row count: 4 (unchanged) + food_log_entries.saved_meal_id: null | ✅ |

### B.4 — Cleanup

3 test food_log_entries deleted. 3-eggs `times_logged` restored to 7, `last_logged_at` restored to 2026-05-07T03:10:19.26+00:00. Final post-cleanup state matches pre-smoke baseline.

---

## §3 — Surprises / flags / disagreements

### S.1 — Next.js 16 uses `proxy.ts` not `middleware.ts`

When the first round of dev-server smoke returned `/login` redirects, I traced the cause to `proxy.ts` (the Next.js 16 equivalent of middleware.ts). `/api/meals/log` is whitelisted as a NATIVE_ROUTE accepting `x-pantheon-native-secret` header (env: `PANTHEON_NATIVE_SHARED_SECRET`).

**Implication for Sub-fix C:** the new `/api/saved_meals/heart` endpoint will hit the same proxy gate. It needs adding to `NATIVE_ROUTES` in `proxy.ts:3-17` so the native client (and dev-server smoke tests) can reach it via shared-secret header.

**Add to Sub-fix C scope:** `proxy.ts` NATIVE_ROUTES list update.

### S.2 — `SavedMealAction` 'created' value still appears in client code

Native + web client code may have switch statements or callsites that branch on `savedMealAction === 'created'`. Pre-Alpha.6 this was reachable; post-B it's structurally impossible. TS will flag exhaustive switches but loose `if (action === 'created')` checks won't error.

**Inventory at Sub-fix E + F:** grep for `savedMealAction === 'created'` and `saved_meal_action` string matches in pantheon-native and pantheon-web. Likely 0-2 callsites; trim during the UI work.

Quick check now from the web side:
```
$ grep -rn "saved_meal_action.*created\|savedMealAction.*created" --include="*.ts" --include="*.tsx" .
```
(Will run at Sub-fix E phase 0 — flagging now so it's not forgotten.)

### S.3 — Compensation catch is now narrower-scope but unchanged

The catch block previously caught failures from EITHER the saved_meals lookup-then-update OR the saved_meals INSERT. Post-B, only the lookup-then-update can throw. The compensation logic (DELETE the food_log_entries row) still applies, so the catch stays functionally correct. Just narrower in failure modes — flagging because future debugging won't see "INSERT failed" in this code path.

### S.4 — No disagreements with the brief

Surgical scope per V20's verbatim brief executed cleanly. Save_meals row count, audit column threading, type-check, and the 3-path response shape all match expectations.

---

## §4 — Asks / greenlight requests

**Greenlight Sub-fix C — heart-icon save handler.**

Phase 0 mini-recon for C will need ~1 turn:
1. Read `lib/claude/parse-meal-response-cache.ts` to confirm `bustResponseCacheForUser` signature
2. Plan the new `app/api/saved_meals/heart/route.ts` shape:
   - POST: lookup food_log_entry → if saved_meal_id present, UPDATE is_favorite=true on saved_meals; else INSERT new saved_meal + UPDATE food_log_entries.saved_meal_id
   - DELETE: same lookup → UPDATE is_favorite=false on the linked saved_meal (404 if no saved_meal_id)
3. Add `/api/saved_meals/heart` to `proxy.ts` NATIVE_ROUTES (per S.1 flag above)

Smoke for C will follow the same dev-server + shared-secret pattern that worked for B.

Awaiting V20 Gate 1 PROCEED before Sub-fix C EXECUTE.

---

## §5 — Plan re-evaluation

Sequence A → B → C → D → E+F → G still holds. Sub-fix B introduced two refinements:

- **C scope expands by 1 line:** `proxy.ts` NATIVE_ROUTES list (per S.1)
- **E + F scope expands by ≤1 grep + maybe 1-2 line trim:** `'created'` string callsites in client code (per S.2)

Both are trivial. No structural changes to the remaining brick.

Cumulative cost so far: ~15 turns across Phase 0 + Sub-fix A + Sub-fix B. Phase 0 estimated 5-6 turns for the whole bundle; we're tracking ahead because A + B were both surgical.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_ALPHA6B_HANDOFF_1.md
