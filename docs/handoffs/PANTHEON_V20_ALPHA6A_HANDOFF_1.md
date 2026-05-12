# Op FASTRAK Brick Alpha.6 Sub-fix A — Gate 1

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Sub-fix A complete and committed (both repos). Push HOLD per V20's bundle discipline. Awaiting Gate 1 review before Sub-fix B.

---

## §0 — Status

Schema layer for Alpha.6 Shape E shipped. Migrations 015 + 016 applied to live Supabase, callsite rename pass complete, type-check clean both repos, two commits authored (web + native). Recent_foods + hourly_go_tos views are queryable and returning sensible results against Luke's 42 food_log_entries / 4 saved_meals.

---

## §1 — What changed

### Web repo (commit `0a53302`)

```
M  app/api/meals/log/route.ts                 (line 134: is_staple → is_favorite; will be deleted in Sub-fix B but renamed for clean type-check between commits)
M  components/logging/QuickSelectModal.tsx    (3 callsites: 2 .order() + 1 badge; label "staple" → "favorite")
M  components/logging/SaveMealModal.tsx       (line 55: select-mode multi-save default)
M  lib/seed.ts                                (12 occurrences via sed)
M  supabase/seed.sql                          (1 column reference in INSERT)
M  types/database.ts                          (SavedMeal interface line 199)
A  supabase/migrations/015_saved_meals_favorite.sql
A  supabase/migrations/016_recent_and_hourly_views.sql
```

### Native repo (commit `90515bc`)

```
M  types/database.ts                          (SavedMeal interface line 307)
```

---

## §2 — Verification

### A.1 — Migration 015 verified live

```
saved_meals.is_favorite exists for all 4 rows (default false transferred cleanly)
saved_meals.is_staple → 42703 "column does not exist" (rename complete)
```

### A.2 — Migration 016 verified live

**recent_foods** (top 10 by recency for Luke):
```
1.  Eggs - Large                      (2026-05-08, source_ref: lib:product:9d3aa4...)
2.  Churro                            (2026-05-07, source_ref: null)
3.  Guacamole                         (2026-05-07, source_ref: usda:1853460)
4.  Tortilla chips                    (2026-05-07, source_ref: usda:1630338)
5.  Dos Equis beer (16 oz)            (2026-05-07, source_ref: usda:168746)
6.  Whipped cream                     (2026-05-07, source_ref: usda:170860)
7.  Chocolate sauce                   (2026-05-07, source_ref: usda:2710276)
8.  Shrimp fajitas with corn tortillas (2026-05-07, source_ref: usda:2708606)
9.  Margarita on the rocks            (2026-05-07, source_ref: usda:2710638)
10. Protein Shake A - Pre-Workout     (2026-05-07, source_ref: lib:saved_meal:1a2ac4..., log_count: 2)

dedup sanity: 69 total rows, 62 unique dedup_names — 7 source-ref-based variants properly distinguished.
```

**hourly_go_tos** (target_hour=12 / lunchtime, top 5 by weight):
```
1. banana                       (3 logs, weight: 0.742)
2. eggs                         (3 logs, weight: 0.325)
3. Protein Shake A - Pre-Workout (1 log, weight: 0.325)
4. blueberries                  (1 log,  weight: 0.325)
5. scrambled eggs               (1 log,  weight: 0.135)
```

Gaussian σ=2 working as designed: banana wins because its 3 logs cluster near noon; eggs has 3 logs but spread across hours; Protein Shake's single log was logged near noon so weights identically to blueberries' single near-noon log; scrambled eggs' single log is further from noon, so lower weight.

### Type-check (both repos)

```
$ npx tsc --noEmit  (web)     → clean (no output)
$ npx tsc --noEmit  (native)  → clean (no output)
```

### Final grep

```
$ grep -rn "is_staple" both repos (excluding 001_schema.sql + 015_saved_meals_favorite.sql)
→ 0 hits
```

---

## §3 — Surprises / flags / disagreements

### S.1 — `dedup_name` collision: "banana" vs "bananas"

Surfaced during `recent_foods` dedup sanity check. The top dedup_names list shows both `banana` AND `bananas` as separate rows — same root food, different surface form.

**Impact on Alpha.6:** mild. The library shortcut matcher (Sub-fix D) consumes these as candidate rows; both could surface for "banana" or "bananas" queries via the existing token-similarity scorer. Worst case: Luke sees two near-duplicate Recents entries.

**Disposition:** out of scope for Alpha.6. This is matcher territory (Brick Beta). Flagging because Sub-fix D's view-querying might surface it as a new failure mode, even though the data shape is pre-existing.

### S.2 — Migration 014's `food_log_entries.saved_meal_id` audit column not yet populated for legacy rows

The recent_foods view doesn't depend on `saved_meal_id` directly (it lateral-joins jsonb), so this isn't a regression. But for Sub-fix C's heart-handler, when Luke hearts a row whose `saved_meal_id` is NULL because it was logged pre-Alpha.7, the handler will go down the INSERT branch (correct behavior — same as if it were a fresh log). No action required, just flagging the expected behavior.

### S.3 — Web-export `--platform ios` rule still applies

Per the locked OTA_RUNBOOK, all `eas update` invocations need `--platform ios`. Sub-fix A is web-only (no native runtime change), but the cumulative bundle's Gate 2 OTA publish at the end will use this flag. Just keeping it surfaced.

### S.4 — No disagreements with the brief

V20's spec was clean. The renames went exactly where Phase 0 said. Migration shape matches the SQL drafted in Phase 0 verbatim. Nothing surfaced that suggests the remaining plan should adjust.

---

## §4 — Asks / greenlight requests

**Greenlight Sub-fix B (meals/log surgical edit).**

Sub-fix B touches `app/api/meals/log/route.ts` only. Per the brief's surgical-edit refinement (§F.6 in Phase 0):

- DELETE lines 120-144 (the `noLibraryRef || isProductRef` create branch)
- KEEP lines 98-119 (the `isSavedMealRef` increment branch — still serves times_logged + last_logged_at bumping)
- KEEP line 83 (saved_meal_id insert for the increment path)
- DELETE lines 166-177 (Alpha.7 created-path backfill — created path goes away from this route)
- DELETE lines 195-197 (Alpha.5 cache-bust — relocates to heart-handler in Sub-fix C)

savedMealAction state machine post-Sub-fix-B: `'incremented' | 'none'` only. Sub-fix B also trims the now-unreferenced `isProductRef` and `noLibraryRef` classifier flags (Phase 0 §F.6).

Awaiting V20 Gate 1 PROCEED before Sub-fix B EXECUTE.

---

## §5 — Plan re-evaluation

No revisions to the remaining sub-fix sequence. A → B → C → D → E+F → G still holds. Sub-fix A produced no surprises that ripple downstream beyond S.1 (matcher territory, not Alpha.6 scope) and S.2 (expected behavior, no action).

Cost: 6 turns (recon + 2 migration writes + apply + 6 edits + type-check + 2 commits + this handoff). Within Phase 0's 5-6 turn estimate for the full bundle proportionally — A is roughly 1/7 of the work, so ~1 turn-equivalent of effort.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_ALPHA6A_HANDOFF_1.md
