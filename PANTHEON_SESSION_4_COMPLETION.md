# PANTHEON SESSION 4 — COMPLETION HANDOFF

**Date:** 2026-04-10
**Production:** https://pantheon-woad.vercel.app
**Latest commit:** `c1e45ad` (Fix: constrain score verdict/recommendation length in prompt)
**Backup:** `backups/pantheon-backup-2026-04-10.json` (8 rows, 7.5 KB)

---

## WHAT WAS BUILT

### Part 1 — Workout Calorie Estimation (`d2bc4d9`)
- MET-based calorie estimation in `lib/claude/calories.ts`
- Both parse-workout routes now fetch user weight and compute estimated calories
- WorkoutLogger shows calorie estimate after save, tap-to-adjust override
- Progress page: workout type filter, calorie burn chart, distance chart, history table
- SQL migration: 6 new columns on `workout_sessions`, unique constraint on `weekly_checkins`

### Part 2 — Greek God Bod Score (`db9f78a`)
- Score API at `/api/claude/score` — 5 weighted components computed in TypeScript, Claude generates verdict/recommendation only
- ScoreCard component with localStorage caching (30-min TTL), Calculate/Recalculate/See Plan buttons
- Daily plan API at `/api/claude/daily-plan` — fetches saved meals + pantry, low-cal short-circuit, Claude generates meal plan
- DailyPlanPanel with re-roll logic (previous plan stored in ref, 60s muted display), save meal integration

### Part 3 — AI Coach + TDEE (`7504b4b`)
- Coach API at `/api/claude/coach` — full context injection (food, workouts, weight, TDEE), returns message + optional action
- CoachPanel: bottom-left tab, expands to 60vh panel, hides LogFAB when open
- Action execution: log_workout (direct Supabase insert), log_food (parse-meal then insert), update_day_type (setState)
- SundayCheckinCard: LA-timezone Sunday detection, TDEE gate (14 readings + 10 log days), dismiss inserts weekly_checkins row
- TDEE formula: avg_daily_calories + (lbs_per_week_loss × 500)

### Bug Fixes
- `641cb4d`: Added `type="button"` to all buttons in ScoreCard and DailyPlanPanel
- `c1e45ad`: Constrained Claude verdict (<120 chars) and recommendation (<200 chars) in score prompt

---

## COMMIT LOG

```
c1e45ad Fix: constrain score verdict/recommendation length in prompt
7504b4b Part 3: AI Coach + TDEE + Sunday check-in
641cb4d Fix: add type=button to ScoreCard and DailyPlanPanel buttons
db9f78a Part 2: Greek God Bod Score + daily meal plan
d2bc4d9 Part 1: workout calorie estimation
c4e756e Session 4: implementation plan pre-review
c4b639f Add Session 4 handoff: Greek God Bod Score + workout calorie estimation
```

---

## NEW FILES (10)

```
lib/claude/calories.ts                          106 lines — MET estimation helper
hooks/useTodayWorkouts.ts                        38 lines — today's workouts hook
app/api/claude/score/route.ts                   258 lines — score calculation API
app/api/claude/daily-plan/route.ts              199 lines — meal plan generator API
app/api/claude/coach/route.ts                   223 lines — conversational coach API
components/dashboard/ScoreCard.tsx               233 lines — score display + plan trigger
components/dashboard/DailyPlanPanel.tsx          237 lines — plan with re-roll + save
components/dashboard/CoachPanel.tsx              260 lines — floating chat panel
components/dashboard/SundayCheckinCard.tsx       175 lines — weekly TDEE check-in
supabase/migrations/004_workout_calories.sql     16 lines — schema migration reference
```

## MODIFIED FILES (7)

```
types/database.ts                               — CalEstimateMethod type, 6 new WorkoutSession fields
lib/claude/workout.ts                           — distance_miles, activity_detail in ParsedWorkoutResponse
app/api/claude/parse-workout/route.ts           — weight fetch + calorie estimation
app/api/claude/parse-workout-image/route.ts     — weight fetch + calorie estimation
components/logging/WorkoutLogger.tsx             — 'done' stage with cal display + tap-to-adjust
app/progress/page.tsx                           — workout filter, calorie/distance charts, history table
app/dashboard/page.tsx                          — ScoreCard, CoachPanel, SundayCheckinCard, useTodayWorkouts
```

---

## CURRENT DASHBOARD LAYOUT (390px mobile)

1. Header (PANTHEON + date + Progress link)
2. DayTypeToggle (lift / zone2 / rest)
3. SundayCheckinCard (Sunday only, dismissible)
4. CaloriesRemainingCard
5. MacroBars (protein / carbs / fat)
6. **ScoreCard** (Calculate → Roman numeral + verdict + See Plan)
7. WeightCard
8. Log Workout button
9. Today's Log
10. LogFAB (bottom-right, hidden when Coach open)
11. **Coach tab** (bottom-left, expands to 60vh panel)

---

## API ROUTES

| Route | Method | Purpose | Claude call? |
|-------|--------|---------|-------------|
| `/api/claude/parse-meal` | POST | Parse food transcript | Yes (sonnet) |
| `/api/claude/parse-workout` | POST | Parse workout transcript + cal estimate | Yes (sonnet) |
| `/api/claude/parse-workout-image` | POST | Parse workout image + cal estimate | Yes (sonnet, vision) |
| `/api/claude/score` | POST | Compute score components + verdict | Yes (sonnet, 300 tokens) |
| `/api/claude/daily-plan` | POST | Generate remaining-day meal plan | Yes (sonnet, 1500 tokens) |
| `/api/claude/coach` | POST | Conversational coach with actions | Yes (sonnet, 600 tokens) |

---

## SCORING ALGORITHM

| Component | Weight (with trend) | Weight (no trend) |
|-----------|-------------------|------------------|
| Protein | 30% | 35% |
| Calories | 25% | 30% |
| Workout | 20% | 20% |
| Weight trend | 15% | 0% |
| Carbs+Fat | 10% | 15% |

- Score range: 0-10, displayed as Roman numerals I-X
- Calories = GROSS food intake vs day_type target (NOT net after workout burns)
- Workout: rest=10 auto, matching type=10, before 2pm no workout=5, after 2pm no workout=0
- Weight trend: linear lbs/week, target 1.3, <3 readings redistributes to protein+calories
- LocalStorage cache: 30-min TTL, key `pantheon_score_cache`

---

## TDEE ESTIMATION

- **Gate:** >= 14 weight readings AND >= 10 distinct food log days
- **Formula:** TDEE = avg_daily_calories + (actual_lbs_per_week_loss × 500)
- **Used in:** Coach route (context injection) + SundayCheckinCard
- **Sunday check-in:** Inserts `weekly_checkins` row on dismiss, `ON CONFLICT (user_id, week_of) DO NOTHING`

---

## KNOWN ISSUES / OPEN ITEMS

1. **RLS policies** — Still need SQL fix in Supabase dashboard (carried from Session 2)
2. **Pre-existing eslint warnings** — `logLoading`/`weightLoading` unused in dashboard, `<img>` in WorkoutLogger, `set-state-in-effect` in 3 hooks, `WYZE_API_BASE` unused
3. **No git remote** — Deploys via `npx vercel --prod --yes` directly, no git push
4. **dayType not persisted** — Lives in `useState('zone2')`, resets on refresh
5. **Coach messages not persisted** — React state only, cleared on navigation
6. **Camera logging** — `onCamera` handler is still a no-op placeholder

---

## SESSION 5 CANDIDATES

- Persist dayType to localStorage or user profile
- Camera-based food logging (OCR → parse-meal)
- Pantry tracking UI
- Apple Health integration for workout calories
- Coach conversation persistence (optional)
- Weekly progress summary email/notification
- Barcode scanning for food items
