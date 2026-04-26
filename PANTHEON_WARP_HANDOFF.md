# Pantheon — Warp Handoff

**Project:** `/Users/scrogdawg/BMF Headquarters/2026 - THE NARRATIVE/26_09 Pantheon/pantheon`
**Production:** https://pantheon.guru (canonical), https://pantheon-woad.vercel.app
**Deploy:** `npx vercel --prod --yes` (no git remote)
**Last session:** 18 (Progress page sticky nav fix for mobile)

---

## Read These First

1. `CLAUDE_CONTEXT.md` — full project brief, stack, directory map, key patterns
2. `PANTHEON_SESSION_15_COMPLETION.md` — Withings integration details
3. `/Users/scrogdawg/BMF Headquarters/DOCTRINE/A_TALE_OF_TWO_CLAUDES.md` — working methodology

---

## Stack (Quick Reference)

- Next.js 16.2.2 (App Router, Turbopack) · React 19.2.4
- Supabase (Postgres + Storage) · service role client pattern in `lib/supabase/server.ts`
- Claude API (`claude-sonnet-4-20250514`)
- Tailwind v4 · Geist + Cinzel fonts · marble/gold theme
- Custom cookie auth (`pantheon_session`, password: "gospurs")

---

## Outstanding SQL to Run in Supabase Dashboard

These migrations exist as files in `supabase/migrations/` but must be run manually in the Supabase SQL Editor (there's no automated migration pipeline):

**006 — withings_tokens table** (required before Withings OAuth works):
```sql
CREATE TABLE IF NOT EXISTS withings_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  withings_user_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE withings_tokens ENABLE ROW LEVEL SECURITY;
```

**007 — weight_readings source constraint** (required for Withings sync to insert):
```sql
ALTER TABLE weight_readings DROP CONSTRAINT IF EXISTS weight_readings_source_check;
ALTER TABLE weight_readings ADD CONSTRAINT weight_readings_source_check
  CHECK (source IN ('wyze_sync', 'manual', 'withings'));
```

---

## Recent Session Summary (15 → 18)

| # | What shipped |
|---|--------------|
| 15 | Withings Body+ integration: 4 API routes (OAuth + callback + sync + status), dashboard wiring, banner |
| 15.5 | Redirect URI fix (pantheon.guru → pantheon-woad.vercel.app due to SSL still provisioning) |
| 16 | Migration 007: add 'withings' to weight_readings source CHECK constraint |
| 17 | Auto-sync Withings on dashboard load if latest reading > 6 hours old (silent background fetch) |
| 18 | Progress page sticky nav bar for mobile (old header was off-screen) |

---

## Known Open Items

1. **RLS policies** — Client-side Supabase inserts fail silently (custom auth means `auth.uid()` is NULL). Carried since Session 2. +Today button on Progress page depends on this fix.
2. **pantheon.guru SSL** — Still provisioning when last checked. Withings redirect URI temporarily points to `pantheon-woad.vercel.app`. Switch back once SSL is live.
3. **Wyze sync route still exists** — Dashboard no longer calls it (Withings replaces). Can be removed in cleanup session.
4. **dayType not persisted** — Resets to 'zone2' on refresh.
5. **Coach messages not persisted** — React state only.
6. **Overview strip doesn't refresh after day edits** — Data fetched once on mount.
7. **ManualWeightModal pre-fill** — Deferred from Session 12.
8. **Pre-existing eslint warnings** — `react-hooks/set-state-in-effect` in useDailyLog and useTodayWorkouts.

---

## Environment Variables (in Vercel)

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `WITHINGS_CLIENT_ID`
- `WITHINGS_CLIENT_SECRET`
- `WYZE_EMAIL`, `WYZE_PASSWORD`, `WYZE_API_KEY`, `WYZE_KEY_ID`

---

## Rules That Never Change

- `type="button"` on ALL non-submit buttons (prevents accidental form submission)
- Dynamic `import()` only for browser-only libraries (e.g., heic2any)
- Always use `Intl.DateTimeFormat` with `America/Los_Angeles` for date comparisons — never `new Date().toISOString().split('T')[0]` (UTC bug)
- Read files before writing implementation plans
- Create files before importing them
- Deploy to production and verify in browser after each part
- End every session with a committed handoff document (`PANTHEON_SESSION_N_COMPLETION.md`) and update `CLAUDE_CONTEXT.md` to the new session number

---

## Likely Next Sessions

- Overview strip refresh after DayDetailPanel edits
- ManualWeightModal pre-fill
- Persist dayType to localStorage or user profile
- Coach conversation persistence
- RLS policy fix (permissive SQL in Supabase dashboard)
- Remove Wyze sync routes (replaced by Withings)
- Camera-based food logging (OCR → parse-meal)
- Apple Health integration for workout calories
- Weekly progress summary
- Switch Withings redirect URI back to pantheon.guru once SSL is live

---

## Quick Commands

```bash
# cd into project
cd "/Users/scrogdawg/BMF Headquarters/2026 - THE NARRATIVE/26_09 Pantheon/pantheon"

# type check
npx tsc --noEmit

# lint a specific file
npx eslint app/path/to/file.tsx

# deploy to production
npx vercel --prod --yes

# backup Supabase data
npx tsx scripts/backup.ts
```
