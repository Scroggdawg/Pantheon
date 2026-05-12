# PANTHEON — Operation Fast Track, Phase 0 Proposal Review

**Date:** 2026-05-07
**Author:** Terminal Claude
**Recipient:** V18+ Chat Claude
**Mode:** Review of V18+'s Phase 0 proposal. No code, no edits. Same posture as recon — empirical reads over conceptual reasoning.
**Per Luke:** This is **Operation Fast Track**. Ignore the "Daily Driver" naming in the proposal draft.

---

## 0 — TL;DR

The proposal is structurally sound. Workstream A is the right surgical scope. But review surfaced two empirical findings that materially change Workstream B and the sequencing.

**Two findings that need to land before EXECUTE:**

1. **B.2 is mis-scoped and is a Phase 0 blocker, not a parallel investigation.** I traced the 3420-cal "Shrimp fajitas" entry and it's not a SaveMealModal multiplication bug. It's the **auto-promote-on-every-log** behavior at `app/api/meals/log/route.ts:110-126` taking `name = foods[0].name` (first item) but `total_calories = body.total_calories` (sum of ALL items). Every multi-item parse where `library_source_ref` is null currently creates a junk saved_meal. **A.2's loosened thresholds will start firing shortcut hits against these junk entries.** Must be fixed before A.2 ships, and the fix is a product decision, not a patch.

2. **B.1 isn't an investigation — it's a confirmed design bug.** `app/api/meals/log/route.ts:154` calls `bustResponseCacheForUser` on EVERY meal log (whenever `savedMealAction !== 'none'`, which is always under current auto-promote semantics). Response cache lifespan is "until the user's next meal log" — usually seconds. The 90-day TTL is meaningless. The cache cannot ever provide a hit on repeat utterances by design. Fix is straightforward but the diagnosis is closed.

**One sequencing fact V18+'s proposal coordinates around:**

3. **OTA / expo-updates is NOT wired** in pantheon-native (verified: no `expo-updates` in package.json or app.json). EAS builds remain 3-4 hours per the access doc. Native changes for A.3 + any B.2 native UI must be bundled into one EAS build. This is what V18+ already assumed in the dependencies list — confirming.

**Net recommendation:** Proposal proceeds as written for Workstream A.1 + A.4 + A.5. B.1 + B.2 promote to Phase 0a blockers (web-side fixes that ship before A.2). A.2 + A.3 sequence behind those. Add A.6 + A.7 + A.8 from §4 below. Measurement spine is replay-against-historical-telemetry (§6).

---

## 1 — P0.1: architectural calls

### A.1 (Promise.all dispatcher) — sound, with subtleties

The change is local and the win is real. But four subtleties V18+'s framing didn't name explicitly:

**Mixed tool_use + text blocks in one assistant turn.** Per the existing loop in `parse-meal-pipeline.ts:268-303`, an assistant turn can contain BOTH `tool_use` blocks AND `text` blocks. The current code processes each in order, accumulating `finalText` for text blocks while awaiting tool_use blocks. Under Promise.all you have to: extract tool_use blocks separately, await them in parallel, then assemble tool_results in the same order they appeared in `resp.content`. Text blocks need to be handled separately (they're not awaitable). Trivial but easy to flatten by accident.

**Per-call timing for telemetry must be inside each promise.** Currently `t0 = Date.now()` is per-iteration of the for-loop. With Promise.all, if you measure `t0` once before the parallel dispatch, every call's reported `duration_ms` is wrong. The fix is each task captures its own start/end; the telemetry log gets accurate per-call durations.

**Error isolation must be preserved.** The existing dispatcher catches inside the try/catch and returns `{error: "..."}` to the LLM. If A.1 introduces `Promise.all` over raw promises, a single rejection kills the entire iter. Either: keep each task wrapped in try/catch returning `{error}` (recommended; matches existing semantics) OR use `Promise.allSettled` and handle rejected results explicitly. Easy to get this wrong.

**USDA rate-limit risk.** Five tool_use blocks fanning out → five concurrent USDA HTTP requests. USDA's API rate limit on the free tier is 1000 req/hour, ~3.6 req/s sustained. Pantheon's volume is far below that ceiling, but a multi-item parse could burst 10-15 calls in a second. Likely fine. Worth one empirical check after A.1 ships — surface USDA 429 errors in the existing tool result if they happen.

**Empirical check on the win size:** the screenshot meal had 22 tool calls / 6 iters = 3.7 avg per iter. So per-iter parallel dispatch saves ~2-3s, total ~12-18s. The 30-50% V18+ claimed is approximately right for multi-item. For single-item parses (Protein shake: 3 calls / 2 iters = 1.5 avg) the saving is 1-2s. The win scales with the case that matters most.

### A.2 (embedding matcher) — sound architecture, two important calls

**pgvector vs in-memory cosine — at Pantheon's scale, in-memory wins on simplicity.** Library is 43 entries today. Round-trip to Postgres + pgvector cosine similarity is ~30-50ms; in-memory cosine over 43 vectors is ~0.5ms. pgvector adds extension setup, SQL function authoring, indexing strategy, and a Postgres round trip per parse — none of which buy anything at this scale.

**But — store embeddings as `vector(1536)` column from day one.** That way the future migration to pgvector is a one-line query change (replace TS cosine_similarity with `ORDER BY embedding <=> $1`). If you store as `float8[]` or `jsonb` instead, you eat the migration later. No-brainer choice; just name it explicitly in the schema migration.

**Embedding cost is per-parse LATENCY, not just dollar cost.** OpenAI text-embedding-3-small is ~50-200ms per call. For multi-segment utterances under the segmented shortcut, that's 1 call per segment in parallel = ~100-300ms total. Real cost on cold misses (where we paid for embedding then fell through to LLM anyway). Mitigation: **cache embeddings by sha256(transcript) with 7-day TTL.** Repeat utterances → reuse the cached embedding. Pair this with the per-segment cache so segment-level embeddings get reused too.

**The aliases mechanism (`tags` column) is load-bearing and must be preserved.** The "3 eggs" saved_meal has `tags: ["three eggs", "3 large eggs", "eggs"]` — Luke's varied phrasings. The current matcher hashes name + aliases into one haystack. Embedding matcher must do the equivalent: either embed `name + " | " + aliases.join(" | ")` as one vector, OR embed each separately and take the max similarity. Simplest: concatenate. **A.2 must not regress the aliases capability.**

**brand-voice-aliases must run before embedding.** `lib/brand-voice-aliases.ts` does `applyBrandAliases("yes so bar") → "yasso bar"`. This currently runs inside `searchUserLibrary`. The embedding pipeline should apply alias substitution to the QUERY before embedding, otherwise voice-mangled brand names embed differently from the canonical brand and miss.

**Composite saved_meals — embed components or not?** The "Protein Shake A - Pre-Workout" saved_meal has `foods_json` listing components like "Isopure Low Carb Protein Powder - Chocolate." A user query "isopure shake" against the saved_meal's `name + tags` doesn't include "Isopure" and may miss. Two options: (a) embed name + tags only (simpler, matches current behavior), (b) also embed component names and aggregate similarity. Recommend (a) for v1, see if Luke's actual usage surfaces misses, add (b) if needed.

**Embedding model versioning.** Store `embedding_model_version: 'text-embedding-3-small'` on each row alongside the embedding vector. When OpenAI deprecates the model (it happens), the migration is "re-embed all rows with the new model, update the version field." Without versioning, you can't tell which rows are stale.

**Real risk V18+ underweighted: false positives.** Embeddings cluster semantically related foods. "Coke" vs "Pepsi" might score ~0.85. "Greek yogurt" vs "regular yogurt" might score ~0.90. If Luke has both in his library, the loosened thresholds (0.7 score, 0.10 gap) might surface the wrong one. Validate in shadow mode against Luke's actual library — log the score distribution for 1 session before flipping thresholds.

### A.3 (portion_confidence schema) — V18+'s shape is too vague

V18+ proposed `portion_confidence: {label, signals}`. The `signals` field is undefined and that's load-bearing for the native UI contract.

Better shape:

```typescript
portion_confidence: {
  label: 'high' | 'medium' | 'low'
  basis: 'user_specified_weight' | 'standard_serving' | 'estimated'
  estimated_grams: number | null    // populated when basis === 'estimated'
  source_text: string | null        // verbatim phrase from transcript: "1 cup", "4oz", "a small portion"
}
```

Why this matters:

**The native UI needs to know what to display.** The hint "Estimated 75g per churro — adjust if different" is the load-bearing UX, and it needs `estimated_grams: 75` to be displayed correctly. V18+'s `{label, signals}` doesn't capture this.

**The information is already in `notes`.** Per recon, the LLM emits `notes: "Estimated at 75g per churro (150g total)"`. The fix is to convert this from free-text to structured — moving the same data into typed fields. Don't make the LLM generate redundant info.

**Belt-and-suspenders defense (proposed as A.7 in §4 below):** if `unit ∈ {g, oz, lb, ml, kg}`, force portion_confidence.label = 'high' regardless of LLM output. The LLM might mis-label "4oz chicken" as low-confidence and that's strictly wrong. Deterministic override prevents UX regressions.

---

## 2 — P0.2: sequencing — pushback on dependencies

### Confirmed: OTA NOT wired

`grep -E 'expo-updates|EAS Update|fetchUpdateAsync' package.json app.json` in pantheon-native returns nothing. Per access doc, EAS builds run ~3-4 hours. So:

- A.3 native UI change costs one EAS build cycle
- B.2 fix MIGHT cost another EAS build (if any portion lands native-side)
- Bundle them ruthlessly

### Sequencing dependency V18+ missed

**A.4 (Whisper hint) depends on a vocabulary source.** The proposal says "ranked by recency + library presence, capped at 224 tokens." That requires a Supabase query per Whisper call (saved_meals + products names + recent food_log_entries). Adds ~50-100ms to transcribe. Net win since transcribe is already 1-3s, but name the dependency:

- A.4 needs: a function that builds the vocabulary string deterministically (token-count brand+name strings, greedy-include in order of `last_logged_at desc, then times_logged desc, then alphabetical`, stop at 224).
- Could ship as a self-contained utility in `lib/whisper/vocab.ts`, called from `app/api/whisper/transcribe/route.ts`.

**A.3 schema + LLM prompt + native UI must ship coupled.** If the schema lands web-side first, every parse generates `portion_confidence: null` until the LLM prompt is updated. If the LLM prompt updates first, the schema rejects the new fields. Sequence them in one Vercel deploy. Then native UI ships in the next EAS build.

### My recommended sequence (replaces V18+'s P0.2 list)

**Sprint 1 — web only, single Vercel deploy.** Independent + low risk + immediately measurable.
- A.1: Promise.all dispatcher
- A.4: Whisper vocabulary hint (depends on vocab utility, ship in same deploy)
- A.5: Brick D mixed-resolution fix
- B.3: Whisper telemetry capture (audio_duration_ms, whisper_latency_ms)
- B.1 fix: response cache bust granularity (only bust when meaningful, not on every log)

**Pre-Sprint 2 BLOCKER — fix B.2.** Don't ship A.2 until library entries aren't being polluted on every log. The auto-promote scoping bug needs a product decision (see §3 below). This may be web-only or web + native; depends on the chosen fix.

**Sprint 2 — web only, second Vercel deploy.** A.2 in shadow mode.
- A.2 schema migration: `embedding vector(1536)`, `embedding_model_version text` on saved_meals + products
- Lazy embedding compute on read for any row missing one
- Shadow-mode logging: compute scores, log them as `embedding_score_shadow`, do NOT gate on them
- Run for 1 session of real Luke utterances; measure score distribution

**Sprint 3 — web only, third Vercel deploy.** A.2 gated mode.
- Flip A.2 from shadow to gated based on shadow-mode findings (calibrate score + gap thresholds)
- Drop the existing token-overlap matcher entirely (or keep as fallback for cold-start when embedding API fails)

**Sprint 4 — web + EAS, single coordinated deploy.** A.3 ships.
- Web: schema migration + LLM prompt change in one deploy
- Native: portion_confidence display in EditModal in one EAS build
- Bundle B.2 native-side fix here if any

**Total cost:** 4 web deploys + 1 EAS build. Each web deploy is independently measurable via the persisted `_telemetry`.

**B.1 ships in Sprint 1 because it's web-only and prerequisite to measuring A.1's actual impact** (otherwise repeat-parse latency stays 60s because cache won't hit).

---

## 3 — P0.3: Workstream B scoping — re-scope based on findings

### B.1 — confirmed design bug, fold into Sprint 1

Read `app/api/meals/log/route.ts:150-155`:

```typescript
// S26 Step 4e — bust user's parse-meal response cache when their
// library changes (saved_meals upsert). Best-effort; helper logs
// its own warnings on failure and does not throw.
if (savedMealAction !== 'none') {
  await bustResponseCacheForUser(supabase, body.user_id)
}
```

And `savedMealAction` is set:
- `'incremented'` when `library_source_ref` starts with `'lib:saved_meal:'`
- `'created'` when `library_source_ref` is null OR starts with `'lib:product:'`
- `'none'` otherwise

But the auto-promote logic (lines 80-134) ALWAYS hits one of the first two branches (the "else" at line 110 catches both null and product refs). So `savedMealAction` is **never** `'none'` in current production. **Every meal log busts the cache.**

This is straightforwardly broken-by-design. Fix options:
1. **Don't bust on increment** — only bust on creation of a new saved_meal (which actually changes library state). This preserves cache hits on repeat library-shortcut logs.
2. **Granular bust** — only bust cache entries whose response references the saved_meals row that changed. Requires keeping a reverse index, more complex.
3. **Time-windowed bust** — only bust entries written before the library change. Simpler than granular but partial.

Recommend (1) for v1 — minimal surface, big win, easy to verify.

**Fold into Sprint 1.** Web-only, ~10 lines of code, prerequisite to measuring A.1's impact on repeat-meal latency.

### B.2 — re-scoped as a Phase 0 BLOCKER

V18+'s phrasing was "SaveMealModal is summing all foods in the meal into the saved entry." That's wrong. There is no SaveMealModal interaction in this path. The bug is at `app/api/meals/log/route.ts:110-126`:

```typescript
} else if (noLibraryRef || isProductRef) {
  const { data: ins, error: insErr } = await supabase
    .from('saved_meals')
    .insert({
      user_id: body.user_id,
      name: body.foods[0]?.name ?? 'Untitled meal',  // ← FIRST food's name
      foods_json: body.foods,                         // ← ALL foods
      total_calories: body.total_calories,            // ← SUM of all foods
      total_protein_g: body.total_protein_g,
      total_carbs_g: body.total_carbs_g,
      total_fat_g: body.total_fat_g,
      times_logged: 1,
      last_logged_at: new Date().toISOString(),
      yield_servings: 1,
      is_staple: false,
      tags: [],
    })
```

So when Luke logged "Three shrimp fajitas + chips + guac + churros + chocolate sauce + whipped cream + 3 beers + 2 margaritas":
- `name` = `"Shrimp fajitas with corn tortillas"` (the first food)
- `total_calories` = `3420` (sum across ALL eight foods)
- `foods_json` = the entire meal

**The saved_meal "Shrimp fajitas with corn tortillas" actually contains the whole restaurant meal.** Same pattern explains "H-E-B Fajitas Chicken Thighs" (215 cal — happened to be a mostly-single-food parse, escaped the worst of it).

This isn't a multiplication bug. It's an **auto-promote semantics bug**. The auto-promote logic was designed for single-food cases (V15 H0 Q1 option c, "conditional auto-promote"); it's wrong for multi-item meals.

**Why this is a Phase 0 BLOCKER, not a parallel investigation:**

Today the library shortcut fires 0/4 because the matcher is too strict. After A.2 lands and the matcher loosens, the library shortcut starts firing more often. The first time it fires against the "Shrimp fajitas with corn tortillas" entry, it will return 3420 cal as a single-serving library hit. **That's a worse user experience than the current 60s parse.** We'd ship a regression.

**Fix options (need Luke's product call):**
1. **Don't auto-promote multi-item meals.** Only auto-promote when `body.foods.length === 1`. Multi-item meals require explicit Save Meal action. (My recommendation. Cleanest semantics.)
2. **Auto-promote per-food.** Create N saved_meals from one multi-item parse, named for each food. Pollutes the library faster, but each entry is correct.
3. **Auto-promote with first-food macros.** Save the first food only (name + qty + unit + macros), discard the rest. Library entries are accurate but the auto-promote captures less than the user logged.
4. **Auto-promote off entirely.** Make all saves explicit. Simplest, biggest UX change.

I recommend (1). Then surface "Save this whole meal as a recipe?" as an explicit CTA in the UI for multi-item logs — uses the existing Provisions recipe schema.

**Cleanup is ALSO required:** the existing junk saved_meals (Shrimp fajitas at 3420 cal, possibly H-E-B Fajitas Chicken Thighs depending on Luke's intent) need to be deleted or fixed. Otherwise A.2 still hits them.

**Fold into Sprint 1 if web-only.** If the fix touches native (e.g., adding a "Save as recipe" CTA), it bundles with Sprint 4.

### B.3 — fold into A.4

V18+ already framed it as "load-bearing for measuring whether A.4 actually improved transcription quality." Right call. Bundle into Sprint 1.

---

## 4 — P0.6: what's missing — proposal additions

### A.6 — Cache version bumping on schema change

Per A.3, the cache stores full ParsedMealResponse for 90 days. If we ship A.3's new fields and a previously-cached parse comes back without `portion_confidence`, the native UI may break or behave unexpectedly. Worse: if we ship a buggy parse, the bug stays cached for 90 days.

Add `schema_version: string` to `parse_meal_response_cache`. On lookup, only return rows matching the current schema version. On schema change, bump the constant and old rows age out naturally. Trivial code. Massive insurance.

### A.7 — Force portion_confidence: high when unit is weight-based

If `food.unit ∈ {'g', 'gram', 'grams', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds', 'ml', 'kg'}`, override `portion_confidence.label` to `'high'` regardless of LLM output. Reason: the LLM might mis-label "4oz chicken" as low-confidence (it's been confused before by similar prompts in my recon experience), and that's strictly wrong. Deterministic override prevents UX regressions where a user's explicit weight gets flagged as estimated.

Same idea applies to numeric serving descriptors when explicitly stated ("100g," "200ml"). The deterministic check on `unit` field is the simplest implementation.

### A.8 — Add saved_meal_id column to food_log_entries

Verified: `food_log_entries.saved_meal_id` does not exist. The linkage from a logged meal to its source saved_meal is indirect (via `library_source_ref` in the request payload + saved_meal_id in the response). **There's no stored audit trail of "which library entry this log came from."**

This is a real observability gap. We can't accurately measure "library re-use rate" or "shortcut hit rate" over time without it. Trivial migration: add nullable UUID column, populate from `body.library_source_ref` parsing in the meals/log route.

Sprint 1 candidate. Cheap. Prerequisite to clean post-deploy measurement.

### B.4 — Compensation rollback failure can lose user data

`app/api/meals/log/route.ts:135-148`: if the saved_meals step fails, the route DELETEs the food_log_entries row to "roll back." If the auto-promote scoping bug surfaces (e.g., name too long for a varchar, foods_json malformed), the user's log silently disappears.

Lower-priority than B.1+B.2 but worth flagging as a follow-on brick after B.2 fixes the auto-promote semantics. The compensation pattern itself is fine; the issue is that auto-promote currently failing should not lose user data — the food_log_entries insert succeeded, the user's data is captured, and "couldn't update sidecar saved_meals" shouldn't trigger compensation.

---

## 5 — P0.5: risks — pushback

### V18+'s three named risks — my reads

**"Am I underestimating embedding-matcher complexity?"** Yes, slightly. Named in §1.A.2 above: per-parse latency cost, alias preservation, brand-voice-aliases, model versioning, false positives on semantically-similar foods. Not blockers; just things to design for explicitly.

**"Am I overestimating the Promise.all win?"** Approximately right for multi-item, modest for single-item. Named in §1.A.1 above. Real concern: if most iters in practice emit 1-2 calls (not 3.7), the win shrinks. Historical telemetry replay (§6) tells us the actual distribution.

**"Is portion_confidence: low surfaceable in native UI without a bigger design conversation?"** Probably yes, the existing FoodEntryEditModal is already the right surface — the affordance is just visual treatment of the qty/unit field plus a hint string. Whether Luke wants to greenlight the visual treatment specifically is a design question worth raising in the EXECUTE conversation, but it's not a blocker for proposal lock.

### Risks V18+ didn't name

**Cache poisoning by buggy parses.** 90-day TTL means a buggy schema change gets cached for 90 days. Solved by A.6 (cache versioning).

**Composite-foods getting saved as junk library entries.** Solved by B.2 promotion to Phase 0 blocker.

**Whisper hint 224-token cap.** V18+ said "ranked by recency + library presence, capped at 224 tokens." How exactly? Recommend explicit deterministic ranking: token-count each library entry's brand+name string, greedy-include in order of `last_logged_at desc, then times_logged desc, then alphabetical`. Stop when cumulative tokens hit 224.

**Whisper hint format.** OpenAI's `prompt` parameter is free-text, not structured JSON. The vocabulary list is space-separated terms in plain English. Empirically test that the hint actually moves the needle on a known-bad case (Spindrift, dos xx, Yerba Mate) — if it doesn't, fall back to phonetic alias mappings in transcript post-processing instead.

**`saved_meal_id` not stored on log entries.** Named as A.8. Limits our ability to measure A.2's impact post-deploy.

---

## 6 — P0.4: measurement design — V18+'s is too binary

V18+ proposed four single-utterance pass/fail tests. That's necessary but not sufficient. The right metric is distributional.

### The hidden gold: replay against historical telemetry

Per recon, every parse's `_telemetry` is persisted indefinitely in `food_log_entries.claude_parse_json._telemetry`. **We can replay measurement against historical utterances WITHOUT new voice notes.** The benchmark suite is essentially:

```
For each row in food_log_entries where created_at >= 2026-04-07:
  re-run row.raw_input_text through new pipeline
  capture new _telemetry.latency_ms
  diff against row.claude_parse_json._telemetry.latency_ms
Compute: median, p95, shortcut hit rate, cache hit rate
```

This is the measurement spine. Build it as a script in `scripts/` that runs against either prod or a preview deploy. ~50 lines of code. Becomes the regression suite for every future Operation Fast Track iteration.

### Proposed benchmark cases (additive to V18+'s four)

Beyond the four V18+ named (screenshot meal < 30s, protein shake < 500ms, cold-path no regression, churros portion_confidence: low), add:

1. **Response cache repeat-hit.** Parse same utterance twice in a row. Second one < 100ms. Validates B.1 fix.
2. **Mixed-resolution multi-item.** "Three eggs and a bagel from Einstein's." Eggs hit library, bagel falls through. Validates A.5.
3. **Voice-mangled brand.** A previously-failing transcription (Spindrift, Yerba Mate, dos xx). Validates A.4.
4. **Explicit weight utterance.** "4 ounces of chicken breast" → portion_confidence.label === 'high'. Validates A.7.
5. **Multi-segment library hits.** "Two eggs and a protein shake." Both segments should hit library → segmented shortcut. Validates A.5 + A.2 together.

### Distributional targets (replace single-utterance pass/fail)

- **Median latency:** 60s → ≤ 25s on multi-item. 11s → ≤ 1s on single-item library-hit.
- **p95 latency:** define by replay; today probably ~70s; target ≤ 35s.
- **Library shortcut hit rate over a 5-meal session:** today 0/5; target ≥ 3/5 (60%+).
- **Response cache hit rate over 5 logs of same meal:** today 0/5; target ≥ 4/5 (after first parse).
- **Portion-size confidence accuracy:** validated subjectively by Luke on 10 recent parses — does the `low` label fire when it should?

---

## 7 — P0.6: anything in scope that should be cut

Nothing material. The proposal is appropriately scoped. If Luke wants to ship faster, the scalpel order I'd recommend:

- **Most impact per session:** A.1 + A.4 + A.5 + B.1 fix in Sprint 1. Solves most of the "60s parse" complaint without any new architecture.
- **Highest-quality return on next session:** B.2 fix + A.2 shadow mode in Sprint 2. Makes the cascade actually work as designed.
- **Lower-priority polish:** A.3 + A.7. UX-quality fix; nice but not blocking.

If Luke wants to ship Sprint 1 alone first and decide whether to continue: that's a reasonable call. Sprint 1 likely takes 60s parses to ~25-30s and dissolves the response-cache emptiness. Most of the user-visible pain.

---

## 8 — Status / docket

**At bat:** This review. V18+ to fold pushback into a v2 of the proposal, then take to Luke for EXECUTE.

**On deck (after EXECUTE):** Sprint 1 — A.1 + A.4 + A.5 + B.1 fix + B.3 telemetry + A.8 saved_meal_id column. Single Vercel deploy, all web-side. Empirically measurable via historical-telemetry replay (§6).

**In the hole:** Sprint 2 (A.2 shadow mode + B.2 product decision + fix), Sprint 3 (A.2 gated), Sprint 4 (A.3 + A.6 + A.7).

**Future docket:** B.4 (compensation rollback), C.1-C.5 from V18+'s proposal, plus the embedding-matcher false-positive validation work that surfaces from A.2 shadow-mode logs.

**Operation Fast Track holds the name.** Not Daily Driver. Per Luke 2026-05-07.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_S27_OPERATION_FAST_TRACK_PHASE_0_REVIEW.md
