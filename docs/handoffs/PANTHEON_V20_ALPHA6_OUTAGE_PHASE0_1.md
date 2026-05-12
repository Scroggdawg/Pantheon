# Op FASTRAK Brick Alpha.6 — Production outage Phase 0 + emergency push diagnostic

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Phase 0 only. No code changes, no commits, no pushes, no eas updates this turn. Empirical findings + recommendation on emergency push.

---

## §0 — Status

V20's hypothesis CONFIRMED empirically. Three production runtime breaks (not just one). Push of 7 web + 2 native commits resolves all three. Fingerprint should still hold for OTA but needs final-pre-publish verification. Skipping bundle measurement + Sub-fix G is safe; both are non-production-impact. One doctrine memory rule worth saving.

---

## §1 — Verbatim findings

### F.1 — Hypothesis confirmed (P0.1)

`is_staple` references in production code at `origin/main` (commit `179a19b`, "Alpha.4.1: track original segment alongside stripped"):

```
origin/main:app/api/meals/log/route.ts:           is_staple: false,         ← RUNTIME (Luke's outage)
origin/main:components/logging/QuickSelectModal.tsx:  .order('is_staple', { ascending: false }) (×2)
origin/main:components/logging/QuickSelectModal.tsx:  {meal.is_staple && (
origin/main:components/logging/SaveMealModal.tsx: is_staple: false,         ← RUNTIME (Save as Meal flow)
origin/main:lib/seed.ts                           is_staple: true (×11 — dev seed only)
origin/main:lib/run-seed.mjs                      is_staple in INSERT (dev-only)
origin/main:supabase/seed.sql                     is_staple in INSERT (dev-only)
origin/main:supabase/migrations/001_schema.sql    is_staple boolean default false (historical, harmless)
```

The error message shape matches: production route.ts:139-140 throws `saved_meals insert failed: ${insErr?.message}` and then catches at the compensation-level wrapper which produces `saved_meals step failed (food_log_entries rolled back): saved_meals insert failed: ...`. Identical to Luke's TestFlight error message.

### F.2 — Live Supabase schema state (P0.2)

```
GET /rest/v1/saved_meals?select=is_favorite&limit=1
→ [{"is_favorite":false}]   ✓

GET /rest/v1/saved_meals?select=is_staple&limit=1
→ {"code":"42703","message":"column saved_meals.is_staple does not exist"}  ✓
```

### F.3 — Push scope (P0.3)

**Web commits ahead of `origin/main` (7):**
```
8d0c48b  Sub-fix F  — TodayLog per-food cards + heart UI
6279336  Sub-fix C.1 — heart endpoint accepts food_index
37384c1  Sub-fix D.1 — drop recent_foods (unreachable tier)
0b2105a  Sub-fix D   — searchUserLibrary cascade extension
b3aec2c  Sub-fix C   — heart-icon save/un-save handler
4908489  Sub-fix B   — meals/log surgical edit (Shape E redesign)  ← RESOLVES Luke's outage at the route
0a53302  Sub-fix A   — schema migrations + is_staple→is_favorite rename  ← RESOLVES SaveMealModal + QuickSelectModal
```

**Native commits ahead of `origin/main` (2):**
```
a76b587  Sub-fix E — TodayLog per-food cards + heart UI
90515bc  Sub-fix A — rename SavedMeal.is_staple→is_favorite
```

V20's plan (7 web + 2 native) confirmed. No surprises in scope.

### F.4 — Fingerprint (P0.4)

Last `eas fingerprint:compare` (Sub-fix E commit moment) returned `1949eb33d497f632a2469f958a99cedf8cf7a71d` matching Build 21's runtime exactly. **No native files have changed since that check.** Re-running before OTA publish is the locked discipline; should still match.

---

## §2 — Three production breaks (not one)

Luke hit #1; #2 and #3 are latent (he hasn't tried them in the post-A-applied / pre-push window).

| # | Code path | Break shape | Trigger | Severity |
|---|---|---|---|---|
| **1** | `app/api/meals/log/route.ts:134` (auto-promote INSERT) | INSERT with `is_staple: false` → 42703 → entry rolled back, log fails | Logging any food whose `library_source_ref` is null OR `lib:product:*` (anything not a saved_meal) | OUTAGE — Luke hit this |
| **2** | `components/logging/SaveMealModal.tsx:55` | INSERT with `is_staple: false` → 42703 → "Failed to save meal" toast | "Save as Meal" multi-select recipe flow on web dashboard | LATENT |
| **3** | `components/logging/QuickSelectModal.tsx:46+59` | `.order('is_staple', {ascending: false})` → 42703 → setMeals([]) → empty quick-select picker | Opening the Quick Select picker on web | DEGRADED (silent — list shows empty) |

All three resolve when `git push origin main` lands the 7 web commits and Vercel rebuilds. Sub-fix A's rename pass already updated all four lines + the seed files.

**No production paths break that the push doesn't fix.** Verified via grep.

---

## §3 — Pre-flight risks (P0.5) + flags

### Risk R.1 — Vercel auto-deploy could fail at build time (low)

The push triggers `next build` on Vercel. Type-check passes locally (verified at every Sub-fix Gate). New files: `lib/favorites.ts`, `app/api/saved_meals/heart/route.ts`, two new migrations (already applied to live; the SQL files exist in repo but don't run during web build). New imports in TodayLog/FoodEntryEditModal/dashboard page all resolve to local files.

If Vercel build fails: production stays on `179a19b` (current broken state) until we fix and re-push. Recoverable; no new risk introduced. **Action:** monitor Vercel deploy and confirm green before publishing OTA.

### Risk R.2 — OTA published before web deploy lands creates 404 window (medium)

Native client post-OTA calls `apiFetch("/api/saved_meals/heart", ...)`. That endpoint exists ONLY after web deploy succeeds. If we publish OTA while web is still building, native heart taps return 404. Window is short (~2-3 min) and the failure is non-destructive (heart toggle reverts via the existing optimistic-UI error path), but worth ordering correctly.

**Recommended order:**
1. `git push origin main` (web)
2. **Wait for Vercel deploy to go green** — verify by curling pantheon.guru and seeing the new heart endpoint return 4xx instead of 404 (e.g., curl POST /api/saved_meals/heart with empty body → expect 400 "invalid JSON body")
3. `git push origin main` (native, archival only)
4. `eas fingerprint:compare --build-id 575a26ab-…` → confirm clean
5. `eas update --branch production --platform ios --message "Op FASTRAK Alpha.6 emergency: per-food cards + library redesign"`
6. Luke cold-starts iPhone

### Risk R.3 — No additional risks identified

- New `/api/saved_meals/heart` route: standard Next.js handler, no setup-time side effects.
- `proxy.ts` change: const array entry, no side effects.
- Migrations 015/016/017/018: all already applied to live Supabase. No new migrations apply during push.
- `lib/favorites.ts` (web + native): pure helper module, no side effects.
- Web `TodayLog`/`FoodEntryEditModal`/dashboard page: client components ('use client'), shape matches what Vercel already builds.
- Native fetch shape: independent of web fetch shape (both query Supabase directly via separate clients). No cross-platform contract that breaks during the partial-deploy window.

### F.5 — One subtlety worth flagging

The Vercel cache HIT on `/api/auth` is unusual for an API route (`x-vercel-cache: HIT`). Could be a stale CDN entry. Should auto-invalidate on next deploy, but if the new heart endpoint shows up cached-not-yet-existing (404 cached), might need `vercel deploy --prod --force` or wait for cache TTL. Low probability; flagging.

---

## §4 — Asks / recommendations

### A.1 — V20 issues EXECUTE brief for emergency push

Recommend the order above (R.2). Specifically:

1. **Push web first** (7 commits) and wait for green Vercel deploy
2. **Verify deploy** by hitting `/api/saved_meals/heart` with bad body, expecting 400 (not 404 = endpoint exists)
3. **Run `eas fingerprint:compare`** locally (re-verify; last check was clean)
4. **Push native** (archival only, doesn't trigger deploy)
5. **Publish OTA** with `--platform ios`
6. **Luke cold-starts** twice on iPhone (Pattern A silent fetch then apply)
7. **Verify outage resolved** — Luke retries McDonald's log

Order is conservative — prevents the OTA-before-web-deploy 404 window.

### A.2 — Skip bundle measurement + Sub-fix G pre-push (P0.6)

**Confirmed safe.** Bundle measurement (`scripts/replay-parse.ts`) and Sub-fix G (test-segmented-library.ts CASES rewrite) are both pure dev tooling. No production-impact from deferring.

**Recommended:** run bundle measurement POST-deploy (against the live deployed routes) for empirical confirmation. If a regression surfaces, `eas update:rollback` (native) + Vercel revert (web) are both available. Run G whenever its brief lands; it's been outstanding since post-D.1.

### A.3 — Save the doctrine memory rule (P0.7)

**Recommend saving.** This is a real systemic risk that recurs across the doctrine — same pattern family as the eas-fingerprint-shift and the eas.json schema-validation rules.

Specifically, the rule I'd save (with refinement):

> **Schema migrations that REMOVE or RENAME columns must ship simultaneously with the matching code push. Forward-compatible migrations (adding column with default, adding table, adding view) are safe to apply ahead of code; forward-INCOMPATIBLE migrations create an outage window from `supabase db push` until `git push origin main` + Vercel deploy lands.**
>
> **Why:** Pantheon's setup decouples schema mutation (immediate via `supabase db push`) from code deploy (delayed by `git push` + Vercel build). A forward-incompatible migration applied ahead of code creates a window where production code references columns/shapes that no longer exist. Sub-fix A's `is_staple → is_favorite` rename applied to live Supabase ahead of the matching code push; Luke hit the resulting 42703 error logging McDonald's items 6 sub-fixes later.
>
> **How to apply:** Before running `supabase db push`, classify the migration:
> - Forward-compatible (additive): safe to apply ahead of bundle push. Production code doesn't reference the new shape; nothing breaks.
> - Forward-incompatible (RENAME COLUMN, DROP COLUMN, ALTER TYPE, DROP VIEW that production reads): **defer until bundle is push-ready**, OR apply atomically with the code push (push + supabase db push back-to-back, with rollback playbook ready). Single-tenant Pantheon at present makes this lower-stakes than multi-tenant SaaS, but the outage window is real.

Save as `feedback_schema_code_atomic.md`. Index in MEMORY.md alongside the existing eas/fingerprint rules.

### A.4 — Future bricks affected

Brick Gamma (PANTRY) per the audit-revised sequence will likely involve schema migrations. The new memory rule above applies. Sub-fixes that touch shape (column rename / drop / type change) should batch with the code push.

---

## §5 — Plan re-evaluation

V20's emergency push proposal is sound. No changes to the plan from my side. The three latent breaks (#2, #3) are bonus fixes that ride along — recommend mentioning to Luke after push so he knows Quick Select + Save-as-Meal are restored too.

Sub-fix G stays deferred. Bundle measurement runs post-deploy for empirical confirmation (and can fold into Sub-fix G's eventual Gate 2 measurement if both land in the same window).

After push + deploy + OTA + Luke cold-start cycle confirms outage resolved → Brick Alpha.6 closes. Brick Gamma queued.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_ALPHA6_OUTAGE_PHASE0_1.md
