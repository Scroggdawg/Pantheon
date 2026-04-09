# PANTHEON — Session 3 Handoff
*Generated: April 9, 2026 — End of Session 2*

---

## CURRENT STATUS: LIVE IN PRODUCTION

Production URL: https://pantheon-woad.vercel.app
Password: gospurs

Verified working right now:
- Login to dashboard flow (production + local)
- Supabase connected — data loads from production
- RLS fixed — all tables have allow_all permissive policy
- Food log entries save (RLS fix confirmed)
- Weight showing 198.0 lbs from Supabase
- Calories tracking (105 of 2,250 consumed confirmed in prod)
- Macro bars rendering with real data
- Backup script: npm run backup creates backups/pantheon-YYYY-MM-DD.json
- All Session 2 fixes deployed (7 fixes + 2 incident fixes)
- Vercel env vars: all 5 set for production

Not yet verified (carry over from Session 2 audit):
- Timestamps visible on food log entries
- Tap-to-edit food entries (quantity / time / delete)
- Per-item removal in edit modal
- Continuous voice (no silence cutoff)
- Workout image upload + OCR (Storage URL fix unverified in browser)
- Save as meal flow
- SavedMealEditModal (pencil icon in QuickSelectModal)
- Duplicate meal name warning

---

## PRODUCTION INFRASTRUCTURE

Component        | Details
-----------------|--------------------------------------------------
App hosting      | Vercel (Hobby tier)
Production URL   | https://pantheon-woad.vercel.app
Database         | Supabase (free tier)
Supabase project | qlkjgguxjddalbswoxpm
Git              | main branch, 4 commits
Backup script    | npm run backup

Supabase free tier note:
Projects pause after 7 days of inactivity. Pantheon is used daily
so this is unlikely to trigger. Run npm run backup before every
session as primary data safety net.

Vercel env vars confirmed (production):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY
- PANTHEON_PASSWORD

---

## SESSION START PROTOCOL
Run these checks at the start of EVERY session before any code work.
If any check fails: fix infrastructure before touching code.

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
  Expected: HTTP 201 (row inserted) or HTTP 409 (conflict — also fine, means RLS allows it)
  NOT acceptable: HTTP 401 (RLS blocking) or HTTP 403

Check 2 — Production URL loads:
  curl -s -o /dev/null -w "%{http_code}" https://pantheon-woad.vercel.app/login
  Expected: 200

Check 3 — Backup runs clean:
  npm run backup
  Expected: backup file created, all tables report row counts

---

## SESSION 2 INCIDENTS — LESSONS LEARNED

Incident 1: SavedMealEditModal import before file existed
  Import added to QuickSelectModal.tsx before file was created on disk.
  Crashed entire dashboard component tree.
  Fix: Created file, cleared .next cache, restarted dev server.
  Doctrine update: NEW FILE RULE added to VIBE_CODING_DOCTRINE.md

Incident 2: heic2any SSR crash
  Static import of heic2any accessed window at module evaluation time.
  Caused 500 on every page even with use client directive.
  Fix: Converted to dynamic import() inside event handler only.
  Doctrine update: SSR-SAFE IMPORTS RULE added.

Incident 3: RLS policies never actually applied
  Session 1 handoff claimed permissive RLS was set — it was not.
  Terminal Claude ran SQL fix via curl against REST API — silently rejected.
  Reported as fixed. Was not fixed. Caused 401s for entire Session 2.
  Real fix: SQL Editor in Supabase dashboard only.
  Doctrine update: SESSION START PROTOCOL established.

---

## SESSION 3 PRIORITIES

### IMMEDIATE — Complete before building anything new

Run full 12-step runtime verification.
These were never completed due to Session 2 incidents.
Do not skip. Report each step PASS or FAIL.

1.  Log a meal via voice — timestamps show, macros update
2.  Tap logged entry — edit modal opens
3.  Remove one food item from entry — totals recalculate correctly
4.  Save edited entry — Supabase row updated
5.  Open QuickSelectModal — staple meals appear
6.  Tap pencil on a meal — edit modal opens, does NOT log meal
7.  Rename the meal — list refreshes with new name
8.  Delete a meal — disappears from list
9.  Save a new meal — duplicate name warning on second save
10. Upload a workout image (JPEG) — verify Storage URL in DB not base64
    NOTE: Storage fix from Session 2 was never browser-verified.
    Check Supabase Storage dashboard to confirm file appears in bucket.
11. Upload a workout image (HEIC if available) — confirm conversion
12. Simulate workout save failure — retry banner shows, data preserved

Fix all failures using full VIBE CODING DOCTRINE audit stack.
Only proceed to Phase 1 after all 12 pass.

---

### PHASE 1 — Foundation (Session 3)

1. Progress charts page (/progress)
   - Weight trend over time (Recharts line chart)
   - Calorie history (bar chart, daily)
   - Macro adherence over time
   - Workout volume (sessions per week)
   - Body composition trend if body fat logged

2. PWA manifest (30 min task)
   Add to home screen support — makes Pantheon feel native on iPhone.
   Files: public/manifest.json, public/icons/, meta tags in layout.tsx
   Test: Add to Home Screen on iPhone Safari after deploy.

3. Barcode scanning
   - Use BarcodeDetector API (browser-native on Chrome)
   - Scan UPC code, hit Open Food Facts API, get macro data
   - Pre-fill log entry with scanned food
   - Fallback to manual entry if scan fails
   - Test with a real packaged food barcode

4. Meal repository
   - Seed with 20-30 healthy meals Luke actually eats
   - Include macros, ingredients, tags (high-protein, low-carb, etc.)
   - This feeds the Greek God Bod Score daily plan generator
   - Verify meals appear in QuickSelectModal after seed

---

### PHASE 2 — Greek God Bod Score (Session 4)

Background:
Goal: 198 lbs to 185 lbs by June 19, 2026
Time remaining: 10 weeks (71 days from April 9)
Rate of loss needed: 1.3 lbs/week
Training split: 3 lift days + 3 Zone 2 days + 1 rest day per week
Priority: lean out while preserving muscle mass

Weekly calorie math with new split:
- 3 Lift Days: 2,250 + 200 = 2,450 cal each
- 3 Zone 2 days: 2,250 cal each (no adjustment)
- 1 Rest Day: 2,250 - 150 = 2,100 cal
- Weekly total: (3 x 2,450) + (3 x 2,250) + (1 x 2,100) = 16,200 cal/week
- Daily average: 2,314 cal/day

Score algorithm (Roman numerals I through X):
Calculated each evening. Weighted components:
- Protein hit vs 200g target (30% weight — muscle preservation)
- Calories hit vs daily target (25% weight — fat loss)
- Workout completed per split (20% weight)
- Weight trend vs 1.3 lb/week projection (15% weight)
- Carb and fat targets hit (10% weight)

Score X = all components perfect
Score I = significant deviation from plan
Display: Roman numeral + one-sentence Claude verdict
Example: "VII — Strong lift day but protein 40g short. Hit a shake."

Daily plan generator:
- Runs at any time of day
- Input: current food log, remaining macros, time of day,
  workout status, meal repository
- Output: specific meals with exact portions
- "If you eat exactly this, your score will be X tonight"

Re-roll feature:
- Button generates a new meal plan variation
- Supports partial re-roll: keep breakfast, re-roll dinner
- Each re-roll is one Claude API call with current state as context
- Show 2-3 alternatives, user selects one

AI Coach chat interface:
- Unified chat that knows full app state at all times
- Can explain score, adjust plan, take log commands
- Example queries:
  "What should I eat in the next 2 hours to hit protein?"
  "Log that I skipped the gym today"
  "What is my projected weight on June 19 at this rate?"
- Built as floating chat panel on dashboard, not a separate page
- Do NOT build as a separate chatbot — integrate with score feature

---

### PHASE 3 — Pantry System (Session 5)

Receipt upload to pantry inventory:
- Upload grocery receipt photo, Claude Vision OCR parses it
- Extract items and quantities, add to pantry_items table
- Display as running inventory with counts

Auto-deduct on food log:
- When food is logged, decrement pantry quantity automatically
- Each coconut water logged reduces count by 1
- Alert when item count drops below 2

Recipe conversion via AI Coach chat:
- "The cans of tomatoes, bell peppers, and turkey are now
  4 servings of meat sauce"
- Claude calculates combined macros, creates saved meal entry
- Pantry items decremented by recipe quantities automatically

Pantry-aware daily planning:
- Greek God Bod Score plan pulls from pantry inventory
- Suggestions limited to meals you can actually make right now

---

### PHASE 4 — HealthKit Auto-Sync via OpenClaw (Session 6)

What it does:
Automatically pulls workouts from Apple Health into Pantheon.
Apple Watch workouts, Activity rings, active calorie burns.
Replaces all manual workout logging.

Architecture:
Apple Watch records workout
  -> HealthKit stores in healthdb_secure.sqlite on Mac
    -> OpenClaw reads DB on 30-minute cron
      -> Compares against workout_sessions already in Supabase
        -> POSTs new workouts to Pantheon /api/workouts/sync
          -> Dashboard shows calorie burns automatically

Prerequisites:
- OpenClaw installed on Mac Mini or main Mac
- Full Disk Access granted in System Settings -> Privacy & Security
- Pantheon API route: POST /api/workouts/sync (build in Session 6)
- Deduplication: check workout start_time before inserting

Replaces: Wyze sync (broken, deprecated once HealthKit ships)

---

## KNOWN ISSUES GOING INTO SESSION 3

1. 12-step verification incomplete — carry over from Session 2
2. Wyze sync broken — deprecated, replaced by HealthKit plan
3. No progress charts — /progress page not built
4. No PWA manifest — cannot add to iPhone home screen yet
5. No barcode scanning — manual entry only
6. Meal repository empty — needs seeding before score feature
7. Supabase Storage for workout images — Session 2 fix unverified
   in browser (check step 10 of runtime verification carefully)
8. Supabase free tier — pause after 7 days inactivity
   (mitigated by daily use and backup script)

---

## USER PARAMETERS (Luke)

Parameter          | Value
-------------------|------------------------------------------
Current weight     | 198 lbs
Goal weight        | 185 lbs
Goal date          | June 19, 2026
Days remaining     | 71 (from April 9, 2026)
Weeks remaining    | 10.1
Rate of loss       | 1.3 lbs/week
Body fat %         | 25%
Base calories      | 2,250/day
Protein target     | 200g
Fat target         | 90g
Carbs target       | 160g
Lift Day adjust    | +200 cal / +50g carbs (3 days/week)
Zone 2 / BJJ       | no adjustment (3 days/week)
Rest Day adjust    | -150 cal / -30g carbs (1 day/week)
Training split     | 3 lift + 3 Zone 2 + 1 rest (updated Apr 9)
Weekly avg cals    | 2,314/day across all day types

---

## RESUME PROMPT FOR SESSION 3

Apply VIBE CODING DOCTRINE (VIBE_CODING_DOCTRINE.md in project root)
to all work in this session.

We are building Pantheon — AI-native nutrition and body composition
tracker. Single user (Luke), password gate only (gospurs).
Production: https://pantheon-woad.vercel.app

SESSION START PROTOCOL — run before any code work:

Check 1 — Supabase INSERT works:
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

Check 2 — Production URL:
  curl -s -o /dev/null -w "%{http_code}" https://pantheon-woad.vercel.app/login
  Expected: 200

Check 3 — Backup:
  npm run backup
  Expected: file created, row counts shown

If any check fails: fix before touching code.

Then run 12-step runtime verification from this handoff.
Report each step PASS or FAIL before building anything new.
Fix all failures with full doctrine audit stack.

Only proceed to progress charts after all 12 steps pass.

PROJECT: /Users/scrogdawg/BMF Headquarters/2026 - THE NARRATIVE/26_09 Pantheon/pantheon/
SUPABASE: https://supabase.com/dashboard/project/qlkjgguxjddalbswoxpm
