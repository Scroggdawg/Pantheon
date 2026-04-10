# PANTHEON — Session 4 Implementation Plan
*Written: April 9, 2026 — Pre-implementation review*

---

## CODEBASE AUDIT FINDINGS

### Confirmed Integration Points

| What | Exact reference |
|------|----------------|
| Anthropic client | `client` exported from `lib/claude/claude.ts` (line 68), created as `new Anthropic()` (line 3) |
| Model | `claude-sonnet-4-20250514` used everywhere |
| Service role Supabase | `createClient` from `lib/supabase/server.ts` — returns `createSupabaseClient(URL, SERVICE_ROLE_KEY)` |
| Browser Supabase | `createClient` from `lib/supabase/client.ts` — `createBrowserClient(URL, ANON_KEY)` singleton |
| Variable name | Always `supabase` in API routes: `const supabase = await createClient()` |
| Dashboard hooks | `useUser()`, `useDailyLog(userId)`, `useWeightTrend(userId)` |
| Dashboard state | `dayType` is `useState<DayType>('zone2')` — not persisted, resets on load |
| LogFAB position | `fixed bottom-6 right-6 z-50` (LogFAB.tsx:21) |
| ParsedWorkoutResponse | `lib/claude/workout.ts:49-57` — missing calorie fields |
| WorkoutSession type | `types/database.ts:150-161` — missing calorie/distance columns |
| SaveMealModal props | `{ userId, foods: FoodItem[], defaultName?, onSaved, onClose }` |
| Progress page | `app/progress/page.tsx` — already has weight, calorie, workout volume, body comp charts |

### Conflicts Between Spec and Codebase

**CONFLICT 1 — `duration_minutes` vs `duration_min`**
Spec SQL uses `duration_minutes`. Codebase uses `duration_min` everywhere:
- Schema: `001_schema.sql:149` → `duration_min int`
- TypeScript: `WorkoutSession.duration_min` (database.ts:155)
- TypeScript: `ParsedWorkoutResponse.duration_min` (workout.ts:51)
- WorkoutLogger: `parsed.duration_min` (WorkoutLogger.tsx:120)
Resolution: Spec already notes this. Use `duration_min`. Do NOT add `duration_minutes`.

**CONFLICT 2 — `parse-workout` route has no Supabase import**
`app/api/claude/parse-workout/route.ts` is a thin 20-line file that calls `parseWorkout(transcript)`.
To inject weight_kg, I need to either:
  (a) Add Supabase import to the route and pass weight to `parseWorkout()`
  (b) Add Supabase import inside `lib/claude/workout.ts` directly
Resolution: Option (a) — keep `lib/claude/workout.ts` pure (no DB dependency).
Fetch weight in the route, pass as parameter to `parseWorkout(transcript, weightKg)`.

**CONFLICT 3 — `parse-workout-image` route has inline Claude call**
Unlike `parse-workout` which delegates to `parseWorkout()`, the image route calls
`client.messages.create()` directly in the route file (line 43-63).
The calorie estimation must be added in the route itself after parsing,
not in a shared function.
Resolution: After the JSON parse (line 69), compute calories in-route using the
same MET logic. Add calorie fields to the response spread on line 96.

**CONFLICT 4 — Progress page already exists**
Spec says "Add to /progress page" — the page already has 4 chart sections.
I'll add workout-specific charts (calorie burn, distance, duration) as a new
section, plus the type filter. Will NOT restructure existing charts.

**CONFLICT 5 — `useWeightTrend` only fetches 7 days**
`hooks/useWeightTrend.ts:16-17` filters to 7 days ago. The score needs
"last 7 weight_readings" regardless of date range. For most users logging
daily, this is fine. But if someone skips days, 7 days of calendar time
might only have 3-4 readings.
Resolution: Score API route fetches weight readings server-side with
`.order('measured_at', { ascending: false }).limit(7)` — no date filter.
Does not depend on the hook.

**CONFLICT 6 — No workout data on dashboard currently**
Dashboard does not fetch workout_sessions. Score and Coach need today's workouts.
Resolution: Create `useWorkouts(userId)` hook or fetch in score/coach API routes
server-side. Since score is on-demand (not on mount), server-side fetch is cleaner.
Dashboard needs workouts for the ScoreCard component to pass to the API.
Decision: Add a lightweight `useTodayWorkouts(userId)` hook, pattern matches `useDailyLog`.

**CONFLICT 7 — weekly_checkins has no unique constraint on (user_id, week_of)**
Schema `001_schema.sql` does not define `UNIQUE(user_id, week_of)`.
The Sunday check-in logic needs to query "does a row exist for this week's Monday?"
Without a unique constraint, duplicate rows are possible.
Resolution: Add `UNIQUE(user_id, week_of)` in the ALTER TABLE migration. Use
`ON CONFLICT (user_id, week_of) DO NOTHING` on insert.

---

## PART 1 — WORKOUT CALORIE ESTIMATION

### Step 1.1: SQL Migration

File: `supabase/migrations/004_workout_calories.sql` (new file)

```sql
ALTER TABLE workout_sessions
ADD COLUMN IF NOT EXISTS distance_miles NUMERIC,
ADD COLUMN IF NOT EXISTS estimated_cal_burned INTEGER,
ADD COLUMN IF NOT EXISTS cal_estimate_method TEXT
  DEFAULT 'MET_estimate'
  CHECK (cal_estimate_method IN ('MET_estimate', 'user_override', 'apple_health')),
ADD COLUMN IF NOT EXISTS avg_heart_rate INTEGER,
ADD COLUMN IF NOT EXISTS perceived_effort INTEGER
  CHECK (perceived_effort BETWEEN 1 AND 10),
ADD COLUMN IF NOT EXISTS workout_notes TEXT;

ALTER TABLE weekly_checkins
ADD CONSTRAINT weekly_checkins_user_week_unique UNIQUE (user_id, week_of);
```

Run in Supabase SQL Editor before any code changes.
Verify: `SELECT column_name FROM information_schema.columns WHERE table_name = 'workout_sessions' ORDER BY column_name;`

### Step 1.2: Update TypeScript Types

File: `types/database.ts`

Add to `WorkoutSession` interface (after line 159, before `created_at`):
```typescript
  distance_miles: number | null
  estimated_cal_burned: number | null
  cal_estimate_method: 'MET_estimate' | 'user_override' | 'apple_health'
  avg_heart_rate: number | null
  perceived_effort: number | null
  workout_notes: string | null
```

Add new type alias (after line 5):
```typescript
export type CalEstimateMethod = 'MET_estimate' | 'user_override' | 'apple_health'
```

File: `lib/claude/workout.ts`

Add to `ParsedWorkoutResponse` interface (after `clarification_needed`, before `imageUrl`):
```typescript
  estimated_cal_burned: number
  cal_assumption: string
  distance_miles: number | null
```

### Step 1.3: Create MET Calorie Estimation Helper

File: `lib/claude/calories.ts` (new file)

```typescript
const MET_VALUES: Record<string, number> = {
  zone2_run: 7.0,
  zone2_bike: 5.5,
  zone2_row: 5.5,
  lift: 4.5,
  bjj: 8.5,
  walk: 3.5,
  hiit: 8.0,
  swim: 6.0,
  other: 5.0,
}

interface CalEstimateInput {
  session_type: 'lift' | 'bjj' | 'zone2' | 'other'
  duration_min: number | null
  distance_miles: number | null
  weight_lbs: number
  activity_detail?: string  // e.g. "run", "bike", "row" — parsed from transcript
}

interface CalEstimateResult {
  estimated_cal_burned: number
  cal_assumption: string
  duration_min_used: number
}

export function estimateCalories(input: CalEstimateInput): CalEstimateResult
```

Logic:
1. Determine MET from session_type + activity_detail
2. Convert weight: `weight_kg = weight_lbs / 2.205`
3. Determine duration:
   - If `duration_min` provided → use it
   - If zone2 run + distance → `distance_miles * 12`
   - If zone2 bike + distance → `(distance_miles / 15) * 60`
   - Else → 45 (default)
4. `calories = MET * weight_kg * (duration_min_used / 60)`
5. Build assumption string from what was used/assumed
6. Return all three values

This is a pure function — no DB access, no side effects. Testable.

### Step 1.4: Update parse-workout Route

File: `app/api/claude/parse-workout/route.ts`

Current: 20 lines, imports only `parseWorkout` from workout lib.

Changes:
- Add import: `import { createClient } from '@/lib/supabase/server'`
- Add import: `import { estimateCalories } from '@/lib/claude/calories'`
- After `const { transcript } = await request.json()`:
  - Fetch most recent weight: `const supabase = await createClient()`
  - Query: `.from('weight_readings').select('weight_lbs').order('measured_at', { ascending: false }).limit(1).single()`
  - Fallback: `const weightLbs = weightRow?.weight_lbs ?? 198`
- After `const parsed = await parseWorkout(transcript)`:
  - Call `estimateCalories({ session_type: parsed.session_type, duration_min: parsed.duration_min, distance_miles: null, weight_lbs: weightLbs })`
  - Merge into response: `{ ...parsed, estimated_cal_burned, cal_assumption, distance_miles: null }`

Update `parseWorkout` function signature in `lib/claude/workout.ts`:
- Add to system prompt: MET calorie context + instruction to return `distance_miles` if mentioned
- Add `distance_miles: number | null` to the JSON schema in the prompt
- Parse result now includes distance if Claude extracted it

### Step 1.5: Update parse-workout-image Route

File: `app/api/claude/parse-workout-image/route.ts`

Changes (after line 69 where `parsed = JSON.parse(text)`):
- Fetch weight (same pattern as parse-workout)
- Call `estimateCalories()` with parsed data
- Spread into response on line 96: `{ ...parsed, imageUrl, estimated_cal_burned, cal_assumption, distance_miles: parsed.distance_miles ?? null }`

Update `WORKOUT_IMAGE_SYSTEM_PROMPT` (line 4-22):
- Add `"distance_miles": number|null` to the JSON schema
- Add instruction: "If distance is mentioned or visible, include it."

### Step 1.6: Update WorkoutLogger Component

File: `components/logging/WorkoutLogger.tsx`

Changes to `handleConfirm()` (line 106-161):
- After saving to `workout_sessions`, include new columns:
  ```typescript
  estimated_cal_burned: parsed.estimated_cal_burned,
  cal_estimate_method: 'MET_estimate',
  distance_miles: parsed.distance_miles,
  ```
- After successful save, show calorie estimate before calling `onComplete()`

New state:
```typescript
const [showCalEstimate, setShowCalEstimate] = useState(false)
const [calOverride, setCalOverride] = useState<number | null>(null)
const [editingCal, setEditingCal] = useState(false)
```

New stage after 'saving' succeeds: show cal estimate display.
"Estimated NNN cal burned — [assumption]. Tap to adjust."
On tap: show inline number input.
On save override: PATCH workout_sessions row with:
  `{ estimated_cal_burned: calOverride, cal_estimate_method: 'user_override' }`
Display: "NNN cal burned (your entry)"
Then call `onComplete()`.

### Step 1.7: Update Progress Page

File: `app/progress/page.tsx`

Add workout type filter (button group: All / Zone 2 / Lift / BJJ):
- State: `const [workoutFilter, setWorkoutFilter] = useState<string>('all')`
- Filter `workoutData` by `session_type` before rendering

Add new workout charts section (after existing Workout Volume section):
1. **Calories Burned Over Time** — bar chart, `estimated_cal_burned` by date
2. **Duration Over Time** — bar chart, `duration_min` by date
3. **Distance Over Time** — line chart, only if any `distance_miles` data exists
4. **Workout History Table** — Date, Type, Duration, Distance, Cal, Source

Update `fetchAll()` to select new columns:
```typescript
supabase
  .from('workout_sessions')
  .select('trained_at, total_volume_lbs, session_type, duration_min, distance_miles, estimated_cal_burned, cal_estimate_method')
```

### Step 1.8: Audit & Deploy

- `npx tsc --noEmit` — zero errors
- `npx eslint .` — zero errors on modified files
- Local smoke test: log workout via voice, verify cal estimate shows
- `git add` specific files → commit "Part 1: workout calorie estimation"
- `npx vercel --prod --yes`
- Verify on production

---

## PART 2 — GREEK GOD BOD SCORE

### Step 2.1: Create Score API Route

File: `app/api/claude/score/route.ts` (new file)

Pattern: follows `app/api/claude/parse-workout/route.ts` exactly.

```typescript
import { client } from '@/lib/claude/claude'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { day_type, current_time_iso, entries, workouts, weight_readings }
      = await request.json()

    const supabase = await createClient()

    // Fetch user row for base targets
    // Fetch last 7 weight_readings if not provided (server-side, no date filter)
    // Compute score components
    // Build Claude prompt with full day state
    // Return score response

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}
```

Request body:
```typescript
{
  day_type: DayType,
  current_time_iso: string,
  entries: FoodLogEntry[],
  workouts: WorkoutSession[],
  weight_readings: WeightReading[]
}
```

Response:
```typescript
{
  score: number,
  roman: string,
  verdict: string,
  recommendation: string,
  is_projected: boolean,
  components: {
    protein_score: number,
    calorie_score: number,
    workout_score: number,
    trend_score: number,
    macro_score: number
  }
}
```

Score computation approach — compute components in TypeScript, send to Claude
only for verdict/recommendation text:

1. **Protein (30%)**: `Math.max(0, 10 - Math.abs(total_protein - 200) / 10)`
   Capped at 10. Each 10g off target = -1 point.

2. **Calories (25%)**: Compare GROSS food calories to day target.
   Day targets: lift=2450, zone2=2250, rest=2100.
   `Math.max(0, 10 - Math.abs(gross_cal - target) / 100)`
   Each 100 cal off = -1 point.

3. **Workout (20%)**:
   - Rest day → automatic 10.
   - Lift day → 10 if workout with session_type='lift' exists, 0 if not.
   - Zone2 day → 10 if session_type='zone2' or 'bjj' with duration_min >= 20.
   - Time check: `Intl.DateTimeFormat('en-US', {hour:'numeric', hour12:false, timeZone:'America/Los_Angeles'}).format(new Date(current_time_iso))`
   - Before 14:00 + no workout → 5 (partial credit, is_projected=true).

4. **Weight trend (15%)**: Last 7 readings.
   - < 3 readings → skip, redistribute to protein (35%) and calories (30%).
   - 3+ readings: linear regression lbs/week.
   - `Math.max(0, 10 - Math.abs(actual_rate - 1.3) * 5)`
   - Within 0.2 lbs/week = full points.

5. **Carbs+Fat (10%)**:
   - Carb score: `Math.max(0, 10 - Math.abs(carbs - target) / 15)`
   - Fat score: `Math.max(0, 10 - Math.abs(fat - target) / 10)`
   - Average of both.

Weighted sum → clamp 0-10 → map to Roman numeral:
```typescript
const ROMAN_MAP: [number, string][] = [
  [9.5, 'X'], [8.5, 'IX'], [7.5, 'VIII'], [6.5, 'VII'],
  [5.5, 'VI'], [4.5, 'V'], [3.5, 'IV'], [2.5, 'III'],
  [1.5, 'II'], [0, 'I']
]
```

After computing score and components, call Claude for verdict + recommendation:
- System prompt: "You are the Greek God Bod Score coach. Given these scores, write a one-sentence verdict and two-sentence recommendation."
- User message: JSON with all component scores, actual numbers, time of day, remaining macros.
- Max tokens: 300.
- Hard floor instruction: "Never recommend net calories below 1800/day."

### Step 2.2: Create useTodayWorkouts Hook

File: `hooks/useTodayWorkouts.ts` (new file)

Pattern: matches `useDailyLog.ts` exactly.

```typescript
'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WorkoutSession } from '@/types/database'

export function useTodayWorkouts(userId: string | null) {
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('trained_at', `${today}T00:00:00`)
      .lte('trained_at', `${today}T23:59:59`)
      .order('trained_at', { ascending: true })
    setWorkouts(data || [])
    setLoading(false)
  }, [userId, today, supabase])

  useEffect(() => { refresh() }, [refresh])

  return { workouts, loading, refresh }
}
```

### Step 2.3: Create ScoreCard Component

File: `components/dashboard/ScoreCard.tsx` (new file)

Props:
```typescript
interface ScoreCardProps {
  dayType: DayType
  entries: FoodLogEntry[]
  workouts: WorkoutSession[]
  weightReadings: WeightReading[]
  calorieTarget: number
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
  totals: { calories: number; protein: number; carbs: number; fat: number }
}
```

State:
```typescript
const [score, setScore] = useState<ScoreResponse | null>(null)
const [loading, setLoading] = useState(false)
const [showPlan, setShowPlan] = useState(false)
```

Cache: localStorage key `pantheon_score_cache`.
On mount: check cache. If < 30 minutes old, show cached result.
"Calculate Score" button: calls `/api/claude/score`, caches result.
"Recalculate" button: bypasses cache.
"See Plan" button: toggles DailyPlanPanel.

Remaining macros displayed below recommendation:
```
Remaining: {calorieTarget - totals.calories} cal / {proteinTarget - totals.protein}g protein / {carbsTarget - totals.carbs}g carbs / {fatTarget - totals.fat}g fat
```

**Dashboard placement decision:**
Current card order on 390px mobile:
1. DayTypeToggle
2. CaloriesRemainingCard
3. MacroBars
4. WeightCard
5. Log Workout button
6. Today's Log

ScoreCard goes **between MacroBars and WeightCard** (position 4, pushing weight down).
Reasoning: Score is the day's primary metric after seeing calories and macros.
User sees targets → sees how they're scoring → can scroll down to weight trend.
The score card is contextually dependent on the macro data shown above it.

### Step 2.4: Create Daily Plan API Route

File: `app/api/claude/daily-plan/route.ts` (new file)

Request body:
```typescript
{
  day_type: DayType,
  current_time_iso: string,
  entries: FoodLogEntry[],
  workouts: WorkoutSession[]
}
```

Route fetches server-side:
- `saved_meals` (all rows for user)
- `pantry_items` (all rows for user)
- `user` row (for base targets)

**Low calorie check** — before Claude call:
```typescript
const adj = DAY_TYPE_ADJUSTMENTS[day_type]
const dayTarget = (user.base_calories_target || 2250) + adj.calories
const grossCal = entries.reduce((s, e) => s + e.total_calories, 0)
const remaining = dayTarget - grossCal
if (remaining < 400) {
  return Response.json({
    meals: [],
    projected_score_if_followed: null,
    low_cal_message: "You are almost at your target for today. Focus on hitting protein — Greek yogurt or cottage cheese gets you there without blowing the budget."
  })
}
```

Response:
```typescript
{
  meals: [{
    name: string,
    description: string,
    portions: string,
    macros: { calories: number, protein_g: number, carbs_g: number, fat_g: number },
    prep_minutes: number,
    cuisine: string,
    from_saved: boolean,
    saveable: boolean,
    foods_json: FoodItem[]  // for SaveMealModal
  }],
  projected_score_if_followed: string | null,
  low_cal_message: string | null
}
```

Claude prompt includes:
- Remaining macros for the day
- Time of day (to suggest appropriate meal types)
- Saved meals (if any — prefer these, fill gaps with generated)
- Pantry items (if any)
- Constraints: no same protein source as already logged, cuisine variety, exact gram weights

Zero state: When saved_meals and pantry_items are both empty, Claude generates from scratch.

### Step 2.5: Create DailyPlanPanel Component

File: `components/dashboard/DailyPlanPanel.tsx` (new file)

Triggered by "See Plan" button in ScoreCard.
Calls `/api/claude/daily-plan` on open.

State:
```typescript
const [plan, setPlan] = useState<PlanResponse | null>(null)
const [previousPlan, setPreviousPlan] = useState<PlanResponse | null>(null)
const [loading, setLoading] = useState(false)
const [showPrevious, setShowPrevious] = useState(false)
const [savingMealIdx, setSavingMealIdx] = useState<number | null>(null)
const [rerollDisabled, setRerollDisabled] = useState(false)
```

Re-roll logic:
1. Store current plan in `previousPlan` ref
2. Set `plan = null`, `loading = true`
3. Call API
4. Success: set new plan, show previous muted for 60s, auto-remove via `setTimeout`
5. Failure: restore from previousPlan, show error toast
6. Debounce: disable re-roll button for 2s after each tap

Save a meal:
- Each `saveable: true` meal has a Save button
- Opens `SaveMealModal` with `foods={meal.foods_json}` and `defaultName={meal.name}`
- After save: refresh (so it appears in QuickSelectModal next time)

### Step 2.6: Update Dashboard Page

File: `app/dashboard/page.tsx`

New imports:
```typescript
import { useTodayWorkouts } from '@/hooks/useTodayWorkouts'
import ScoreCard from '@/components/dashboard/ScoreCard'
```

New hook call (line ~27):
```typescript
const { workouts, refresh: refreshWorkouts } = useTodayWorkouts(userId)
```

Add ScoreCard between MacroBars and WeightCard (after line 109):
```tsx
<ScoreCard
  dayType={dayType}
  entries={entries}
  workouts={workouts}
  weightReadings={readings}
  calorieTarget={calorieTarget}
  proteinTarget={proteinTarget}
  carbsTarget={carbsTarget}
  fatTarget={fatTarget}
  totals={totals}
/>
```

Note: `useWeightTrend` returns `readings` (the raw WeightReading[]). Currently the
dashboard destructures `{ latest, chartData, loading, refresh }` — need to also
destructure `readings`:
```typescript
const { readings, latest, chartData, loading: weightLoading, refresh: refreshWeight } = useWeightTrend(userId)
```

Update `WorkoutLogger` `onComplete` callback to also refresh workouts:
```typescript
onComplete={() => {
  setShowWorkout(false)
  refreshWorkouts()
}}
```

### Step 2.7: Audit & Deploy

- `npx tsc --noEmit`
- `npx eslint .`
- Local test: calculate score, view plan, save a meal, re-roll
- `git add` → commit "Part 2: Greek God Bod Score + daily plan"
- `npx vercel --prod --yes`
- Verify score and plan on production

---

## PART 3 — AI COACH + TDEE

### Step 3.1: Create Coach API Route

File: `app/api/claude/coach/route.ts` (new file)

Request body:
```typescript
{
  message: string,
  conversation_history: { role: string, content: string }[],
  day_type: DayType,
  current_time_iso: string
}
```

Note: `day_type` comes from client — it is NOT in the DB.

Route fetches server-side on every call:
```typescript
const supabase = await createClient()

const today = new Date().toISOString().split('T')[0]

const [foodRes, workoutRes, weightRes, mealsRes, pantryRes, userRes] = await Promise.all([
  supabase.from('food_log_entries').select('*').eq('user_id', userId)
    .gte('logged_at', `${today}T00:00:00`).lte('logged_at', `${today}T23:59:59`),
  supabase.from('workout_sessions').select('*').eq('user_id', userId)
    .gte('trained_at', `${today}T00:00:00`).lte('trained_at', `${today}T23:59:59`),
  supabase.from('weight_readings').select('*').eq('user_id', userId)
    .order('measured_at', { ascending: false }).limit(14),
  supabase.from('saved_meals').select('*').eq('user_id', userId),
  supabase.from('pantry_items').select('*').eq('user_id', userId),
  supabase.from('users').select('*').limit(1).single(),
])
```

System prompt context injection:
- Today's food log entries with totals
- Remaining macros for the day (computed from day_type targets)
- Workout sessions today with calorie burns
- Current weight and 14-reading trend
- Goal: 185 lbs by June 19, 2026
- Days remaining: `Math.ceil((new Date('2026-06-19') - new Date()) / 86400000)`
- Rate needed: 1.3 lbs/week
- Split: 3 lift + 3 zone2 + 1 rest
- Hard floor: never recommend below 1800 cal/day
- Tone: direct, like a training partner
- For projections: derive from actual weight_readings trend, not hardcoded rate
- If < 7 readings: give range, not specific number

Response:
```typescript
{ message: string, action: { type: string, params: Record<string, unknown> } | null }
```

Action types (instruct Claude to return these exact shapes):
```typescript
{ type: 'log_workout', params: { session_type, duration_min, notes } }
{ type: 'log_food', params: { description: string } }
{ type: 'update_day_type', params: { day_type: DayType } }
```

Unsupported actions — Claude responds with message only:
- Pantry: "Pantry tracking coming in a future update."
- Weight: "Tap Enter manually on the weight card to log weight."

### Step 3.2: Create CoachPanel Component

File: `components/dashboard/CoachPanel.tsx` (new file)

**Collapsed state:**
- Fixed tab at bottom-right
- Position: below the LogFAB's mic button
- LogFAB: `fixed bottom-6 right-6` — mic button is at the very bottom
- Coach tab: `fixed bottom-6 left-6` — put it on the LEFT side to avoid overlap
  Actually — spec says "BELOW mic FAB vertically". But mic FAB is already at bottom-6.
  Putting Coach below would push it off screen.
  Resolution: Coach tab goes `fixed bottom-6 left-6` (bottom-left corner).
  This avoids all z-index conflicts with the FAB on the right.
- `z-index: 40` (lower than FAB's z-50)
- Label: "Coach"

**Expanded state:**
- Panel slides up, covers bottom 60% of viewport: `h-[60vh]`
- Position: `fixed bottom-0 left-0 right-0`
- z-index: 50 (same as FAB, but FAB is hidden)
- When expanded: set `showCoach` state on dashboard → hide LogFAB via conditional render
- Restore LogFAB when collapsed
- Scroll dashboard to top: `window.scrollTo({ top: 0, behavior: 'smooth' })`
- Internal scroll for message history
- Input at bottom of panel
- X button top-right

State:
```typescript
const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([])
const [input, setInput] = useState('')
const [loading, setLoading] = useState(false)
const [expanded, setExpanded] = useState(false)
```

Messages stored in React state only — NOT persisted to DB.
Cleared on page navigation or refresh.

Action execution on frontend:
- `log_workout`: POST to Supabase `workout_sessions` directly (browser client),
  then call `refreshWorkouts()` passed as prop.
- `log_food`: POST to `/api/claude/parse-meal` with `params.description`,
  then insert result into `food_log_entries`, then call `refreshLog()`.
- `update_day_type`: call `setDayType(params.day_type)` passed as prop.

After action execution: add confirmation as assistant message.

### Step 3.3: TDEE Algorithm

Implemented inside the Coach route and the Sunday check-in card.

**Activation gate:**
```typescript
const weightCount = weightRes.data?.length ?? 0
const distinctDates = new Set(
  (foodRes.data ?? []).map(e =>
    new Date(e.logged_at).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })
  )
).size

const tdeeReady = weightCount >= 14 && distinctDates >= 10
```

**Calculation:**
```typescript
// Group food_log_entries by LA-timezone date, sum calories per day
// avg_daily_calories = total_calories / distinct_days

// Weight trend: oldest reading to newest in the 14-reading window
// actual_lbs_per_week = (oldest.weight_lbs - newest.weight_lbs) / weeks_between

// TDEE = avg_daily_calories + (actual_lbs_per_week * 500)
```

If gate not met: Coach says "TDEE estimate available after 14 days of logging."

### Step 3.4: Sunday Check-in Card

File: `components/dashboard/SundayCheckinCard.tsx` (new file)

Show logic:
```typescript
const isSunday = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  timeZone: 'America/Los_Angeles'
}).format(new Date()) === 'Sunday'
```

Get this week's Monday:
```typescript
const now = new Date()
const dayOfWeek = now.getDay() // 0=Sunday
const monday = new Date(now)
monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
const weekOf = monday.toISOString().split('T')[0]
```

Query: `supabase.from('weekly_checkins').select('id').eq('user_id', userId).eq('week_of', weekOf)`

Show card if:
- `isSunday === true`
- No existing row for this week_of
- Card content depends on whether TDEE gate is met

If gate met: show estimated TDEE, actual loss rate, whether targets should adjust.
If gate not met: "Keep logging daily — TDEE estimate available after 14 days."

On dismiss: INSERT into weekly_checkins with `confirmed_at: new Date().toISOString()`.
Use `ON CONFLICT (user_id, week_of) DO NOTHING` (requires the unique constraint from Step 1.1).

### Step 3.5: Update Dashboard Page

File: `app/dashboard/page.tsx`

New imports:
```typescript
import CoachPanel from '@/components/dashboard/CoachPanel'
import SundayCheckinCard from '@/components/dashboard/SundayCheckinCard'
```

New state:
```typescript
const [showCoach, setShowCoach] = useState(false)
```

Add SundayCheckinCard (after DayTypeToggle, before CaloriesRemainingCard):
```tsx
<SundayCheckinCard userId={userId!} />
```

Add CoachPanel (after LogFAB, conditional on !showCoach for FAB):
```tsx
{!showCoach && <LogFAB ... />}
<CoachPanel
  dayType={dayType}
  setDayType={setDayType}
  expanded={showCoach}
  onToggle={() => setShowCoach(prev => !prev)}
  refreshLog={refreshLog}
  refreshWorkouts={refreshWorkouts}
  refreshWeight={refreshWeight}
  userId={userId!}
/>
```

### Step 3.6: Audit & Deploy

- `npx tsc --noEmit`
- `npx eslint .`
- Local test: open Coach, ask "Why did I get [score]?", log workout via Coach
- Sunday test: mock date or wait for Sunday
- `git add` → commit "Part 3: AI Coach + TDEE algorithm"
- `npx vercel --prod --yes`
- Full end-to-end on production

---

## FILE CHANGE SUMMARY

### New Files (8)
```
lib/claude/calories.ts                      ← MET calorie estimation helper
hooks/useTodayWorkouts.ts                   ← today's workout sessions hook
app/api/claude/score/route.ts               ← Greek God Bod Score API
app/api/claude/daily-plan/route.ts          ← daily plan generator API
app/api/claude/coach/route.ts               ← AI Coach chat API
components/dashboard/ScoreCard.tsx           ← score display + plan trigger
components/dashboard/DailyPlanPanel.tsx      ← daily plan with re-roll + save
components/dashboard/CoachPanel.tsx          ← floating chat panel
components/dashboard/SundayCheckinCard.tsx   ← weekly TDEE check-in
supabase/migrations/004_workout_calories.sql ← schema migration
```

### Modified Files (8)
```
types/database.ts                              ← add CalEstimateMethod, update WorkoutSession
lib/claude/workout.ts                          ← add calorie fields to ParsedWorkoutResponse + prompt
app/api/claude/parse-workout/route.ts          ← add weight fetch + calorie estimation
app/api/claude/parse-workout-image/route.ts    ← add weight fetch + calorie estimation
components/logging/WorkoutLogger.tsx            ← save calorie data + post-save display
app/progress/page.tsx                          ← workout filter + calorie/distance/duration charts
app/dashboard/page.tsx                         ← add ScoreCard, CoachPanel, SundayCheckinCard, useTodayWorkouts
hooks/useWeightTrend.ts                        ← no change needed (dashboard destructures `readings` which is already returned)
```

---

## EXECUTION ORDER (within each Part)

### Part 1 order:
1. Run SQL migration in Supabase dashboard
2. Verify columns exist
3. Update `types/database.ts` (WorkoutSession + CalEstimateMethod)
4. Update `lib/claude/workout.ts` (ParsedWorkoutResponse + prompt)
5. Create `lib/claude/calories.ts`
6. Update `app/api/claude/parse-workout/route.ts`
7. Update `app/api/claude/parse-workout-image/route.ts`
8. Update `components/logging/WorkoutLogger.tsx`
9. Update `app/progress/page.tsx`
10. `npx tsc --noEmit` + `npx eslint .`
11. Local smoke test
12. Deploy + verify production

### Part 2 order:
1. Create `hooks/useTodayWorkouts.ts`
2. Create `app/api/claude/score/route.ts`
3. Create `components/dashboard/ScoreCard.tsx`
4. Create `app/api/claude/daily-plan/route.ts`
5. Create `components/dashboard/DailyPlanPanel.tsx`
6. Update `app/dashboard/page.tsx` (add ScoreCard + hook)
7. `npx tsc --noEmit` + `npx eslint .`
8. Local smoke test
9. Deploy + verify production

### Part 3 order:
1. Create `app/api/claude/coach/route.ts`
2. Create `components/dashboard/CoachPanel.tsx`
3. Create `components/dashboard/SundayCheckinCard.tsx`
4. Update `app/dashboard/page.tsx` (add Coach + Sunday card)
5. `npx tsc --noEmit` + `npx eslint .`
6. Local smoke test
7. Deploy + verify production

---

## PRODUCTION AUDIT CHECKLIST

### Part 1 Checks
- [ ] Log "3.5 mile Zone 2 run" via voice → cal estimate shows with distance assumption
- [ ] Log "push day" via voice (no duration) → cal estimate shows with "assumed 45 min"
- [ ] Tap to adjust → enter 425 → display changes to "425 cal burned (your entry)"
- [ ] Check Supabase: workout_sessions row has estimated_cal_burned, cal_estimate_method, distance_miles
- [ ] Progress page: workout filter buttons appear and filter correctly
- [ ] Progress page: calorie burn chart renders with data
- [ ] `tsc --noEmit`: 0 errors
- [ ] Production: all above works on https://pantheon-woad.vercel.app

### Part 2 Checks
- [ ] Dashboard: ScoreCard appears between MacroBars and WeightCard
- [ ] "Calculate Score" → Roman numeral renders with verdict + recommendation
- [ ] Score uses GROSS calories vs day target (not net)
- [ ] Rest day → workout component = 10 automatically
- [ ] Before 2pm LA time + no workout → partial credit + "Still time" message
- [ ] "See Plan" → meals with portions render
- [ ] Zero state: clear saved_meals, request plan → Claude generates from scratch
- [ ] Save a generated meal → appears in saved_meals table
- [ ] Re-roll → new plan, old plan shown muted briefly
- [ ] Low cal check: log close to target, request plan → gets low_cal_message
- [ ] `tsc --noEmit`: 0 errors
- [ ] Production: all above works

### Part 3 Checks
- [ ] Coach tab visible at bottom-left, does not overlap LogFAB
- [ ] Tap Coach → panel slides up, LogFAB hides
- [ ] "Why did I get VII today?" → references actual data, not generic
- [ ] "What is my projected weight June 19?" → uses real trend
- [ ] "Log 30 min walk" → workout_sessions row created, chat confirms
- [ ] Close Coach → LogFAB reappears
- [ ] Sunday (mock or real): check-in card appears with TDEE or placeholder
- [ ] Dismiss check-in → weekly_checkins row inserted, card doesn't reappear
- [ ] `tsc --noEmit`: 0 errors
- [ ] Production: all above works
