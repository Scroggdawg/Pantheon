# Op FASTRAK Brick Alpha.6 Shape E — Phase 0 Recon

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Phase 0 only. No code changes. Eight P0 questions answered with code-state recon + flagged surprises.

---

## §0 — Status

Phase 0 complete. Code-state recon across web + native + live Supabase. All 8 P0 questions have empirical answers below. Three surprises surfaced — one load-bearing (`is_staple` already exists), two minor (historical `foods_json` rows lack `source_ref`; tiny row counts make materialized views unnecessary).

**P0.7 cleared empirically up front:** `eas fingerprint:compare` against Build 21 returns clean — `1949eb33d497f632a2469f958a99cedf8cf7a71d` matches identically. Alpha.6 native scope (heart icon UI on TodayLog) is JS-only on the native side; ships via OTA assuming nothing in implementation drifts the fingerprint.

---

## §1 — Verbatim source for files referenced in answers

| File | Lines | What it tells us |
|---|---|---|
| `supabase/migrations/001_schema.sql` | 111-127 | `saved_meals` schema: `is_staple bool default false` already exists; `tags text[]` exists |
| `supabase/migrations/001_schema.sql` | (food_log_entries block) | `logged_at timestamptz default now()`, `foods_json jsonb`, `claude_parse_json jsonb` |
| `app/api/meals/log/route.ts` | 56-67 | Alpha.7 classifier (`isSavedMealRef`/`isProductRef`/`noLibraryRef`/`savedMealRefUuid`) already lifted to top |
| `app/api/meals/log/route.ts` | 93-158 | Auto-promote try-block — Alpha.6 deletes the `noLibraryRef \|\| isProductRef` branch (lines 120-144) but keeps the `isSavedMealRef` increment branch (lines 98-119) |
| `app/api/meals/log/route.ts` | 160-177 | Alpha.7 `created`-path saved_meal_id backfill — becomes dead code post-Alpha.6 (created path goes away from this route) |
| `app/api/meals/log/route.ts` | 195-197 | Alpha.5 cache-bust `if (savedMealAction === 'created')` — relocates to heart-handler |
| `lib/claude/tools/search-user-library.ts` | 286-298 | `Promise.all` over saved_meals + products SELECT — Alpha.6 extends to add views as additional UNION sources |
| `lib/claude/parse-meal-library-shortcut.ts` | 39 | `searchUserLibrary` is the single entry point for all three shortcut helpers — extending IT covers `tryLibraryShortcut`/`tryLibraryCandidates`/`tryLibrarySegmentedShortcut` in one shot |
| `components/dashboard/TodayLog.tsx` (web) | 130-145 | Single `<button>` per row with onClick={() => onEdit(entry)}; heart icon adds inside this row's flex container |
| `components/dashboard/TodayLog.tsx` (native) | 71-99 | Single `<Pressable>` per row, structurally identical to web; heart icon adds next to `<Text style={styles.rowCal}>` |
| `app/log-food.tsx` (native) | — | Used for parse-edit affordance only; **NOT** the food-log display path. Out of Alpha.6 scope per Shape β decision. |
| Live REST query | — | `is_favorite` does NOT exist on saved_meals (42703 error). 4 saved_meals rows + 42 food_log_entries rows total in production. |
| Live REST query | — | Sampled `foods_json` items: keys are `[qty, name, unit, fat_g, notes, carbs_g, calories, protein_g, confidence]` — **`source_ref` is NOT present in historical rows**, even though TS type marks it optional. |

---

## §2 — Eight P0 answers

### P0.1 — Schema migration shape

**SURPRISE.** `saved_meals` already has `is_staple boolean default false` (migration 001 line 123). It is currently used as:
- UI sort priority in `components/logging/QuickSelectModal.tsx:46,59`
- A "staple" badge in QuickSelectModal:229
- Auto-set to `false` in `meals/log/route.ts:134` (the auto-promote block Alpha.6 deletes) and `SaveMealModal.tsx:55`
- Set to `true` in some seed rows (`lib/seed.ts`)

Semantically, `is_staple` and the proposed `is_favorite` are the same concept (user-designated pinned meal). V20's brief named `is_favorite` because that's MacroFactor's vocabulary; the codebase already has the column under a different name.

**Three options for V20 to pick:**

- **Option A — rename `is_staple` → `is_favorite` (recommended).** Single forward-only ALTER TABLE RENAME COLUMN. Clean semantics matching MacroFactor + Alpha.6 brief. Touches ~5 callsites (QuickSelectModal sort + badge, SaveMealModal default, route.ts default, seed.sql + lib/seed.ts). Avoids two-flag confusion.

- **Option B — add `is_favorite` alongside `is_staple` (literal V20 spec).** New column, default false. Two columns with overlapping semantics until someone unifies them later. Zero migration risk but accumulates technical debt.

- **Option C — use `is_staple` as-is, skip the new column.** Smallest diff. Keeps the existing vocabulary "staple" instead of MacroFactor's "favorite". Pure rename of the user-facing affordance only.

**My read:** Option A wins on semantic clarity + matches the brief's intent + is essentially free. The only risk is web-side QuickSelectModal regression, which is one careful grep. Forward-only via `RENAME COLUMN`. Defaults transfer cleanly. Need V20's call.

### P0.2 — Postgres view shape

**Plain views, not materialized.** 4 saved_meals + 42 food_log_entries total. View execution cost is microseconds. Materialized adds refresh complexity (CRON or trigger) for zero gain at this scale. Revisit if `food_log_entries` ever crosses 10k rows per user.

**`recent_foods` view (S.2):**

```sql
-- Top-N foods per user, deduplicated on (lower(trim(name)), coalesce(source_ref, '')),
-- ordered by max(logged_at) desc. Lateral-joins jsonb_array_elements over foods_json[].
CREATE OR REPLACE VIEW recent_foods AS
SELECT
  fle.user_id,
  lower(trim(food->>'name')) AS dedup_name,
  coalesce(food->>'source_ref', '') AS dedup_source_ref,
  (food->>'name')             AS name,
  (food->>'source_ref')       AS source_ref,
  max(fle.logged_at)          AS last_logged_at,
  count(*)                    AS log_count
FROM food_log_entries fle
CROSS JOIN LATERAL jsonb_array_elements(fle.foods_json) AS food
WHERE food->>'name' IS NOT NULL
GROUP BY fle.user_id,
         lower(trim(food->>'name')),
         coalesce(food->>'source_ref', ''),
         food->>'name',
         food->>'source_ref'
ORDER BY fle.user_id, max(fle.logged_at) DESC;
```

**FLAG on dedup key:** historical `foods_json` items don't carry `source_ref` (sampled live — 0/2 had the field). Dedup on `(lower(trim(name)), coalesce(source_ref, ''))` collapses to name-only for old rows and properly distinguishes future branded variants. Pure-name dedup would conflate "banana" the produce with "Yasso banana cream pop" if both lack source_ref — coalesce-to-empty-string preserves separation when source_ref IS present. This is the right key.

**`hourly_go_tos` view (S.3):**

```sql
-- Per (user_id, target_hour 0-23): foods weighted by frequency × time-of-day proximity.
-- Gaussian falloff (sigma=2 hours) — meals within ±2h of target hour weight ~1.0,
-- ±4h weight ~0.14, ±6h weight ~0.01. Matches MacroFactor's empirical grouping.
CREATE OR REPLACE VIEW hourly_go_tos AS
WITH log_hours AS (
  SELECT
    fle.user_id,
    EXTRACT(HOUR FROM fle.logged_at)::int AS log_hour,
    food->>'name'                          AS name,
    food->>'source_ref'                    AS source_ref,
    fle.logged_at
  FROM food_log_entries fle
  CROSS JOIN LATERAL jsonb_array_elements(fle.foods_json) AS food
  WHERE food->>'name' IS NOT NULL
),
target_hours AS (
  SELECT generate_series(0, 23) AS target_hour
)
SELECT
  lh.user_id,
  th.target_hour,
  lower(trim(lh.name)) AS dedup_name,
  coalesce(lh.source_ref, '') AS dedup_source_ref,
  lh.name,
  lh.source_ref,
  -- Gaussian weight: exp(-(min(|h_diff|, 24-|h_diff|))^2 / (2*sigma^2))
  -- Wraps around midnight via min(diff, 24-diff).
  sum(exp(-power(least(abs(lh.log_hour - th.target_hour), 24 - abs(lh.log_hour - th.target_hour)), 2) / 8.0)) AS weight,
  count(*)             AS total_logs,
  max(lh.logged_at)    AS last_logged_at
FROM log_hours lh
CROSS JOIN target_hours th
GROUP BY lh.user_id, th.target_hour, lower(trim(lh.name)), coalesce(lh.source_ref, ''), lh.name, lh.source_ref;
```

Query pattern from app code:
```sql
SELECT * FROM hourly_go_tos
WHERE user_id = $1 AND target_hour = $2
ORDER BY weight DESC LIMIT 10;
```

**Sigma choice (Gaussian σ=2):** matches MacroFactor's observable behavior — a meal logged at 12pm ranks high for 11am-2pm queries, drops sharply by 4pm, near-zero by 6pm. Linear falloff would either be too forgiving (still matches at 6h offset) or too sharp (cliffs at boundary). Gaussian gives the smooth falloff users perceive as "feels right at this hour."

**The 24-hour wrap-around** in `min(|diff|, 24-|diff|)` handles "logged a meal at 11pm, target hour is 1am" → 2 hours apart, not 22. Non-trivial but correct.

### P0.3 — Library shortcut cascade integration

**Single integration point: extend `searchUserLibrary` in `lib/claude/tools/search-user-library.ts`** (currently lines 286-298 — the `Promise.all` over `saved_meals` + `products`). Change to `Promise.all([saved_meals, products, recent_foods, hourly_go_tos])`, then merge results with priority tiebreak.

This is load-bearing because `searchUserLibrary` is the SINGLE entry point used by all three downstream shortcuts (`tryLibraryShortcut`, `tryLibraryCandidates`, `tryLibrarySegmentedShortcut` — see `parse-meal-library-shortcut.ts:39`). Patching one function covers the whole shortcut cascade.

Result-merge ordering (V20's L.1 priority spec):
```typescript
matches.sort((a, b) => {
  // Priority tier first
  const tierA = a.source === 'saved_meal' && a.is_favorite ? 1 : (a.source === 'hourly_go_to' ? 2 : (a.source === 'recent' ? 3 : 4));
  const tierB = /* same logic */;
  if (tierA !== tierB) return tierA - tierB;
  // Score within tier
  return b.match_confidence.score - a.match_confidence.score;
});
```

The view-sourced candidates produce `LibrarySearchResult` objects same as saved_meal/product but with new `source` enum values + a synthesized `library_id` like `lib:recent:<name-hash>`. Source-ref pass-through preserves whatever the view returns.

**Watch:** `LibrarySearchResult.source` enum currently is `'saved_meal' | 'product'`. Alpha.6 adds `'recent' | 'hourly_go_to'`. Several downstream consumers (`source` checks in `library-shortcut.ts`, native UI, telemetry tags) need touching. Manageable — small grep.

### P0.4 — Heart-icon save handler shape

**Endpoint:** `POST /api/saved_meals/heart` (new file `app/api/saved_meals/heart/route.ts`).

**Body:**
```typescript
{
  user_id: string,
  food_log_entry_id: string,  // the row in food_log_entries the user hearted
}
```

**Behavior:**
1. Look up the food_log_entries row.
2. If `saved_meal_id` already populated → UPDATE saved_meals SET is_favorite=true (or is_staple=true under Option A/C) WHERE id = saved_meal_id. Done.
3. If `saved_meal_id` NULL → INSERT into saved_meals using foods_json + totals from the food_log_entries row (this is the OLD auto-promote logic, now triggered explicitly). Backfill `food_log_entries.saved_meal_id` afterward (Alpha.7's audit column). Set `is_favorite=true` (or whatever flag we land on) at insert time.
4. Bust response cache via `bustResponseCacheForUser` (Alpha.5 logic, relocated from meals/log:196 to here).

Idempotent on UPDATE path. POST is the right verb for the INSERT branch; PATCH would be cleaner for the existing-row update but unifying the two paths under POST keeps the client simple. Alternative: `PATCH /api/saved_meals/:id/favorite` for existing + `POST /api/saved_meals/heart-from-log` for new — splits cleanly but doubles the surface. **My read: single POST endpoint, server decides INSERT vs UPDATE.**

**Un-heart symmetry:** if Luke clicks an already-hearted row to un-favorite, `DELETE /api/saved_meals/heart` with same body → flips is_favorite back to false. (Or single endpoint with `{action: 'heart'|'unheart'}`. Bikeshed-tier.) Brief is silent — recommend including it now since the UI naturally supports toggle.

### P0.5 — Native heart icon implementation

**Mount point:** `pantheon-native/components/dashboard/TodayLog.tsx:96-97`. Inside the existing `<Pressable>` per-row, add `<Pressable onPress={...}>` with `<Ionicons name="heart" or "heart-outline" />` next to `<Text style={styles.rowCal}>`.

The row layout currently is `<View flex:1>name+time</View><Text>cal</Text>`. Heart adds as a fourth child after rowCal, with `paddingLeft: 8` and `hitSlop: 12`. Tap fires the heart-icon save handler from P0.4.

**Optimistic UI:** flip the icon name immediately on press (heart-outline → heart filled in gold), then call API, then refetch dashboard data on success. On failure, revert + show toast. Pattern matches how iOS apps universally handle favorites.

**Sync source for is_favorite state:** the food_log_entries row needs to know whether its associated saved_meal is hearted. Two paths:
- (a) Join `food_log_entries.saved_meal_id → saved_meals.is_favorite` server-side, project as `food_log_entry.saved_meal_is_favorite` in the dashboard fetch. Cleanest.
- (b) Fetch saved_meals separately in the dashboard hook, lookup by saved_meal_id client-side. More chatter.

**My read: (a).** Augment whatever endpoint feeds dashboard `entries`. One field on the response. Already-loaded data, no extra round-trip.

**Ionicons availability:** `@expo/vector-icons` already in use (`app/edit-food/[id].tsx:17`). `heart` and `heart-outline` are stock Ionicons names. Zero new dependencies.

### P0.6 — Migration ordering

**Two migrations, single PR, ordered:**

- `015_saved_meals_favorite.sql` — column rename (Option A) OR add (Option B). Forward-only via `ALTER TABLE`.
- `016_recent_and_hourly_views.sql` — both views in one file. Plain `CREATE OR REPLACE VIEW`. Idempotent.

Order matters only if Option A is chosen AND the views reference is_favorite (they don't — views project from food_log_entries, not saved_meals). Either way, 015 → 016 works.

**Rollback:** views drop cleanly via `DROP VIEW IF EXISTS recent_foods, hourly_go_tos`. Column rename is unidirectional in production data sense (existing `is_favorite=true` would map back to `is_staple=true` lossfully). Forward-only is the correct stance per V20's brief.

**Apply via** `supabase db push --linked` same as migration 014 (Alpha.7).

### P0.7 — OTA-vs-EAS verdict

**Cleared empirically before recon started.** Output:

```
✅ Fingerprint 1949eb33d497f632a2469f958a99cedf8cf7a71d from IOS build matches
   fingerprint 1949eb33d497f632a2469f958a99cedf8cf7a71d from local directory
```

**Alpha.6 ships via `eas update --branch production --platform ios` against Build 21's runtime** assuming implementation stays JS-only on native side. No `app.json` changes, no `eas.json` changes, no `patches/` edits, no new native modules → fingerprint unchanged → OTA flow per `OTA_RUNBOOK.md`.

Re-run `eas fingerprint:compare --build-id 575a26ab-4de8-498a-b040-5567c661efbc` at Alpha.6 Gate 1 (just before publish) to catch incidental drift. Per the locked memory rule, that's the authoritative tool — not `npx @expo/fingerprint generate`.

### P0.8 — Test cleanup ordering (T.1)

**Recommend bundling T.1 into Alpha.6, not deferring.** Reason: Alpha.6 expands the matcher's data sources (recent_foods + hourly_go_tos views) — the existing `scripts/test-segmented-library.ts` would test against the OLD shape with stale CASES. Rewriting CASES in the same brick lets us write them against the NEW data sources from the start. Fixing it as a follow-on means writing them twice or accepting test debt.

**T.1 scope inside Alpha.6:** rewrite `CASES` array using current 4 saved_meals as fixture inputs + add 2-3 cases that exercise the new view paths (recent-only hit, hourly-only hit). Keep the existing test runner harness (it works fine; only the case data is stale).

If Phase 0 + EXECUTE budget is tight, T.1 can defer to a separate small brick — but the bundling argument is real.

---

## §3 — Flags / surprises / disagreements with the spec

### F.1 — `is_staple` already exists (LOAD-BEARING — V20 needs to pick A/B/C)

Per P0.1. The brief said "add `is_favorite`" without knowing about the existing column. Three options: rename (A, recommended), add-alongside (B, literal spec), use-existing (C, smallest diff). Need V20's call before EXECUTE.

### F.2 — Historical `foods_json` items lack `source_ref`

Per P0.2 dedup-key flag. Live-sampled 2/2 entries had no `source_ref` field. Future entries created post-Alpha.7 do (the FoodItem type writes it for library-resolved foods). Dedup on `(lower(trim(name)), coalesce(source_ref, ''))` handles both. Worth flagging now so V20 knows the recent_foods view will dedup more aggressively for old data than for new.

### F.3 — Tiny scale → plain views, not materialized

4 saved_meals + 42 food_log_entries (live count). Plain views are correct. If V20's brief implicitly assumed materialized + refresh logic, it doesn't. Documented in P0.2.

### F.4 — `searchUserLibrary` is the single matcher entry point

P0.3 follows from this. All three shortcut helpers route through it. Extending one function covers the whole cascade. This is good news (less surface area) but worth saying explicitly because it constrains where view-querying can happen — anywhere else and you fork the logic.

### F.5 — `LibrarySearchResult.source` enum needs widening

`'saved_meal' | 'product'` → `'saved_meal' | 'product' | 'recent' | 'hourly_go_to'`. Small grep, but TS will surface every consumer that exhaustively switches on `source`. Probably ~3-5 callsites. Manageable, just inventory at EXECUTE time.

### F.6 — meals/log route post-Alpha.6 still needs `incremented` + audit-column work

The deletion plan says "delete auto-promote block at lines 80-134" but the `isSavedMealRef` increment branch (lines 98-119) STAYS — it serves the case where a user logs an existing-favorited saved_meal and we need to bump `times_logged` + `last_logged_at` for hourly_go_tos weighting. Only the `noLibraryRef || isProductRef` branch (lines 120-144) deletes. Same for the cache-bust at line 195-197 (relocates) but the Alpha.7 saved_meal_id insert at line 83 + backfill at 166-177 — the insert STAYS for the increment path; the backfill becomes dead code (created path no longer exists in this route, moves to heart-handler).

This is a refinement of V20's R.1/R.2/R.3 — surgically more selective than "delete the block."

### F.7 — Un-heart toggle UX not in brief

Per P0.4 ending. Recommend including. Brief is silent.

### F.8 — `is_favorite` sync to dashboard requires API touch

Per P0.5 sync source recommendation (a). The dashboard endpoint that returns `entries` for TodayLog needs to project `saved_meal_is_favorite` into each entry. Small change; just flagging it's not zero-touch.

---

## §4 — Explicit asks / greenlight requests for next gate

**A.1 — V20 picks A/B/C on the `is_staple` overlap (F.1).** This decision is the long pole — affects migration 015 shape, route.ts:134, QuickSelectModal sort, SaveMealModal default, seed.sql. Recommend Option A (rename). Awaiting decision.

**A.2 — V20 confirms hourly_go_tos Gaussian σ=2 vs alternative.** P0.2 picked σ=2 based on MacroFactor empirical reading; V20 may have data from the screenshots that points toward σ=1.5 or linear instead. Easy to change in migration 016 — single number.

**A.3 — V20 confirms recent_foods deduplication strategy.** Brief said "name + source_ref" — I propose `(lower(trim(name)), coalesce(source_ref, ''))` per F.2. Same intent, handles missing source_ref gracefully. Confirm or override.

**A.4 — V20 confirms heart endpoint shape: single POST or split POST/PATCH/DELETE.** P0.4. Recommend single POST with server-side decides INSERT-vs-UPDATE + matching DELETE for un-heart. Awaiting confirmation.

**A.5 — V20 confirms T.1 bundles into Alpha.6 vs defers.** P0.8. Recommend bundle. Awaiting decision.

**A.6 — V20 confirms web `<TodayLog>` heart-icon UI shape.** Web has an existing "Select" mode that lets users multi-select rows + "Save as Meal" (which I re-read at TodayLog.tsx:130-145). Three coexistence options:
- Per-row heart icon alongside select-mode multi-save (additive — both affordances live)
- Replace select-mode entirely with per-row heart (subtractive — one affordance)
- Per-row heart only on already-saved entries; select-mode handles novel rows (mixed)
Recommend additive — heart toggles favoritism on already-logged rows; select-mode is for the multi-row meal-save use case (different intent). V20's brief didn't address it.

**A.7 — Greenlight for EXECUTE on Alpha.6 once A.1-A.6 are answered.** I'll write the migrations + route changes + native heart icon + web heart icon + T.1 case rewrite as a single brick. Estimate: 1 turn for migrations, 1-2 for route changes, 1 for native UI, 1 for web UI, 1 for T.1 = 5-6 turns + replay validation. OTA publish at Gate 2.

---

## §5 — Filename + handoff link

Per locked filename convention `<PROJECT>_<VERSION>_<OP>_<TYPE>_<N>.md` ≤40 chars: `PANTHEON_V20_ALPHA6_RECON_1.md` (28 chars).

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_ALPHA6_RECON_1.md
