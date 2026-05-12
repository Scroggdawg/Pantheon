# Pantheon — Op FASTRAK / V20 Handoff 2

**Date:** 2026-05-07
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Recon + research. No code, no destructive action.
**Filename:** Per locked convention `<PROJECT>_<VERSION>_<OP>_<TYPE>_<N>.md`.

Three asks back: (1) verify pass against master doc, (2) MacroFactor library-building research, (3) deletion query for the 7 saved_meals — surfaced for greenlight, not executed.

---

## Section 1 — Verify pass against master doc

### V.1 — Does the master doc agree with prior recon?

**Agreed across §0-§2 except one stale line:**

§2 ROUND 1 still reads "Library shortcut fired 0/4 on recent parses." This is stale. My Brick Alpha Phase 0 recon (2026-05-07, this session) corrected it to **1/8 (12.5%)** — "Three eggs." DID hit shortcut at 106ms on 2026-05-04. The `0/4` framing came from my Round 1 recon which sampled only 4 parses; expanding to the last 8 telemetry-bearing entries surfaced the one hit.

The master doc's Section 4 of THIS handoff acknowledges the correction. But the embedded §2 ROUND 1 bullet still reads `0/4`. Two options: (a) update §2 inline, (b) leave as historical record and trust readers to follow Section 4. I'd update inline — the doc is supposed to be self-contained for future Chat Claude.

**Agreed across §3 (architectural decisions):**

- #1 Cascade-first not rebuild — verified against current code.
- #2 Database-first LLM-as-fallback — matches.
- #3 Streaming is later unlock — matches.
- #4 Matcher choice data-driven — matches.
- #5 Bulk-load is accuracy moat — matches.
- #6 Portion editor is recovery mechanism — matches.
- #7 Auto-promote semantics narrow — REOPENED per master doc's own AMENDMENT. The amendment text is inline; the lock claim reads as still locked unless you read all the way through. Worth marking the locked text "SUPERSEDED — see AMENDMENT" inline so future readers don't miss it.
- #8 Measurement distributional — matches.

**Agreed across §4-§7 (absorbed bricks, keep list, sequence, Alpha sub-fixes):**

- All Alpha sub-fixes Alpha.1 through Alpha.8 verified against current code state. Line numbers and threshold constants in source match what the master doc claims. No drift since 2026-05-05 except the Brick D Step 4f.5 commit already accounted for.
- E0.1 through E0.5 closed in my prior recon — master doc's Section 4 already reflects this.

**Architectural decisions that DON'T contradict source:**

I went looking for places the master doc might have over-claimed. Couldn't find any in §0-§7. The line numbers, threshold constants, file paths, junk entry totals, and architectural diagnoses all hold up against the source code I just re-read.

### V.2 — Sequencing with new research dependency

V20 + Luke's read: Alpha cascade fixes (Alpha.1, .2, .3, .4, .5, .7, .8) ship as one bundle; Alpha.6 (auto-promote semantics) waits on the MacroFactor library research and ships separately.

**I agree, with one explicit dependency you should add to §6:**

**Brick Beta MUST wait on Alpha.6 shipping, not just on Alpha-ex-6 measurement.**

Reasoning: between "Alpha-ex-6 deploys" and "Alpha.6 deploys," the auto-promote bug continues firing on every multi-item meal Luke logs. Each one creates a fresh junk saved_meal. If Beta loosens matcher thresholds before Alpha.6 lands, those freshly-created junk entries surface as fast-path matches — same regression risk the original Phase 0 BLOCKER framing was supposed to prevent. The bug is just temporally extended now.

Practical implication:
- The §15 "MEASUREMENT GATE BEFORE BETA" section should add: "...AND Alpha.6 has shipped to production." Otherwise Beta could ship into a polluted library.
- Luke should plan for a small re-cleanup pass after Alpha.6 ships. Whatever junk accumulates between Alpha-ex-6 and Alpha.6 (probably 5-15 entries depending on how long the research takes) gets a final delete pass before Beta. Trivial work, not its own brick.

Other than that dependency, the split sequencing is right. Cascade fixes don't depend on research output. Research output doesn't depend on cascade fixes shipping.

### V.3 — Anything else to revise

Three small items for the master doc when V20 next edits it:

1. **§2 ROUND 1:** update `0/4` → `1/8 (12.5%) over recent telemetry-bearing entries; "Three eggs." was the lone hit at 106ms.`
2. **§3 #7:** mark "Multi-item meals don't auto-promote..." as SUPERSEDED inline, with pointer to AMENDMENT.
3. **§6 sequence diagram:** show Alpha-ex-6 and Alpha.6 as separate ship events, with Beta gated on BOTH (Alpha measurement + Alpha.6 deployed).

E0.4 (saved_meal_id migration backfill question): **forward-only acceptable.** Historical food_log_entries entries can't be cleanly backfilled without parsing `claude_parse_json.foods[].source_ref` and matching `lib:saved_meal:*` UUIDs against the saved_meals table — fragile, error-prone, and not load-bearing. The replay script measures parse latency and shortcut hit rate, neither of which needs `saved_meal_id` populated on historical rows. New rows from the meals/log route get the column populated; old rows stay null. Document this in the migration comment.

---

## Section 2 — MacroFactor library-building research (R.1 through R.5)

**Bottom line first:** MacroFactor has **zero auto-save behavior.** Every library write is explicit. Their three implicit surfaces (Favorites Bar, Hourly Go-Tos, Latest) are populated either by explicit user action (Favorites) or by **computed views over log history** (Hourly Go-Tos, Latest) — they create no library entries themselves. Pantheon's auto-promote-on-every-log conflates "logged" with "saved to library" in a way MacroFactor explicitly avoids.

### R.1 — What gets saved when

Three persistent surfaces, all explicit:

- **Favorites** — explicit. User searches for a food, taps the heart icon on the Food Detail page with a chosen serving size, confirms "Add to Favorites." Stored as `food + serving size` pair. Multiple favorites can exist for the same food at different serving sizes (e.g., "16oz latte" and "12oz latte" as distinct favorites).
- **Custom Foods** — explicit. User creates manually for items not in MacroFactor's 1.36M-item database.
- **Custom Recipes** — explicit. User creates either via "Create Recipe" form OR via "Create recipe from foods on your timeline" multi-select flow (tap multiple food log entries → "Create recipe" → name + servings → save).

Three implicit surfaces, all computed from log history:

- **Favorites Bar** — at top of search/log screen, prominent placement. Populated from explicit Favorites only.
- **Hourly Go-Tos** — "the foods you most frequently log during or near the hour you're currently logging foods to." Computed by recency + frequency, weighted toward the current ±1hr window. Help doc explicitly: "your 1pm Go-Tos are the foods you most commonly log between about 12pm and 3pm, with extra weight given to the foods you most commonly log during the 1-2pm hour."
- **Latest** — most recently logged foods. Pure recency.

**No auto-promote of any kind.** Help doc on Quick-adds is explicit: "Quick-adds aren't saved for future searching, so if you expect that you'll want to log the same food or meal again in the future, you should create a custom food or recipe instead."

### R.2 — How the multi-item case works

Logging a multi-item meal in MacroFactor (whether AI Describe, voice, or manual):
1. Items hit the food log as separate rows.
2. Each item independently appears in Latest / Hourly Go-Tos surfaces over time, based on log frequency.
3. **Nothing is saved as a recipe automatically.** No prompt, no overlay, no "save as recipe?" affordance during or immediately after logging.
4. If the user wants the multi-item meal saved as a reusable recipe, they go to the food timeline, tap each food they want included (or tap an hour to select all foods in that hour), then "Create recipe" — explicit, post-hoc.

UI cue prompting save: **none surfaced in any help doc I read.** The friction cost of NOT saving is zero — the foods still appear in Latest/Hourly Go-Tos based on frequency. The only thing the user loses is the "log this whole meal as one tap" affordance, which is what Custom Recipes provide.

### R.3 — Distinguishing one-time vs regular rotation

MacroFactor doesn't try to make this distinction architecturally. Instead:

- **One-time foods** stay in Latest briefly, decay out as new foods get logged, never enter Favorites unless the user explicitly hearts them.
- **Regular rotation** foods naturally rise to top of Hourly Go-Tos via frequency × time-of-day weighting.
- **Explicitly-special foods** get hearted by the user → Favorites Bar pinned at top.

The system relies on the user to make the "this is part of my rotation" call by hearting. The implicit surfaces handle the rest by recency + frequency, which auto-decays.

### R.4 — Editor flow before save

For AI Describe specifically:
1. AI parses → Plate view (editable per-food: qty, serving unit, food selection)
2. User edits any food details inline
3. User taps "Log Foods" → entries hit the food log
4. **No save prompt at this stage.** Foods are logged but not saved to library.

For "Create recipe from foods on your timeline":
1. User selects foods after they're already logged
2. User can adjust quantities and name during recipe creation
3. Recipe is saved as a separate Custom Recipe object — coexists with original food log entries (they're not removed)

The captured version is whatever the user has at the time of recipe creation, not the original parse.

### R.5 — Sources

- macrofactor.com/favorite-foods/ — Favorites are explicit, with serving size baked in
- help.macrofactorapp.com/en/articles/257-favorite-foods — heart-icon save flow
- help.macrofactorapp.com/en/articles/239-save-a-meal-for-later-use — multi-item recipe creation is explicit
- help.macrofactorapp.com/en/articles/215-how-to-log-food-in-macrofactor — three auto-load categories (Favorites + Hourly Go-Tos + Latest), Quick-adds aren't saved
- help.macrofactorapp.com/en/articles/14-create-recipes-from-foods-on-your-food-timeline — post-hoc recipe creation from log entries
- help.macrofactorapp.com/en/articles/258-ai-food-logging — Plate view → Log Foods, no auto-save
- macrofactorapp.com/mm-march-2025/ — Favorites announcement / hourly go-tos design
- sjawhar/macrofactor (lobehub.com/mcp/sjawhar-macrofactor) — Firestore schema mentions food logs, weight, workouts; library/favorites schema not exposed in the README

**Coverage gap:** I could not access the actual `docs/api-reference.md` in the MCP project (only the README is rendered on the lobehub MCP page, and direct GitHub fetch returned 403). The Firestore-schema specifics for favorites vs custom_foods vs custom_recipes are inferred from MacroFactor's help docs, not from primary-source schema. If V20 wants to validate the data-model question against API ground truth, Luke could clone sjawhar/macrofactor locally and read `docs/api-reference.md` directly.

---

## Section 3 — Five proposed library-building shapes for Pantheon

Each shape addresses the same question: when Luke voice-logs a meal, what enters the library and how? Each grounded in MacroFactor's empirical model + Luke's stated instincts.

### Shape A — MacroFactor Pure (zero auto-save)

**Mechanic:** Kill auto-promote entirely. Add an explicit heart-icon affordance on each food row in the post-parse edit screen + the food log display. User taps heart to save a food to Favorites. No batched save, no end-of-day, no auto-promote.

Library shortcut runs against:
- Explicit Favorites (saved_meals table, with new `is_favorite` column or similar)
- Computed "Recents" view over food_log_entries (top-N most recently logged foods, deduplicated by name)
- Computed "Frequents" view over food_log_entries (top-N most frequent foods, optionally with time-of-day weighting like MacroFactor's Hourly Go-Tos)

**What gets saved when:** only when user taps heart. Nothing automatic.

**Failure mode if user doesn't engage save:** food still appears in Recents / Frequents via the computed views; library shortcut still hits it. So the user's library effectively grows from log history — they just don't see "saved meals" for non-favorites.

**Pantheon-side cost:** **MEDIUM.**
- Schema: add `is_favorite boolean default false` to saved_meals (or split into two tables — overkill). Trivial migration.
- Add a Postgres view `recent_foods_view` and `frequent_foods_view` that derive from `food_log_entries.foods_json` — surfaces top-N foods deduplicated by name. ~30 lines of SQL.
- meals/log route: REMOVE the auto-promote block (lines 80-134). Net code reduction.
- Library shortcut helpers: query Favorites + Recents views together, prefer Favorites on ties.
- Native + web edit modals: add heart-icon component to each food row. EAS build needed.

**Files touched:** `app/api/meals/log/route.ts` (delete auto-promote block), `lib/claude/parse-meal-library-shortcut.ts` (query union), `lib/claude/tools/search-user-library.ts` (query views), new SQL migration, native `app/edit-food/[id].tsx` + `components/dashboard/TodayLog.tsx`, web `components/dashboard/FoodEntryEditModal.tsx` + `components/dashboard/TodayLog.tsx`. Plus type def updates.

**Closest match to MacroFactor's actual architecture.**

### Shape B — Pure + End-of-Day Auto-Save (Luke's instinct)

**Mechanic:** Same as Shape A, plus a daily cron job that auto-saves any food logged in the past 24 hours that's still in the user's log unedited at midnight Pacific.

Rationale per Luke: "If at the end of a day a food is left there then it saves. That way we know that I've had a chance to edit it and chose to keep it."

**What gets saved when:** explicit hearts (immediate) + leftover foods at midnight (batched).

**Failure mode if user doesn't engage save:** none — leftover foods auto-save at midnight regardless. But: every multi-item meal still pollutes if scoping isn't right (the same auto-promote bug just shifted in time).

**Pantheon-side cost:** **MEDIUM-HIGH.**
- Everything from Shape A, plus:
- Vercel cron job at midnight PT (vercel.json crons array). Currently no cron infrastructure per access doc, so this is new ground.
- Logic that distinguishes "edited" vs "unedited" — needs an `edited_at` or `original_foods_json` shadow field on food_log_entries to tell.
- Logic to merge multi-item logs into either single foods OR a Custom Recipe at save time.

**Files touched:** Shape A's surfaces, plus `vercel.json`, new cron route at `app/api/cron/end-of-day-save/route.ts`, food_log_entries schema (`edited_at` or shadow column), and the merge-logic decisions.

**Concern:** Luke's "if a food is left there" framing assumes the user reviews the log. If he's traveling or sleeps through review, junk meals auto-save. Same architectural risk as current auto-promote, just at midnight instead of immediately.

### Shape C — Per-Food Heart in Plate View (immediate-decision)

**Mechanic:** At parse time, the post-parse edit screen shows a heart icon next to each food. User can tap to favorite individual foods BEFORE tapping "Log." Decision happens at the moment the parse completes, while user is already reviewing.

No auto-promote. No end-of-day. Heart at parse time = save now; heart later from food log = save later. Both work.

**What gets saved when:** when user taps heart, whether at parse time or later from the food log display.

**Failure mode if user doesn't engage save:** food appears in Recents / Frequents via computed views (same as Shape A). Still discoverable.

**Pantheon-side cost:** **LOW-MEDIUM.**
- Same as Shape A but with the heart icon UI intentionally surfaced on the post-parse edit screen. UX pattern matches MacroFactor's "Plate view + Log Foods" flow.
- Computed Recents/Frequents views same as Shape A.
- meals/log auto-promote removed.

**Concern:** at parse time, user is focused on accuracy (qty, units, totals) and may not also engage with "do I want this in my library." MacroFactor explicitly avoids this conflation by not surfacing save at parse time — they trust the user to favorite later from search. Shape C asks more cognitive work per parse than MacroFactor.

### Shape D — Single-Food Auto-Promote Only (V18+'s original B.2 fix)

**Mechanic:** Keep auto-promote exactly as-is, BUT only fire when `body.foods.length === 1`. Multi-item meals require explicit "save as recipe" CTA.

**What gets saved when:** automatically on single-food logs, explicitly via CTA on multi-item logs.

**Failure mode:** the auto-promote pattern itself is preserved with the multi-item bug fixed. Luke gets the convenience of "log eggs → eggs is in library next time" without the junk-multi-item-saved-meal problem. But this still creates library entries from one-off single-food logs the user may not actually want pinned. (E.g., "1 yogurt" at a friend's house becomes a saved_meal forever.)

**Pantheon-side cost:** **LOW.**
- meals/log route: change line 110 from `else if (noLibraryRef || isProductRef)` to `else if ((noLibraryRef || isProductRef) && body.foods.length === 1)`. One conditional.
- Add explicit "Save as recipe" CTA to native + web for multi-item parses (uses existing Provisions recipe schema). Modest UI work.
- Web only fix without the CTA; native + web with the CTA.

**Most-conservative option.** Doesn't match MacroFactor's philosophy — they don't auto-promote anything — but it's the smallest possible patch and ships with one-line code change. Original V18+ recommendation.

### Shape E — Two-Tier with Computed Recents (the recommendation)

**Mechanic:** Most-faithful translation of MacroFactor's model into Pantheon's existing schema.

- saved_meals table becomes the **Favorites tier.** Only entries the user explicitly hearted. Add `is_favorite boolean` (default false) for migration safety; new entries always set true.
- New Postgres view `recent_foods` over `food_log_entries.foods_json` — top-N foods deduplicated by name + source_ref tuple, ordered by most-recent log timestamp. Optionally `frequent_foods` view ordered by log count.
- Library shortcut helpers query the union: Favorites + Recent + Frequent. Favorites preferred on score ties; Recent preferred over Frequent on cold-start.
- meals/log route: REMOVE auto-promote block entirely. Logged foods just become food_log_entries rows. The computed view feeds the library shortcut.

**What gets saved when:**
- Favorites: explicit heart icon at parse-edit time OR from food log display.
- Recents/Frequents: derived from log history; no library writes.

**Failure mode if user doesn't engage save:** food still surfaces via Recents/Frequents view. Library shortcut still hits. User loses nothing functionally; they just don't see a Favorites pin.

**Pantheon-side cost:** **MEDIUM.**
- Schema: `is_favorite` flag on saved_meals + migration to set existing 5 KEEP entries as `is_favorite=true` (or `false` and let user re-heart) + new SQL views (~50 lines for both views).
- meals/log: delete auto-promote block (~50 line reduction).
- Library shortcut helpers: query union from Favorites + Recents view. Modest TS changes.
- Native + web: heart icon on food row in post-parse edit screen + food log display.
- EAS build for native heart icon.

**Files touched:**
- `supabase/migrations/01x_favorites_and_views.sql` (new)
- `app/api/meals/log/route.ts` (auto-promote delete, code reduction)
- `lib/claude/tools/search-user-library.ts` (union query)
- `lib/claude/parse-meal-library-shortcut.ts` (query both surfaces)
- `app/edit-food/[id].tsx` (native heart)
- `components/dashboard/FoodEntryEditModal.tsx` (web heart)
- `components/dashboard/TodayLog.tsx` (native + web heart on log rows)
- `types/database.ts` (Favorite type + view types)

### Comparison table

| Shape | Auto-save? | UI cost | Schema cost | EAS build? | MacroFactor-faithful? | Luke's instinct? |
|---|---|---|---|---|---|---|
| **A** Pure | None | Heart icon | New views + flag | Yes | High | Partial |
| **B** Pure + end-of-day | Midnight batch | Heart + cron logic | Views + cron + edited_at | Yes | Low | High |
| **C** Heart at parse | None | Heart at parse | New views + flag | Yes | Medium | Partial |
| **D** Single-food only | Automatic when 1 food | "Save as recipe" CTA | None | Yes (CTA) | Low | Partial |
| **E** Two-tier | None for foods; explicit hearts | Heart icon | Flag + 2 views | Yes | High | High |

### My recommendation

**Shape E** as the architectural target. **Shape D** as a stopgap if Luke wants Alpha.6 to land in the next sprint without waiting for the heart-icon UI work.

Reasoning:
- Shape E is the cleanest match to MacroFactor's empirical model. Luke explicitly asked us to follow their lead.
- Shape E uses Pantheon's existing `saved_meals` table with one flag column added. No table splits, no big migration.
- Shape E's computed views feed the matcher without creating library writes — eliminates auto-promote pollution at the architectural level, not just at the conditional level.
- Shape B (end-of-day auto-save) has the same structural risk as current auto-promote, just shifted in time. Luke's instinct is reasonable but auto-saving at midnight without user review of every food still creates junk on travel days, sleep nights, distracted weeks.
- Shape D ships in one line of code and fixes the worst bug. If "ship Alpha.6 now and iterate to Shape E later" is the right pace, Shape D is the bridge.
- Shape C (heart at parse time) overloads the parse-edit cognitive load. Skip in favor of E.

If Luke wants the smallest viable Alpha.6: ship Shape D now, plan Shape E for Op FASTRAK Brick Beta or Brick Delta. If Luke wants to do this once and right: ship Shape E directly as Alpha.6 — accepts a slightly larger sprint but skips the throwaway stopgap.

---

## Section 4 — Junk cleanup deletion query (DO NOT EXECUTE)

V20 confirmed deletion list of 7 saved_meals. Ready to execute via Supabase service-role REST after V20 greenlight. **Not running this turn.**

**IDs (verified from earlier recon dump, current as of 2026-05-07):**

```
47918c0b-d1c8-4db6-8e3f-7541cbd78dc2  Banana                                  (195 cal)
35e5bf06-7db4-4088-b739-390a29c4148d  Blueberries                             (289 cal)
42404622-1117-46bb-8c4a-99511a61939a  Shrimp fajitas with corn tortillas      (3420 cal)
30544222-2ddc-479c-bcfa-7cc6e021244d  H-E-B Fajitas Chicken Thighs            (214 cal)
d066192a-7892-4507-b2bb-0173987d0d50  Test smoke meal                         (100 cal)
053b1439-80cd-4381-b3f9-993bf941c8eb  David Protein Bar - Blueberry Pie       (200 cal)
1a2ac44d-80d4-4afd-83ed-bd388e77e14e  Protein Shake A - Pre-Workout           (210 cal)
```

**Option 1 — Supabase SQL Editor (preferred, single transactional delete):**

```sql
DELETE FROM saved_meals
WHERE id IN (
  '47918c0b-d1c8-4db6-8e3f-7541cbd78dc2',  -- Banana
  '35e5bf06-7db4-4088-b739-390a29c4148d',  -- Blueberries
  '42404622-1117-46bb-8c4a-99511a61939a',  -- Shrimp fajitas
  '30544222-2ddc-479c-bcfa-7cc6e021244d',  -- H-E-B Fajitas
  'd066192a-7892-4507-b2bb-0173987d0d50',  -- Test smoke meal
  '053b1439-80cd-4381-b3f9-993bf941c8eb',  -- David Bar
  '1a2ac44d-80d4-4afd-83ed-bd388e77e14e'   -- Protein Shake A
);
-- Expected: DELETE 7
```

**Option 2 — REST via service-role (what I'd run from Bash):**

```bash
cd "/Users/scrogdawg/BMF Headquarters/2026 - THE NARRATIVE/26_09 Pantheon/pantheon"
set -a && source .env.local && set +a
curl -s -X DELETE \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/saved_meals?id=in.(47918c0b-d1c8-4db6-8e3f-7541cbd78dc2,35e5bf06-7db4-4088-b739-390a29c4148d,42404622-1117-46bb-8c4a-99511a61939a,30544222-2ddc-479c-bcfa-7cc6e021244d,d066192a-7892-4507-b2bb-0173987d0d50,053b1439-80cd-4381-b3f9-993bf941c8eb,1a2ac44d-80d4-4afd-83ed-bd388e77e14e)" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Prefer: return=representation"
```

**Safety notes:**
- Cascade impact: `food_log_entries.saved_meal_id` does not yet exist (Alpha.7 hasn't shipped), so no FK violations. Historical food_log_entries rows reference these saved_meals only via `claude_parse_json.foods[].source_ref` — that's a JSONB string field, not a foreign key, so it survives the delete as a stale text reference. Acceptable: those references aren't used by any read path.
- The LLM tool `search_user_library` queries the live saved_meals table; once these rows are deleted, the LLM cannot return their UUIDs as matches. Self-cleaning.
- Protein Shake A - Pre-Workout has 3 historical re-logs (food_log_entries rows referencing `lib:saved_meal:1a2ac44d-...`). Those rows stay; they continue to display correctly because the macros + foods_json were copied at log time. The library_source_ref string becomes a stale pointer but nothing reads it. Safe.

**Awaiting V20 greenlight to execute.** Per doctrine — no destructive action without explicit authorization. Reply confirming "execute the delete" and I run Option 2 with `Prefer: return=representation` so we get back the 7 deleted rows for the audit trail.

---

## Section 5 — Status / docket

**At bat:** This handoff. V20 to consume + decide on:
- Master doc revisions (V.1 / V.3 small edits + V.2 Beta-gated-on-Alpha.6 dependency)
- Library-building shape decision (E recommended; D as stopgap; B per Luke's instinct as alternative)
- Greenlight on the 7-row delete

**On deck:** Pending V20 + Luke decisions →
- Run delete query
- Alpha-ex-6 implementation handoff (cascade fixes 1, 2, 3, 4, 5, 7, 8 bundled into one Vercel deploy)
- Library-building shape lands as Alpha.6 in a separate ship event

**In the hole:** Brick Beta — gated on (a) Alpha measurement + (b) Alpha.6 deployed.

**Future docket:** Brick Gamma (PANTRY), Brick Delta (PLATE), Brick Epsilon (BIG BUTTON), Bricks Zeta/Eta/Theta as-needed.

**Convention:** This is `_HANDOFF_2.md` per the locked filename convention from earlier in this session. Next will be `_HANDOFF_3.md` if same op + version, or new project/version/op tokens if scope shifts.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_FASTTRACK_HANDOFF_2.md
