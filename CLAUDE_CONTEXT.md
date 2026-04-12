# CLAUDE_CONTEXT.md — Pantheon

**Last updated:** Session 9 (2026-04-12)
**Production:** https://pantheon-woad.vercel.app
**Deploy:** `npx vercel --prod --yes` (no git remote)

---

## What This Is

AI-native nutrition and body composition tracker. Voice/text food logging, workout tracking, weight sync (Wyze Scale X), Greek God Bod scoring, AI coaching with full CRUD. Single-user app for Luke Scroggins.

## Stack

- **Framework:** Next.js 16.2.2 (App Router, Turbopack)
- **React:** 19.2.4
- **Database:** Supabase (Postgres + Storage)
- **AI:** Claude API via `@anthropic-ai/sdk` (model: `claude-sonnet-4-20250514`)
- **Charts:** Recharts 3.8.1
- **Styling:** Tailwind v4, marble/gold visual theme
- **Fonts:** Geist (body), Cinzel (Roman numerals) — both via `next/font/google`
- **Auth:** Custom cookie-based (`pantheon_session`), not Supabase Auth

## Directory Map

```
app/
  page.tsx                    — Root redirect to /dashboard
  layout.tsx                  — Fonts (Geist, Cinzel), metadata
  globals.css                 — Tailwind v4 import, CSS vars
  login/page.tsx              — Login form
  onboarding/page.tsx         — Profile/goals wizard
  dashboard/
    page.tsx                  — Main dashboard (marble/gold theme)
    layout.tsx                — Dashboard sub-layout
  progress/page.tsx           — Charts, trends, workout history
  api/
    auth/login/route.ts       — Cookie auth (password: "gospurs")
    user/route.ts             — User profile CRUD
    claude/
      parse-meal/route.ts     — Food transcript -> structured JSON
      parse-workout/route.ts  — Workout transcript -> structured JSON + MET cal
      parse-workout-image/route.ts — Vision OCR for workout images
      score/route.ts          — 5-component score + Claude verdict
      daily-plan/route.ts     — Remaining-day meal plan generator
      coach/route.ts          — Conversational coach with 11 action types
    wyze/sync/route.ts        — Wyze Scale X weight sync

components/
  ui/
    GlassPanel.tsx            — Frosted glass card (marble theme)
    MarbleBackground.tsx      — Full-screen marble texture
  dashboard/
    ScoreCard.tsx             — Roman numeral score, auto-calculate, plan trigger
    TodayLog.tsx              — Food log display (pure, emits onEdit)
    FoodEntryEditModal.tsx    — Edit/delete food entries (standalone modal)
    CoachPanel.tsx            — Chat interface, 11 CRUD action types
    DailyPlanPanel.tsx        — AI meal plan with re-roll
    SundayCheckinCard.tsx     — TDEE gate + weekly dismiss
    WorkoutEditModal.tsx      — Edit/delete workout sessions
  logging/
    VoiceLogger.tsx           — Web Speech API + voice corrections
    WorkoutLogger.tsx         — Text/image workout logging + HEIC
    TextLogModal.tsx          — Text meal entry
    QuickSelectModal.tsx      — Saved meals quick-log with portion selector
    SaveMealModal.tsx         — Save entries as reusable meal + yield_servings
    SavedMealEditModal.tsx    — Edit saved meals + yield_servings
    ManualWeightModal.tsx     — Manual weight entry

hooks/
  useUser.ts                  — Current user profile
  useDailyLog.ts              — Food entries + totals (accepts optional dateStr)
  useWeightTrend.ts           — 7-day weight readings + latest
  useTodayWorkouts.ts         — Workout sessions (accepts optional dateStr)
  useVoiceCorrections.ts      — Voice correction learning

lib/
  claude/claude.ts            — Anthropic SDK init + meal parser prompt
  claude/calories.ts          — MET-based calorie estimation
  claude/workout.ts           — Workout parse response types
  supabase/client.ts          — Browser client (singleton)
  supabase/server.ts          — Server client (service role)
  supabase/proxy.ts           — Auth middleware
  corrections/corrections.ts  — Phonetic distance + correction logic
  wyze/wyze.ts                — Wyze API (auth, scale data, MD5)
  seed.ts                     — Test data seeder

types/
  database.ts                 — All DB types + DAY_TYPE_ADJUSTMENTS
  speech.d.ts                 — Web Speech API type stubs

supabase/migrations/
  001_schema.sql              — Full schema (10 tables, RLS enabled)
  002_voice_corrections.sql   — Voice corrections table
  003_workout_image_url.sql   — image_url column
  004_workout_calories.sql    — Calorie estimation columns
  005_yield_servings.sql      — yield_servings on saved_meals

scripts/
  backup.ts                   — Export all Supabase data to JSON
```

## Key Patterns

- **Timezone:** Always use `Intl.DateTimeFormat` with `America/Los_Angeles` for date comparisons. Never `new Date().toISOString().split('T')[0]` (UTC bug).
- **Buttons:** `type="button"` on ALL non-submit buttons (browser default form submission).
- **Dynamic import:** `import()` only for browser-only libraries (e.g., heic2any).
- **Supabase client:** `lib/supabase/client.ts` is a singleton. Server routes use `lib/supabase/server.ts` (service role).
- **Edit modal pattern:** Standalone component with `fixed inset-0 z-[60] bg-black/70`. Props: `item, onSaved, onDeleted, onClose`. Dashboard manages selection state. See FoodEntryEditModal and WorkoutEditModal.
- **Score caching:** localStorage key `pantheon_score_cache_${dateStr}`, 30-min TTL. Auto-calculates on mount and date change.
- **Date navigation:** `selectedDate` state in dashboard, default `getTodayLA()`. Passed to hooks, ScoreCard, CoachPanel. `shiftDate()` for day arithmetic. `selectedDateNoon(dateStr)` helper in CoachPanel for action timestamps.
- **Score algorithm:** 5 weighted components (protein 30%, calories 25%, workout 20%, trend 15%, macros 10%). GROSS calories vs target, not net.
- **TDEE:** `avg_daily_calories + (lbs_per_week_loss * 500)`. Gate: 14 weight readings + 10 food log days.
- **DAY_TYPE_ADJUSTMENTS:** lift (+200 cal, +50g carbs), zone2 (0, 0), rest (-150 cal, -30g carbs).
- **Recipe portions:** `saved_meals.yield_servings` (default 1). Macros scale by `servings / yield_servings`.
- **Coach actions:** 11 types. Food edits have two modes: `reparse` (new food) and `scale` (quantity change). System prompt includes entry IDs for targeting.
- **Visual theme:** Marble/gold Greco-Roman. GlassPanel for cards. Gold palette (#a47c16, #c9a03c, #e8c048). Cinzel font for Roman numerals. Both dashboard and progress page use this theme.
- **Chart width:** `overflow-x-auto` wrapper + inner div with `minWidth: '100%', width: data.length * PPP`. BAR_PPP=48, LINE_PPP=60. `barSize={32}` on BarCharts.
- **Portal for modals inside GlassPanel:** GlassPanel's `backdropFilter` creates a containing block that traps `fixed` children. Use `createPortal(jsx, document.body)` for modals rendered inside GlassPanel (e.g., SaveMealModal in TodayLog).

## Critical Open Issue

**RLS policies block browser inserts.** Custom auth means `auth.uid()` is always NULL. All client-side Supabase inserts fail silently. Server routes work because they use the service role key. Fix: run permissive RLS SQL in Supabase dashboard. Carried since Session 2.

## Session History

| Session | Key Deliverables |
|---------|-----------------|
| 1 | Full app build: auth, onboarding, food logging, weight sync |
| 2 | 7-fix session: HEIC, storage, error handling, meal edit/delete, duplicates |
| 3 | Backup script, Vercel deploy config |
| 4 | Workout calorie estimation (MET), Greek God Bod Score, AI Coach + TDEE, Sunday check-in |
| 5 | Dashboard visual redesign (marble/gold), UTC timezone fixes, tappable progress history, auto-score |
| 6 | Consistent edit modal pattern, recipe portion system, Coach full CRUD (11 action types) |
| 7 | Progress page marble/gold restyle, chart width scaling, CoachPanel restyle, SaveMealModal portal fix, Log Food button fix |
| 8 | Restyle 8 remaining dark modals to marble/gold, portion scaler in FoodEntryEditModal |
| 9 | Past-day navigation: date picker, parameterized hooks, date-keyed score cache, coach timestamps |
