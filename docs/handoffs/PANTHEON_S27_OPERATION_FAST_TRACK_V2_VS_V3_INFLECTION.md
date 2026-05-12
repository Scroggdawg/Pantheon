# PANTHEON — Operation Fast Track, Post-V2-Review Empirical Asks

**Date:** 2026-05-07
**Author:** Terminal Claude
**Recipient:** V18+ Chat Claude
**Mode:** Recon + consultation. No code, no edits. Same posture.
**Per Luke:** Operation Fast Track is the canonical name. Held throughout.

This is the third pass on Operation Fast Track. V18+ asked whether v2 ships as drafted, gets folded into v3, or ships partial then redrafts. The MacroFactor screenshots Luke shared materially shifted the architectural conversation; my job here was empirical recon to either ground or ground-down V18+'s working hypothesis.

Bottom line: **V18+'s working hypothesis is mostly right but has one architectural call I'd push back on directly (A.2: embedding matcher) and three ship-decisions I'd defer (A.3, A.6, A.7) until measurement results from a tighter Sprint 1.** Specifics below.

---

## 0 — TL;DR

**Three findings reshape the proposal:**

1. **MacroFactor's stack is Firebase/Firestore + Typesense for food search + streaming UI.** Verified from a third-party MCP client project (`sjawhar/macrofactor`) that reverse-engineered the API. They are NOT using embedding cosine similarity. They use Typesense — a typo-tolerant BM25-based full-text search engine, sub-50ms latency, no LLM or embedding dependency. **This is a real pushback on V18+'s A.2 framing: Pantheon shouldn't reach for embeddings before evaluating whether a similar fast/typo-tolerant search engine handles the matching better and cheaper.**

2. **MacroFactor's "instant" feel is genuinely streaming.** Their own April 2022 product post confirms: "Once a meal is fully analyzed, foods will stream into your plate." The perceived latency is "first food appears" time, not full-parse-completion time. **Streaming requires per-food architecture (BRICK SPLIT) to be meaningful.** Pantheon's current composite `foods_json` shape would have to change.

3. **Unit conversion data lives IN the food entry as a structured `servings` array with descriptions** (e.g., `[{description: "1 fajita", grams: 139}, {description: "1 platter", grams: 750}]`). Not LLM-derived at parse time. Not USDA food_portions at runtime. **It's curated database content** — Pantheon's BRICK PANTRY needs to populate this, USDA gives partial coverage, the rest is manual or LLM-fill.

**Five saved_meals are confirmed junk** from the auto-promote bug (B.2). Cleanup list ready, awaiting V18+ confirmation before delete (per doctrine — no destructive action without explicit OK).

**Native edit modal is ~30% of the way to MacroFactor's portion editor.** Per-food iteration + qty edit + macros recompute already in place. Missing: unit picker UI, per-unit gram weights data, live impact preview, search-alternative-match mid-edit. The infrastructure for BRICK PLATE exists; the data layer (BRICK PANTRY) is what's missing.

**Schema migration cost for per-food semantics (BRICK SPLIT) is large.** 15 web files + 4 native files consume `foods_json`. Not a single-session brick.

**Recommendation: Option 3 with tighter Sprint 1.** Ship the cascade fixes that don't depend on data model OR matcher choice. Hold A.2/A.3/A.6/A.7 for v3 redraft after measurement. Reasoning in §6.

---

## 1 — Part A: MacroFactor empirical observation

### A.1 — Actual latency

Direct observation hit a wall. macrofactor.com is a marketing site; the actual product is mobile-only (iOS + Android, no public web app). I have no Chrome extension access, no MacroFactor account, no iOS device under my control to network-trace.

**What I found from third-party reverse-engineering:**

A community-built MCP server and CLI client at `sjawhar/macrofactor` (referenced via lobehub.com/mcp/sjawhar-macrofactor) reverse-engineered the actual API. From their documented architecture:

- **Backend:** Firebase/Firestore (project `sbs-diet-app`)
- **Auth:** Firebase Auth
- **Reference data gating:** Firebase App Check (returns 403 to unauthenticated/unbypassed clients)
- **Food search:** "MacroFactor's Typesense instance, which combines USDA common foods with a branded food database"
- **Food entry shape:** `{ foodId, grams, loggedAt }` — quantities canonicalize to grams; the unit selector in the UI is sugar over a single gram value
- **Servings array per food:** `description` field for portion matching (this is the "1 fajita / 1 platter / 1 cup" alternatives)

**What this tells us about the "instant" feel:**

- Typesense food search is sub-50ms by design. Once the LLM has identified candidate foods, resolving each to a database hit is essentially free.
- MacroFactor's own April 2022 post on the new food logger states explicitly: **"Once a meal is fully analyzed, foods will stream into your plate."** This is the streaming behavior Luke perceived as instant.
- Their own marketing post (january 2022) describes the database as "2-4× faster, backed by regionally distributed servers." That's the Typesense story.

**What I cannot verify directly:** the actual end-to-end parse latency in seconds. Luke's "instant" is a felt-experience report, not a network measurement. Best estimate from public sources: **first food appears 1-2s, full meal streams in over 3-8s.** This is consistent with "feels instant" for a user who isn't watching network tab.

**Pantheon comparison:** Today the screenshot meal is 59.6s flat, no streaming, all-or-nothing. Even if Pantheon's parse becomes 25s post-Sprint-1, the felt experience is still "wait 25 seconds" because nothing renders until the LLM finishes. **Streaming is a separate UX win independent of speed.** It requires per-food architecture.

### A.2 — Unit conversion data source

MacroFactor's database stores per-food serving alternatives as a `servings` array with `description` + `grams` fields. Multiple options per food, baked into the database entry, not derived at runtime.

**Where their data comes from (verified from their own help docs and product posts):**

- **NCC Food and Nutrient Database** — the academic gold standard for micronutrient data, used by University of Minnesota's Nutrition Coordinating Center. **Licensed**, not free. This is Pantheon's biggest moat-blocker if we go down this path.
- **USDA common foods** — the same source Pantheon uses, with their own typo-tolerant indexing on top
- **Branded foods database** — their own + community-validated entries
- **Auto-conversion when weight or volume is provided** — they generate the standard-unit alternatives (g, oz, ml, cup) automatically when the food has a base weight/volume measurement

**Database size:** ~1,360,000 verified food items (current standard DB) + ~1,040,000 in legacy DB. **31,000× larger than Pantheon's 43-entry library.** The moat is the data, not the algorithm.

**For Pantheon:** the unit-alternatives data is not derivable from USDA alone in any clean way. USDA's `food_portions` table covers some foods but is inconsistent (lots of generic foods have no portion data; restaurant items / brand-name items rarely have it). Open Food Facts has `serving_quantity` per product but not multi-unit alternatives.

**Three paths for BRICK PANTRY:**

1. **Cherry-pick USDA `food_portions` where it exists, LLM-fill the rest.** Add a `unit_alternatives` JSONB column to products / saved_meals. For each food, populate `[{unit: "fajita", grams: 139, source: "llm_estimated"}, ...]`. Confidence labels per row.
2. **License NCC.** Pricey ($1500-5000/yr for academic use, more for commercial). Not viable for a single-user app.
3. **Build incrementally.** Start with Luke's actual foods. Every time he edits a unit-with-grams in the UI (BRICK PLATE), persist that unit-grams pair to the food's `unit_alternatives`. Library grows organically.

I'd recommend (3) with (1) as bulk-import for staples. (2) is overkill at current scale.

### A.3 — Data model shape

MacroFactor's per-food rows on the food log are confirmed by Luke's screenshots and consistent with the `{foodId, grams, loggedAt}` entry shape from the reverse-engineered API. **Each food is its own Firestore document.** Meal-time grouping appears to be temporal/visual — foods within the same meal-label window are clustered in the UI but each is independently editable, deletable, and addressable.

What Pantheon would need to match that semantics:

- **Add a `meal_id` column** to a new per-food table (or add it to a refactored `food_log_entries`)
- **Group by meal_id** in display layers (TodayLog, DayDetailPanel, dashboard)
- **Per-food edit affordances** — what BRICK PLATE wants to enable

But: **the migration is sizable.** See §3 for consumer count.

---

## 2 — Part B: Pantheon current-state recon

### B.1 — FoodEntryEditModal verbatim (native + web)

**Native edit screen at `/Users/scrogdawg/Code/pantheon-native/app/edit-food/[id].tsx`** (766 lines).

What's editable today (verbatim from the code):

- **Time** — `hh:mm` text inputs (lines 397-417)
- **Scale entire entry by %** — TextInput + ¼/½/¾/Full presets, applies ratio to all foods at once (lines 421-460)
- **Per-food row** (lines 465-508):
  - `food.name` displayed as text, NOT editable
  - `food.calories / protein_g / carbs_g / fat_g` displayed as text, recomputed on qty change
  - `food.qty` editable via decimal-pad TextInput
  - `food.unit` displayed as a label, **NOT editable** (line 492: `<Text style={styles.unitLabel}>{food.unit}</Text>`)
  - Remove button (X icon)
- **Totals** — read-only display of summed macros (lines 512-521)
- **Delete entry button** (lines 524-536)

What's NOT in the native edit modal:

- **No unit selector.** `food.unit` is a label, full stop.
- **No per-unit gram weights surfaced.** No "139g per fajita" anywhere.
- **No multiple unit alternatives.** No way to switch from "platter" to "fajita."
- **No live impact preview on day's macros.** Totals show but no rings, no day-context.
- **No search alternative database matches mid-edit.** No way to say "this matched the wrong USDA entry, find a better one."
- **No add-food affordance.** Can only remove existing foods, not add new ones to the entry.

**Web edit modal at `/Users/scrogdawg/BMF Headquarters/.../components/dashboard/FoodEntryEditModal.tsx`** (162 lines, similar shape, no unit selector either).

**Gap from MacroFactor's portion editor:**

The infrastructure is there for ~30% of MacroFactor's behavior. Specifically:

- ✅ Per-food iteration in the UI (lines 465-508 map over editFoods)
- ✅ Qty edit with macros recompute on change (lines 141-165: ratio-based scaling)
- ✅ Per-food remove (lines 167-182)
- ✅ Save dirty-tracking, cancel-with-confirm UX
- ❌ Unit picker UI (would need new component — modest work)
- ❌ Per-unit gram weights data (load-bearing — needs database support, BRICK PANTRY)
- ❌ Live impact rings on day macros (modest visual addition)
- ❌ Add-food affordance (small)
- ❌ Search-alternative-match flow (large new flow)

**My read:** if BRICK PANTRY ships the data, BRICK PLATE is maybe 1-2 sessions of native UI work. The native edit screen has the right foundations. The hard part is the data, not the UI.

### B.2 — food_log_entries + saved_meals schema

Verbatim from `supabase/migrations/001_schema.sql`:

```sql
create table food_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,
  logged_at timestamptz default now(),
  meal_label text,
  day_type text check (day_type in ('lift', 'zone2', 'rest')),
  foods_json jsonb,                  -- THE COMPOSITE COLUMN
  total_calories int,
  total_protein_g numeric,
  total_carbs_g numeric,
  total_fat_g numeric,
  log_method text check (log_method in ('voice', 'photo', 'barcode', 'quick', 'manual', 'ocr')),
  raw_input_text text,
  claude_parse_json jsonb,
  created_at timestamptz default now()
);

create table saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users on delete cascade,
  name text,
  foods_json jsonb,                  -- ALSO COMPOSITE
  total_calories int,
  total_protein_g numeric,
  total_carbs_g numeric,
  total_fat_g numeric,
  times_logged int default 0,
  last_logged_at timestamptz,
  tags text[],
  is_staple boolean default false,
  created_at timestamptz default now()
);
```

Both tables use `foods_json jsonb` as a composite column holding the FoodItem array. **One row per logged meal, foods nested inside.**

**Downstream consumers of `foods_json` — the migration cost surface:**

Web repo (15 files):
- `types/database.ts` — type def
- `app/api/claude/coach/route.ts:145` — LLM context (food names)
- `app/api/claude/daily-plan/route.ts:15,112,160` — LLM context + plan generator
- `app/api/meals/log/route.ts:63,116` — write
- `components/dashboard/CoachPanel.tsx:98,127,147,161,226,241` — coach CRUD (6 sites)
- `components/dashboard/FoodEntryEditModal.tsx:40,42,123` — edit
- `components/dashboard/DailyPlanPanel.tsx:16,229` — display
- `components/dashboard/TodayLog.tsx:67,116` — display
- `components/progress/DayDetailPanel.tsx:206,235` — display
- `components/logging/VoiceLogger.tsx:166` — write
- `components/logging/SavedMealEditModal.tsx:107` — saved-meal display
- `components/logging/SaveMealModal.tsx:48` — write
- `components/logging/TextLogModal.tsx:77` — write
- `components/logging/QuickSelectModal.tsx:80,86,135` — saved-meal log
- `lib/seed.ts` (8 occurrences) — test seed data

Native repo (4 files):
- `app/edit-food/[id].tsx:95,249` — native edit
- `types/database.ts:137,298` — type def
- `components/dashboard/TodayLog.tsx:72` — native today log
- `components/dashboard/MealPlanPreview.tsx:346,380` — native meal plan

**Migration cost estimate for BRICK SPLIT (per-food rows):**

This is a **multi-session brick**, not a quick fix. Roughly:

- 1 session: schema migration + write-path refactor (meals/log, VoiceLogger, TextLogModal, SaveMealModal, MealPlanPreview, CoachPanel CRUD)
- 1 session: read-path refactor (TodayLog, DayDetailPanel, DailyPlanPanel — display + grouping by meal_id)
- 1 session: edit-path refactor (FoodEntryEditModal web, edit-food/[id].tsx native — per-food edit semantics)
- 0.5 session: LLM-context refactor (coach/route.ts, daily-plan/route.ts — they iterate foods_json today)
- 0.5 session: type def + seed migration

**Roughly 3-4 working sessions just for the data-model migration.** And it requires 1 EAS build cycle (native consumers).

### B.3 — Junk library candidates

I queried each saved_meal's `foods_json` to verify junk vs clean. **5 of 10 saved_meals are confirmed junk** from the auto-promote bug. None should be deleted in this turn — surfacing for V18+ confirmation per doctrine.

| Saved meal | times_logged | Stored cal | Reality | Status |
|---|---|---|---|---|
| **3 eggs** | 7 | 215 | Single food, aliases `[three eggs, 3 large eggs, eggs]` | ✅ KEEP — clean re-use |
| **Protein Shake A - Pre-Workout** | 3 | 210 | Single named recipe (foods_json may have multiple components but coherent under one meal name); 3 re-logs suggest it works | ✅ KEEP (pending recipe vs single-food clarification with Luke) |
| **Churro** | 1 | 150 | Single food, calorie-anchored, created post-screenshot as the corrected re-log | ✅ KEEP |
| **David Protein Bar - Blueberry Pie** | 1 | 200 | Single food, branded match | ✅ KEEP |
| **Double espresso** | 1 | 24 | Single food | ✅ KEEP |
| **Banana** | 1 | 195 | foods_json = [Banana 105 cal, Peanut butter 90 cal]. Named after first food only. Library shortcut on "banana" returns 195 — 86% too high. | ❌ JUNK — delete |
| **Blueberries** | 1 | 289 | foods_json = [Blueberries 84 cal, Almond butter 205 cal]. Library shortcut on "blueberries" returns 289 — 244% too high. | ❌ JUNK — delete |
| **Shrimp fajitas with corn tortillas** | 1 | 3420 | foods_json = entire restaurant meal. Library shortcut on "shrimp fajitas" returns 3420 — 9× too high. | ❌ JUNK — delete |
| **H-E-B Fajitas Chicken Thighs** | 1 | 214 | foods_json = [chicken 119 cal, Mexican corn salad 95 cal]. Named after first food. Shortcut returns 214 — 80% too high. | ❌ JUNK — delete |
| **Test smoke meal** | 1 | 100 | Explicit testing artifact, llm_estimated, score 0.0 | ❌ JUNK — delete |

**Recommended deletion list (5 entries):** Banana, Blueberries, Shrimp fajitas with corn tortillas, H-E-B Fajitas Chicken Thighs, Test smoke meal.

**One ambiguous case:** "Protein Shake A - Pre-Workout" has 3 re-logs and is a named recipe (Isopure + dextrose). It's a recipe-style entry — different from the junk pattern (named after first food but contains unrelated foods). I'd KEEP it but flag for Luke to confirm. The matching question (it didn't fast-path-hit "Protein shake with dextrose") is separate from the junk question.

**Awaiting V18+ confirmation before delete.** When confirmed, I'll execute via Supabase REST + service role and report back.

---

## 3 — Part C.1: does v2 need a redraft, or is this additive?

V18+'s lean is Option 3 (Sprint 1 first, redraft after). **I agree with Option 3 in principle but with a tighter Sprint 1 scope than V18+ proposed.**

The brief stated: "A.1 Promise.all, A.2 embedding matcher, A.4 Whisper hint, A.5 mixed-resolution, A.6 cache versioning, A.8 saved_meal_id column, B.1 cache bust fix, B.3 Whisper telemetry — all still right, all still ship."

**Push-back: A.2 / A.3 / A.6 / A.7 should NOT ship in Sprint 1.**

### Why hold A.2 (embedding matcher)

The MacroFactor empirical finding (Typesense, not embeddings) means the matcher choice is no longer obvious. Three real options:

1. **OpenAI text-embedding-3-small + in-memory cosine** (what V18+'s v2 proposed): 1536-dim vectors, ~50-200ms per parse for embedding the query, sub-millisecond cosine over 43-1000 entries. Cost: ~$0.02/M tokens. Quality: good for semantic similarity, less ideal for typos.
2. **Typesense self-hosted** (what MacroFactor uses): typo-tolerant BM25, sub-50ms, no embedding model. Free / self-hosted. Add a Typesense container to the Pantheon stack OR use Typesense Cloud (free tier ~$0). Quality: excellent for typos, plurals, partial matches; weaker on pure semantic ("Coke" vs "soda").
3. **Postgres trigram + tsvector** (the local-only option): pg_trgm + ts_rank inside Supabase. No new service. Sub-100ms over thousands of rows with proper indexes. Quality: comparable to Typesense for typos; worse for ranking quality on long strings.

**The right choice depends on what Sprint 1 measurement reveals.** Specifically:

- If Sprint 1 (Promise.all + Brick D mixed-res + B.1 cache fix) takes parses to ≤25s with library-shortcut hit rate jumping to ≥60%, the existing token-overlap matcher loosened from 0.85 → 0.7 might be enough for now. **Defer A.2 entirely.**
- If hit rate stays low because the matcher is the bottleneck, evaluate (1) vs (2) vs (3) with Luke's actual library, including how much of the gap is "matcher quality" vs "library coverage."
- If Luke is going to bulk-add hundreds-to-thousands of entries (BRICK PANTRY), Typesense's typo tolerance + scale becomes more compelling than embeddings.

**Risk of shipping A.2 in Sprint 1:** schema migration for `vector(1536)` column + embedding compute pipeline + threshold tuning, only to potentially throw away in favor of Typesense after Sprint 1 measurement. Wasted work.

**Right move:** Sprint 1 ships without A.2. Sprint 1 measurement informs matcher choice. Sprint 2 ships the matcher decision.

### Why hold A.3 (portion_confidence split)

Per the brief: "A.3 (portion_confidence split) gets reframed. It becomes input to a real editor (BRICK PLATE), not the user-visible UX itself."

If A.3 is data-only (no UI consumer), shipping it now adds a database column that nobody reads. The LLM emits the structured field; it sits in `claude_parse_json` until BRICK PLATE renders it.

**Right move:** ship A.3 with BRICK PLATE in v3, not in Sprint 1. Avoids decoupling that buys nothing.

### Why hold A.6 (cache versioning) and A.7 (deterministic portion_confidence override)

A.6 only matters if the cache schema is changing. If A.3 holds, cache schema doesn't change, A.6 has no work to do. A.7 only matters if portion_confidence ships. Hold both.

### Sprint 1 — what I'd ship

| Item | Scope | Risk |
|---|---|---|
| **A.1** Promise.all dispatcher | parse-meal-pipeline.ts ~30 lines | Low |
| **A.4** Whisper vocabulary hint + telemetry (B.3) | whisper/transcribe/route.ts + new lib/whisper/vocab.ts | Low |
| **A.5** Brick D mixed-resolution fix | parse-meal-library-shortcut.ts | Low |
| **B.1** Response cache bust granularity | meals/log/route.ts:153-155 (only bust on `'created'`, not `'incremented'`) | Low |
| **A.8** Add `saved_meal_id` column to food_log_entries | new migration + meals/log write path | Low |
| **B.2 fix** Auto-promote semantics — only auto-promote when `foods.length === 1` | meals/log/route.ts:80-134 | Medium (product decision) |
| **Junk cleanup** Delete 5 confirmed junk saved_meals | Supabase service-role REST | Low |

**One Vercel deploy. Zero EAS builds.** All web-side. Empirically measurable via the historical-telemetry replay spine from my prior review.

### Held for v3 redraft (after Sprint 1 measurement)

- A.2 matcher choice (embedding vs Typesense vs trigram — pick after data)
- A.3 portion_confidence split (with BRICK PLATE)
- A.6 cache versioning (with A.3)
- A.7 deterministic portion_confidence override (with A.3)
- BRICK PLATE — portion editor with unit picker
- BRICK PANTRY — database bulk-load + unit_alternatives data layer
- BRICK SPLIT — per-food data model migration (3-4 sessions)
- Streaming response path (depends on BRICK SPLIT)

---

## 4 — Part C.2: data-model shift makes sense?

Yes, but **stage it.** Not all-at-once.

The MacroFactor empirical evidence is clear: per-food rows enable streaming UI, independent edit, unit alternatives, accurate library re-use. All of that is what Luke responded to. Pantheon's composite `foods_json` was a reasonable choice for the LLM-tool-loop architecture but is wrong for the streaming/per-food architecture Luke now wants.

**But the migration is 3-4 sessions and touches 19 files** (15 web + 4 native). That's a real cost. Don't do it before measuring whether Sprint 1's per-meal latency wins close the felt-experience gap to "acceptable" without the data-model change.

**Hybrid that DOES make sense before BRICK SPLIT:**

Keep `food_log_entries.foods_json` as the storage, but:

- Render per-food rows in the native UI (TodayLog already kind of does this — line 72 maps food names; just expand to per-food cards)
- Make the edit screen render one card per food (already happens — `editFoods.map` in `app/edit-food/[id].tsx:465`)
- Add per-food edit affordances inside the existing composite-row context

This gives ~70% of the "feels per-food" UX without the schema migration. BRICK SPLIT becomes optional polish, not load-bearing.

The thing the hybrid DOESN'T enable is **streaming.** Streaming requires per-food writes during the parse. Pantheon's current shape is one big write at the end. Streaming pushes the SSE/chunked-response architecture and per-food semantics together.

**My recommendation: ship the hybrid in v3 (per-food UI on composite storage). Defer streaming + true BRICK SPLIT until after the hybrid measures well.** Don't conflate "feels like per-food" with "actually is per-food."

---

## 5 — Part C.3: database strategy + matcher size question

### When does in-memory cosine break?

text-embedding-3-small: 1536 floats × 4 bytes = 6 KB per vector. Math:

| Library size | Memory for embeddings |
|---|---|
| 100 | 600 KB |
| 1,000 | 6 MB |
| 10,000 | 60 MB |
| 100,000 | 600 MB |
| 1,000,000 | 6 GB |

Vercel functions default to 1024 MB. **Comfortable up to ~50K entries; uncomfortable above 100K.**

If Luke bulk-adds aggressively (hundreds per week), he hits 10K in 6 months and 50K in 1-2 years. **pgvector becomes load-bearing somewhere in 6-18 months.**

**But this calculation assumes embeddings.** If we pick Typesense or Postgres trigram, the memory math is different (Typesense indexes everything externally; Postgres trigram is index-on-disk). Both scale to millions without architectural change.

**Real recommendation:** the embedding-vs-Typesense decision is more about quality + ops than memory. Memory is a non-issue at Pantheon's near-term scale regardless.

### Bulk-import sources for unit conversion data

For BRICK PANTRY's unit_alternatives data:

- **USDA FoodData Central `food_portions`** — partial coverage. Some foods have it (apples, bananas, common produce), most don't. Free, accessible via existing USDA API.
- **Open Food Facts `serving_quantity` + `serving_size`** — single-value, not multi-unit alternatives. Free.
- **NCC** — comprehensive, gold standard. Licensed, $1500+/year.
- **USDA SR Legacy `food_portions`** — better coverage on whole foods than FNDDS. Free.
- **LLM-fill** — generate plausible alternatives from food name + category. Cheap, imperfect, needs confidence labels.
- **User-correction loop** — every time Luke edits qty/unit in BRICK PLATE and the food doesn't have that unit, persist `{unit, grams}` to the food's unit_alternatives. Library grows organically from real use.

**My recommendation for BRICK PANTRY:** combination of USDA food_portions (free import for staples) + LLM-fill (cheap baseline) + user-correction loop (long-term quality). NCC license is overkill at single-user scale.

---

## 6 — Recommendation

**Option 3 with tighter Sprint 1.** Specifically:

### Sprint 1 (web-only, single Vercel deploy, no EAS)

Ship: A.1 + A.4 + A.5 + B.1 + A.8 + B.2 fix + B.3 + junk cleanup. ~7 changes, all surgical, all measurable.

Expected outcome:
- Multi-item parse latency: 60s → 20-30s
- Single-item library-hit latency: 11s → 200ms-1s (depending on whether the loosened token-overlap matcher hits)
- Library shortcut hit rate over a session: 0% → 40-60%
- Response cache repeat-hit on identical re-logs: 0% → 80%+
- 5 junk library entries removed; future multi-item logs no longer auto-promote

### Pre-v3 measurement

Run the historical-telemetry replay (the script I described in the prior review) against the new pipeline. Specifically measure:

- Distributional latency on Luke's last 30 days of utterances (median + p95)
- Library shortcut hit rate per parse vs. per session
- Response cache hit rate
- Whisper transcription accuracy on the previously-failing brand-name cases

### v3 redraft (after measurement)

Drafted by V18+ with empirical results in hand. Likely scope:
- A.2 matcher decision (embedding vs Typesense vs trigram — picked from data, not theory)
- BRICK PLATE — portion editor (depends on A.3 + unit_alternatives data)
- BRICK PANTRY — database bulk-load (sequenced before BRICK PLATE for the data layer)
- BRICK SPLIT — per-food data model OR hybrid (per-food UI on composite storage)
- Streaming response — only if BRICK SPLIT ships

### What this avoids

- Locking into embeddings before evaluating Typesense/trigram
- Shipping A.3 with no UI consumer (premature schema)
- Doing 3-4 sessions of BRICK SPLIT migration before knowing if Sprint 1 closed the perceived-latency gap
- Investing in unit_alternatives data layer before BRICK PLATE has a UI to consume it

---

## 7 — Status / docket

**At bat:** This review. V18+ to redraft v3 if my framing lands.

**On deck (after v3 lock + EXECUTE):** Sprint 1 — A.1 + A.4 + A.5 + B.1 + A.8 + B.2 fix + B.3 + junk cleanup.

**In the hole:** v3 redraft based on Sprint 1 measurement. Matcher decision + BRICK PLATE + BRICK PANTRY scoping.

**Future docket:** BRICK SPLIT (per-food data model — 3-4 session migration), streaming response, real-time impact rings, NCC license evaluation if Luke wants to compete on micronutrient depth.

**Open data deletes pending V18+ confirmation:** Banana, Blueberries, Shrimp fajitas with corn tortillas, H-E-B Fajitas Chicken Thighs, Test smoke meal. 5 saved_meals. Surface deletion command on confirmation; not running this turn.

**Operation Fast Track holds the name.** Per Luke 2026-05-07.

---

## 8 — Sources

- `sjawhar/macrofactor` MCP server (via lobehub.com/mcp/sjawhar-macrofactor) — reverse-engineered API surface
- macrofactor.com/new-food-logger/ — "fastest food logging workflows" announcement
- macrofactor.com/mm-january-2022/ — in-house food database announcement
- help.macrofactorapp.com/en/articles/46-food-search-database — multi-unit auto-conversion, 1.36M-item database size
- macrofactor.com/ai-food-logging/ — "several LLM prompts in tandem," streaming behavior
- typesense.org — referenced as their search engine

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_S27_OPERATION_FAST_TRACK_V2_VS_V3_INFLECTION.md
