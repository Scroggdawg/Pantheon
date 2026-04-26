# PANTHEON SESSION 19 — COMPLETION HANDOFF

**Date:** 2026-04-26
**Production:** https://pantheon.guru
**Previous session:** Session 18 (commit 13bcb2b — Phase 1.2 Provisions parse-recipe endpoint)
**Type:** Cleanup / dirty-tree closeout (between Phase 1.2 and Phase 1.3)

---

## ⚠️ PRODUCTION-RESTORATION COMMIT

This is **not** a normal feature commit. It restores live functionality that is currently **404'ing in production**.

### What was missing from prod

```
$ curl https://pantheon.guru/api/auth/withings
HTTP 404
```

The Withings OAuth + sync routes, the Progress page rebuild (Sessions 12–14), and the dashboard's Withings-aware sync UX were all deployed to pantheon.guru via direct `npx vercel --prod --yes` calls during Sessions 12–17. None of that work was ever committed to git — the tree had no remote at the time.

When the GitHub-Vercel pipeline went live between Sessions 16 and 17, the **first** Git-driven build was c0ac989 (Phase 1.1 Provisions schema). That commit's tree did not include any of the pre-existing dirty work, because Sessions 17 and 18 maintained scope discipline and didn't stage it. The Vercel build from c0ac989 silently overwrote the prior direct-deploy state, regressing pantheon.guru.

This commit lands the missing tree in git, which (on push + auto-deploy) restores:

- Withings OAuth flow (`/api/auth/withings` + `/callback`)
- Withings sync route (`/api/withings/sync`)
- Withings status check (`/api/withings/status`)
- Dashboard Withings-aware sync button + auto-sync on stale data
- Progress page 3-layer architecture (overview strip / Roman Wheel / DayDetailPanel)
- `WeightSource` type extension (`'withings'`)

---

## WHAT'S IN THIS COMMIT

### Code (modified)

| File | Change |
|------|--------|
| `app/dashboard/page.tsx` | Withings status check on mount, auto-sync if stale (>6h), `?withings=connected` banner, sync button branch (OAuth start vs sync), removed `/api/wyze/sync` call |
| `app/progress/page.tsx` | Sessions 12–14 rebuild: removed Recharts time-range view, added inline SVG `CalorieBars` / `WorkoutBars` / `WeightLine`, Roman Wheel drag mechanics, sticky nav, 90-day data fetch |
| `types/database.ts` | Added `'withings'` to `WeightSource` union (Phase 1.1's later additions in same file unaffected) |
| `CLAUDE_CONTEXT.md` | Sessions 12–15 updates (see deferred items — does NOT yet include 16–18) |

### Code (new)

| File | Purpose |
|------|---------|
| `app/api/auth/withings/route.ts` | OAuth redirect to account.withings.com |
| `app/api/auth/withings/callback/route.ts` | Token exchange + upsert into `withings_tokens` |
| `app/api/withings/sync/route.ts` | Token refresh, fetch measurements, dedupe, insert into `weight_readings` |
| `app/api/withings/status/route.ts` | COUNT query → `{ connected: bool }` |
| `components/progress/DayDetailPanel.tsx` | 3-accordion (Calories / Workouts / Weight) + 90-day weight chart + edit modals via `createPortal` |

### Migrations (new — already applied to live DB)

| File | What it does |
|------|--------------|
| `supabase/migrations/006_withings_tokens.sql` | `CREATE TABLE IF NOT EXISTS withings_tokens` + RLS enable |
| `supabase/migrations/007_weight_source_withings.sql` | `ALTER` `weight_readings_source_check` to allow `'withings'` |

Both were applied to remote via Session 17's `supabase migration repair --status applied`. `supabase migration list` confirms local 006/007 align with remote 006/007. SQL is idempotent (`IF NOT EXISTS`, `IF EXISTS`) — safe even if accidentally re-run. Committing is for git history + future-environment reproducibility.

### Documentation (new)

| File | What it covers |
|------|----------------|
| `PANTHEON_SESSION_12_COMPLETION.md` | Progress page full rebuild (overview strip / Roman Wheel / DayDetailPanel) |
| `PANTHEON_SESSION_13_COMPLETION.md` | Overview strip visual upgrade, DayDetailPanel stale-while-revalidate transitions |
| `PANTHEON_SESSION_14_COMPLETION.md` | `← PANTHEON` nav link on progress page header |
| `PANTHEON_SESSION_15_COMPLETION.md` | Withings Body+ integration (4 routes + dashboard wiring) |
| `PANTHEON_WARP_HANDOFF.md` | Comprehensive Warp/Terminal-Claude snapshot (label collision with current Session 18 numbering noted in C0; kept for audit value) |

---

## EXPECTED LIVE-SITE BEHAVIOR ON DEPLOY

This commit will auto-deploy to pantheon.guru via the GitHub-Vercel pipeline once pushed. Anticipated changes once the build lands:

- ✓ `GET /api/auth/withings` starts returning a 302 to account.withings.com instead of 404
- ✓ Dashboard mount triggers `/api/withings/status` successfully (no more silent 404 cascade); "connect scale" button text appears for unconnected users; "sync" appears for connected users
- ✓ Auto-sync on dashboard load resumes for users with stale (>6h) weight data
- ✓ Progress page rerenders as the 3-layer architecture (overview strip / Roman Wheel / DayDetailPanel) instead of the prior chart-heavy view
- ✓ `weight_readings.source = 'withings'` writes accepted by the DB constraint (already true — migration 007 applied — but now type-level too)

No new dependencies. No env-var additions required. Vercel scope verified before the commit:

- `WITHINGS_CLIENT_ID`, `WITHINGS_CLIENT_SECRET` → All Environments
- `ANTHROPIC_API_KEY`, `PANTHEON_NATIVE_SHARED_SECRET`, all three Supabase vars → Production scope
- Several vars carry "Needs Attention" badges (Vercel suggesting they be marked Sensitive); functional but worth a hygiene pass in a dedicated session

---

## KNOWN DEFERRED ITEMS

These were flagged in C0/C1 and explicitly scoped OUT of this commit:

1. **CLAUDE_CONTEXT.md is updated through Session 15 only.** Sessions 16 (native shared-secret middleware), 17 (Phase 1.1 Provisions schema), and 18 (Phase 1.2 parse-recipe endpoint) are not yet reflected. The file's `Deploy: npx vercel --prod --yes (no git remote)` line is also stale — the repo now has a remote and auto-deploys via GitHub. Track as a separate small doc-refresh session.

2. **Withings OAuth `redirect_uri` is hardcoded to `pantheon-woad.vercel.app`** in `app/api/auth/withings/route.ts` and the callback. The canonical `pantheon.guru` cutover requires a coordinated change with the Withings developer console (the OAuth app must accept the new URI). Future session.

3. **Vercel env-var hygiene.** Several variables carry Vercel's "Needs Attention" badge suggesting they be marked Sensitive. Pure hygiene, not a functional issue. Future session.

4. **Wyze sync route still exists** (`/api/wyze/sync`) but is no longer called by the dashboard. Removable in a cleanup session.

5. **RLS policies** still need a permissive SQL fix in the Supabase dashboard. The DayDetailPanel "+Today" button silently fails because of it. Long-standing issue, carried since Session 2.

---

## VERIFICATION

```
npx tsc --noEmit  → exit 0
npm run build     → exit 0 (run during C0 recon; staged file
                    set is identical to that working tree)
supabase migration list  → local 006/007/008 == remote
                           006/007/008
```

`git status --short` post-stage matches the C2 plan exactly. No untracked or unstaged work remaining; the staged set is the entire pre-Provisions-arc dirty tree.

---

## OPEN ITEMS

1. **Push to remote** — separate explicit approval per the new C3-vs-push protocol established this session. Once pushed, Vercel auto-deploy will land the production-restoration described above.
2. **CLAUDE_CONTEXT.md update through Session 18** — small, dedicated doc-refresh session.
3. **Phase 1.3 — Provisions UI** consuming `POST /api/claude/parse-recipe`. The next major session.

---

## NEXT SESSION CANDIDATES

- Push Session 19 + verify live-site restoration
- CLAUDE_CONTEXT.md doc refresh (Sessions 16–18)
- Phase 1.3 of Provisions (recipe-creation UI)
- Withings `redirect_uri` cutover (with Withings dev console coordination)
- Env-var hygiene pass
- Wyze route removal
- RLS fix
