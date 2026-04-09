# PANTHEON — Session 4 Handoff
*Generated: April 9, 2026 — End of Session 3 Planning*

---

## PREREQUISITE: SESSION 3 MUST COMPLETE FIRST

Session 4 is blocked until Session 3 delivers:
- 12-step runtime verification complete (all 12 PASS)
- Progress charts live at /progress
- Workout calorie estimation built (MET-based)
- Workout history filtering working
- PWA manifest deployed
- Barcode scanning working
- Static meal seed script REMOVED from codebase
  (replaced by zero-state Claude generation — see below)

Do not start Session 4 until all Session 3 items are confirmed.

---

## SESSION START PROTOCOL
Run before any code work. Fix failures before touching code.

Check 1 — Supabase INSERT works with anon key:
  ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)
  curl -s -w "\nHTTP: %{http_code}" \
    "https://qlkjgguxjddalbswoxpm.supabase.co/rest/v1/food_log_entries" \
    -X POST \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d '{"user_id":"00000000-0000-0000-0000-000000000000","logged_at":"2099-01-01T00:00:00Z","foods_json":[],"totals":{"calories":0,"protein":0,"carbs":0,"fat":0}}'
  Expected: 201 or 409. NOT 401 or 403.

Check 2 — Production URL loads:
  curl -s -o /dev/null -w "%{http_code}" https://pantheon-woad.vercel.app/login
  Expected: 200

Check 3 — Backup runs clean:
  npm run backup
  Expected: file created, all tables show row counts

---

## SESSION 4 BUILD PLAN

Three parts, in dependency order.
Complete Part 1 before Part 2. Complete Part 2 before Part 3.

---

### PART 1 — Workout Calorie Estimation

Depends on: Session 3 workout logging foundation
Feeds into: Part 2 Greek God Bod Score (score uses calorie burns)

SCHEMA MIGRATION — add fields to workout_sessions table.
Run this SQL in Supabase SQL Editor before writing any code:

  ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS distance_miles NUMERIC,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_cal_burned INTEGER,
  ADD COLUMN IF NOT EXISTS cal_estimate_method TEXT
    DEFAULT 'MET_estimate'
    CHECK (cal_estimate_method IN
      ('MET_estimate', 'user_override', 'apple_health')),
  ADD COLUMN IF NOT EXISTS avg_heart_rate INTEGER,
  ADD COLUMN IF NOT EXISTS perceived_effort INTEGER
    CHECK (perceived_effort BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS workout_notes TEXT;

After running: verify columns exist with:
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'workout_sessions'
  ORDER BY column_name;

CALORIE ESTIMATION LOGIC:

MET values to use in Claude system prompt:
  Zone 2 run:          7.0 MET
  Zone 2 bike or row:  5.5 MET
  Lifting moderate:    4.5 MET
  BJJ:                 8.5 MET
  Walking:             3.5 MET
  HIIT or circuit:     8.0 MET
  Swimming:            6.0 MET
  Unknown:             5.0 MET (default)

Formula: calories = MET x weight_kg x duration_hours
Luke's weight: always pull current weight from weight_readings
  (most recent row) — do not hardcode 198 lbs.
  weight_kg = weight_lbs / 2.205

If duration not provided by user:
  Estimate from distance if given:
    Zone 2 run at 12 min/mile pace: duration = distance x 12 min
    Zone 2 bike at 15 mph: duration = (distance / 15) x 60 min
  If neither duration nor distance: use 45 minutes as default
  Always note the assumption in the display

DISPLAY FORMAT (shown after any workout is logged):
  "Estimated NNN cal burned — [assumption string]. Tap to adjust."

Examples:
  "Estimated 460 cal burned — 3.5 mi Zone 2 run (~42 min) at 198 lbs.
   Tap to adjust."
  "Estimated 380 cal burned — assumed 45 min lifting session at 198 lbs.
   Tap to adjust."

TAP TO ADJUST:
  Small inline edit field replaces the estimate display.
  User types real calorie number.
  On save: update estimated_cal_burned, set
  cal_estimate_method = 'user_override'.
  Show: "NNN cal burned (your entry)"

VERCEL DEPLOY after Part 1:
  git add -A && git commit -m "Part 1: workout calorie estimation"
  npx vercel --prod --yes
  Verify on production before starting Part 2.

---

### PART 2 — Greek God Bod Score

Depends on: Part 1 (score uses calorie burns in energy balance)
Feeds into: Part 3 (AI Coach explains the score)

BACKGROUND:
Goal: 198 lbs to 185 lbs by June 19, 2026
Days remaining from April 9: 71 days (10.1 weeks)
Rate of loss needed: 1.3 lbs/week
Training split: 3 lift + 3 Zone 2 + 1 rest per week

Daily calorie targets by day type:
  Lift Day:    2,450 cal (base 2,250 + 200)
  Zone 2 Day:  2,250 cal (no adjustment)
  Rest Day:    2,100 cal (base 2,250 - 150)
  Weekly avg:  2,314 cal/day

SCORE ALGORITHM:

Score is calculated on demand (user taps Score button) or
automatically at 8pm each day. One Claude API call takes the
full day state and returns score + verdict + recommendation.

Score components and weights:
  Protein vs 200g target:       30% — muscle preservation priority
  Calories vs daily target:     25% — fat loss
  Workout completed per split:  20% — consistency
  Weight trend vs projection:   15% — 1.3 lbs/week pace
  Carb and fat targets hit:     10% — metabolic balance

Energy balance for score:
  net_calories = food_calories_consumed - workout_calories_burned
  Compare net_calories to daily target, not gross calories.
  Example: ate 2,800 cal, burned 500 in Zone 2 run = 2,300 net.
  If target is 2,250, that is very close — good score on calories.

Weight trend component:
  Pull last 7 weight_readings.
  Calculate actual lbs/week loss rate.
  Compare to 1.3 lbs/week target.
  If ahead of pace: bonus points.
  If behind: penalize proportionally.
  If fewer than 3 weight readings: skip this component,
  redistribute weight to other components.

SCORE OUTPUT FORMAT:
  Roman numeral: I II III IV V VI VII VIII IX X
  One-sentence verdict under the numeral.
  Two-sentence recommendation for remaining hours of day.

Examples:
  "VIII
   Strong Zone 2 day — calorie burn puts you in a solid deficit.
   Hit 60g more protein before bed. A Greek yogurt and cottage
   cheese bowl gets you there in one shot."

  "IV
   Missed the workout and protein is 80g short at 7pm.
   Hard to fully recover today — prioritize sleep and hit
   the gym first thing tomorrow to protect the weekly average."

DISPLAY:
  New card on dashboard between macro bars and weight card.
  Large Roman numeral (styled like a monument inscription).
  Verdict text below.
  Recommendation text below that.
  Recalculate button (reruns the Claude call with fresh state).

ZERO-STATE BEHAVIOR (no saved meals, no pantry):
  When daily plan is requested and saved_meals table is empty
  AND pantry_items table is empty:
  Claude generates meal suggestions from scratch using:
    - Remaining macro targets for the day type
    - Variety constraint: no same protein source twice in one day
    - Cuisine variety: rotate Mediterranean, Asian, American, Mexican
    - Prep simplicity: flag quick options (under 15 min)
    - Real grocery-available ingredients only
  Each generated meal shows:
    - Name and brief description
    - Exact portions to hit macros
    - Estimated prep time
    - Save button: tap to save to saved_meals table
  Over time saved meals accumulate and become the personal repository.
  Once saved_meals has entries, plan generator pulls from those first,
  fills gaps with Claude-generated options.

DAILY PLAN GENERATOR:
  Input: current food log, remaining macros, time of day,
    workout status, saved_meals table, pantry_items table
  Output: specific meals with exact portions for remaining meals today
  Closing statement: "Eat exactly this and your score will be
    [Roman numeral] tonight."

RE-ROLL FEATURE:
  Button: Re-roll Plan
  Generates a new variation — different meals, same macro targets.
  Partial re-roll: "Keep breakfast, change dinner" via chat command.
  Each re-roll is one Claude API call.
  Show 1 plan at a time, not multiple — keeps UI clean.

VERCEL DEPLOY after Part 2:
  git add -A && git commit -m "Part 2: Greek God Bod Score + daily plan"
  npx vercel --prod --yes
  Verify score renders on production before starting Part 3.

---

### PART 3 — AI Coach Chat + TDEE Algorithm

Depends on: Part 2 (coach explains the score, adjusts the plan)

AI COACH CHAT:

UI: Floating panel on dashboard.
  Collapsed state: small tab at bottom of screen labeled Coach.
  Expanded state: chat panel slides up, covers bottom half.
  Does not navigate away from dashboard.

Context injected into every Coach message:
  - Today's full food log (foods, totals, timestamps)
  - Current score and verdict
  - Remaining macros for the day
  - Workout logged today (type, duration, calories burned)
  - Current weight and trend
  - Goal weight, goal date, days remaining
  - Day type (Lift / Zone 2 / Rest)
  - Saved meals and pantry inventory

Coach can handle:
  Score explanation: "Why did I get a V today?"
  Plan adjustment: "I have a dinner party tonight, adjust the plan"
  Log commands: "Log that I skipped the gym today"
  Projections: "What is my projected weight on June 19 at this pace?"
  Meal swaps: "Swap the chicken for salmon, same macros"
  Pantry commands: "The tomatoes and turkey are now 4 servings
    of meat sauce" (Session 5 feature — stub this for now,
    return: "Pantry tracking coming soon")
  Re-roll trigger: "Give me different dinner options"

Coach does NOT:
  Navigate to other pages.
  Make DB writes directly — it returns instructions that the
  app executes (keeps a clear boundary between chat and data).
  Exception: log commands update DB via existing API routes.

TDEE ALGORITHM v1:

Activates after 14+ days of data (weight readings + food logs).
Until then: show "TDEE estimate available after 14 days of logging."

Rolling regression:
  Input: daily food log totals (calories) + daily weight readings
  Output: estimated TDEE (total daily energy expenditure)
  Method: if weight is dropping at X lbs/week on Y avg calories,
    then TDEE = Y + (X x 500)
    (1 lb fat = ~3,500 cal, so 0.5 lb/week loss = 250 cal deficit/day)

Example:
  Eating avg 2,300 cal/day, losing 1.2 lbs/week:
  TDEE estimate = 2,300 + (1.2 x 500) = 2,900 cal/day

Sunday check-in card:
  Appears Sunday morning on dashboard.
  Shows: estimated TDEE, actual loss rate vs target,
    whether targets should adjust up or down.
  One-tap dismiss.
  Saves check-in to weekly_checkins table.

VERCEL DEPLOY after Part 3:
  git add -A && git commit -m "Part 3: AI Coach + TDEE algorithm"
  npx vercel --prod --yes
  Full end-to-end test on production before marking session complete.

---

## FULL SESSION 4 AUDIT CHECKLIST

Run after all three parts are complete.

Part 1 verification:
  Log a Zone 2 run via voice ("3.5 mile Zone 2 run")
  Confirm calorie estimate appears with assumption string
  Tap to adjust — enter real number — confirm method changes
    to user_override in Supabase
  Log a lift session with no duration — confirm 45 min default used
  Check workout_sessions table in Supabase — all new columns populated

Part 2 verification:
  Tap Score on dashboard — confirm Roman numeral renders
  Confirm verdict and recommendation text appear
  Request daily plan — confirm meals shown with portions
  Confirm zero-state works: clear saved_meals, request plan,
    Claude generates from scratch with cuisine variety
  Save a generated meal — confirm it appears in saved_meals
  Tap Re-roll — confirm new plan generated (different meals)
  Check that net calories (food minus workout burn) drives score,
    not gross calories

Part 3 verification:
  Open Coach panel — confirm it slides up without navigating away
  Ask "Why did I get [score] today?" — confirm explanation references
    actual day data, not generic response
  Ask "What is my projected weight on June 19?" — confirm uses
    actual weight trend from DB, not hardcoded rate
  Issue log command: "Log that I did 30 min of walking" —
    confirm workout_sessions row created
  If 14+ days of data: confirm TDEE estimate appears
  If Sunday: confirm check-in card appears

tsc --noEmit: zero new errors
eslint on all modified files: zero errors
Production deploy confirmed: all features work on
  https://pantheon-woad.vercel.app, not just localhost

---

## USER PARAMETERS (Luke)

Parameter           | Value
--------------------|------------------------------------------
Current weight      | 198 lbs (pull live from weight_readings)
Goal weight         | 185 lbs
Goal date           | June 19, 2026
Days remaining      | 71 from April 9 (recalculate at session start)
Weeks remaining     | 10.1
Rate of loss        | 1.3 lbs/week
Body fat %          | 25%
Base calories       | 2,250/day
Protein target      | 200g
Fat target          | 90g
Carbs target        | 160g
Lift Day calories   | 2,450 (base + 200)
Zone 2 calories     | 2,250 (no adjustment)
Rest Day calories   | 2,100 (base - 150)
Weekly avg calories | 2,314/day
Training split      | 3 lift + 3 Zone 2 + 1 rest per week

---

## WHAT COMES AFTER SESSION 4

Session 5 — Pantry System:
  Receipt upload and OCR to pantry inventory
  Auto-deduct items on food log
  Recipe conversion via Coach chat
  Pantry-aware daily planning

Session 6 — HealthKit Auto-Sync via OpenClaw:
  Apple Watch workouts pulled automatically
  Calorie burns upgraded from MET estimates to real Watch data
  cal_estimate_method field updated to apple_health
  Wyze sync fully deprecated

---

## RESUME PROMPT FOR SESSION 4

Apply VIBE CODING DOCTRINE (VIBE_CODING_DOCTRINE.md in project root)
to all work in this session.

We are building Pantheon — AI-native nutrition and body composition
tracker. Single user (Luke), password gate only (gospurs).
Production: https://pantheon-woad.vercel.app

SESSION START PROTOCOL — run before any code work:

Check 1 — Supabase INSERT:
  ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)
  curl -s -w "\nHTTP: %{http_code}" \
    "https://qlkjgguxjddalbswoxpm.supabase.co/rest/v1/food_log_entries" \
    -X POST \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d '{"user_id":"00000000-0000-0000-0000-000000000000","logged_at":"2099-01-01T00:00:00Z","foods_json":[],"totals":{"calories":0,"protein":0,"carbs":0,"fat":0}}'
  Expected: 201 or 409. NOT 401 or 403.

Check 2 — Production:
  curl -s -o /dev/null -w "%{http_code}" https://pantheon-woad.vercel.app/login
  Expected: 200

Check 3 — Backup:
  npm run backup
  Expected: file created, row counts shown

Confirm Session 3 prerequisites are complete before building.
Build in order: Part 1 then Part 2 then Part 3.
Deploy to Vercel after each part. Verify on production before next part.

PROJECT: /Users/scrogdawg/BMF Headquarters/2026 - THE NARRATIVE/26_09 Pantheon/pantheon/
SUPABASE: https://supabase.com/dashboard/project/qlkjgguxjddalbswoxpm
