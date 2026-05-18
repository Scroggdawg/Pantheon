# Pantheon S28 Quartermaster Buildout Plan 1

Date: 2026-05-18
Status: Planning document for the Quartermaster lightning round.

## North Star

Quartermaster is Pantheon's feedback-analysis and dispatch layer.

Its job is not to guess what should be true. Its job is to watch what actually happened:

- what Luke said or typed;
- what Pantheon parsed;
- what Luke saved, edited, retried, abandoned, or complained about;
- how long the parse took;
- which parser path handled it;
- whether the result came from pantry, saved meals, history, LLM/tool search, cache, or a stale identity;
- whether the system made the same mistake more than once.

Then Quartermaster turns that evidence into concrete work:

- alias adds;
- rejections;
- pantry/product adds;
- saved-meal repairs;
- parser shortcut improvements;
- unit-conversion fixes;
- stale reference cleanup;
- review packets;
- ignore/joke/no-action classifications.

Luke's product doctrine:

> User experience feedback is the Bible. Watch users.

Quartermaster exists to make that doctrine executable.

## Working Model

Pantry Forge grows the library.

Quartermaster studies real use and decides what the library, parser, saved-meal layer, and UX need next.

The two systems should eventually become a loop:

1. User logs food.
2. Parser returns result.
3. User behavior creates evidence.
4. Quartermaster audits the evidence.
5. Quartermaster routes findings to the right lane.
6. Pantry Forge / parser / saved-meal repair / UX changes improve the next log.
7. Quartermaster measures whether the fix worked.

## Existing Surfaces To Use

Primary truth tables:

- `food_log_entries`
- `saved_meals`
- `products`
- `food_identity_aliases`
- `food_identity_rejections`
- `pantry_import_runs`
- `pantry_import_candidates`
- `parse_meal_response_cache`
- `food_query_cache`

Important fields:

- `food_log_entries.raw_input_text`
- `food_log_entries.foods_json`
- `food_log_entries.claude_parse_json`
- `food_log_entries.claude_parse_json._telemetry`
- `food_log_entries.log_method`
- `food_log_entries.saved_meal_id`
- per-food `source`
- per-food `source_ref`
- per-food `match_confidence`
- per-food `unit_alternatives`
- saved meal `foods_json`, totals, `times_logged`, `last_logged_at`
- product provenance fields

Existing scripts to borrow from:

- `scripts/replay-parse.ts`
- `scripts/report-pantry-lightning-status.ts`
- `scripts/report-instacart-pantry-coverage.ts`
- `scripts/verify-pantry-governance.ts`
- `scripts/apply-generic-pantry-aliases.ts`
- pantry builder/report scripts under `scripts/`

Existing code paths to inspect when findings point there:

- `app/api/claude/parse-meal/route.ts`
- `app/api/meals/log/route.ts`
- `lib/claude/parse-meal-library-shortcut.ts`
- `lib/claude/parse-meal-pipeline.ts`
- `lib/claude/tools/search-user-library.ts`
- `lib/claude/tools/search-food-database.ts`
- `lib/whisper/vocab.ts`
- native `app/log-food.tsx` and API bridge, when simulator testing is in scope.

## Non-Goals For The First Lightning Round

Do not start with an always-on autonomous agent.

Do not immediately write production mutations from Quartermaster.

Do not build a dashboard first.

Do not make Quartermaster "smart" before it can reliably extract evidence.

First goal: a high-trust read-only audit loop that produces actionable packets.

## Phase 0: Doctrine And Schema Discovery

Goal: make the tool honest about what evidence exists.

Deliverables:

- `docs/QUARTERMASTER.md`
- `scripts/quartermaster-audit.ts`
- internal TypeScript types for log rows, parse telemetry, foods, findings, and actions.

Discovery tasks:

- Query recent `food_log_entries` with parse telemetry.
- Detect what historical fields are consistently present.
- Detect how native saves edited parse results today.
- Determine whether we can infer user edits by comparing `claude_parse_json.foods` to saved `foods_json`.
- Determine whether abandoned parses are persisted anywhere. If not, mark native/server telemetry gap.
- Determine whether disambiguation choices are persisted anywhere. If not, mark telemetry gap.

Output should include:

- number of log rows inspected;
- rows with raw transcript;
- rows with telemetry;
- rows with parse-vs-save comparable foods;
- rows where edited save can be inferred;
- rows with stale refs;
- rows with low-confidence/parser-estimated foods;
- rows with slow parses;
- rows with cache/shortcut/LLM path classifications.

## Phase 1: Read-Only Quartermaster Audit

Goal: produce the first useful report from real user behavior.

Command shape:

```bash
npx tsx scripts/quartermaster-audit.ts --since=30d --limit=200
```

Optional flags:

```bash
--json
--markdown
--output=scripts/output/quartermaster-<run-id>.md
--include-foods
--min-severity=low|medium|high
--focus=latency|identity|units|coverage|edits|stale_refs|all
```

Read-only findings:

- `parse_slow`
- `llm_fallback_expensive`
- `library_shortcut_missed`
- `segmented_partial_missed`
- `response_cache_not_helping`
- `low_confidence_saved`
- `llm_estimated_saved`
- `database_estimated_saved`
- `source_ref_stale`
- `source_ref_chained`
- `saved_meal_total_suspicious`
- `saved_meal_identity_stale`
- `parse_saved_delta_calories`
- `parse_saved_delta_food_count`
- `parse_saved_name_changed`
- `parse_saved_unit_changed`
- `parse_saved_quantity_changed`
- `unit_missing_or_weak`
- `ambiguous_candidate_saved`
- `repeated_uncovered_phrase`
- `joke_or_non_food`

Report sections:

1. Executive summary.
2. Top user-impact issues.
3. Fast-path misses.
4. Identity/stale-ref issues.
5. Edit-inferred learning opportunities.
6. Pantry/product gaps.
7. Unit-conversion gaps.
8. Saved-meal issues.
9. Suggested next actions.
10. Data gaps Quartermaster cannot yet see.

## Phase 2: Evidence Classifiers

Goal: turn raw differences into reliable labels.

Classifiers:

- Transcript intent classifier:
  - normal food log;
  - macro/calorie question;
  - non-food joke;
  - unclear/noise;
  - product lookup;
  - saved-meal shortcut intent.

- Source quality classifier:
  - pantry exact;
  - saved-meal exact;
  - alias exact;
  - history/hourly only;
  - USDA/OFF exact;
  - database estimated;
  - LLM estimated;
  - user recited.

- Edit classifier:
  - accepted unchanged;
  - quantity corrected;
  - unit corrected;
  - food identity corrected;
  - macro/calorie corrected;
  - item deleted;
  - item added;
  - saved after parser uncertainty.

- Action classifier:
  - alias add;
  - rejection add;
  - pantry product add;
  - product unit add;
  - saved meal create/repair;
  - parser guard fix;
  - native telemetry gap;
  - ignore.

Important principle:

Quartermaster can say "unknown." Unknown is better than hallucinating a fix.

## Phase 3: Action Packets

Goal: make findings executable by future Codex/Pantheon agents.

Output files:

- `scripts/output/quartermaster-<run-id>.json`
- `scripts/output/quartermaster-<run-id>.md`

Optional committed summaries:

- `docs/handoffs/PANTHEON_S28_QUARTERMASTER_AUDIT_<n>.md`

Packet types:

- `alias_packet`
- `rejection_packet`
- `pantry_candidate_packet`
- `saved_meal_repair_packet`
- `parser_bug_packet`
- `unit_conversion_packet`
- `native_telemetry_packet`
- `ignore_packet`

Each packet should include:

- evidence rows;
- original transcript;
- parsed foods;
- saved foods;
- detected deltas;
- source refs;
- telemetry path;
- severity;
- confidence;
- proposed action;
- whether action is safe to apply automatically.

No automatic production writes in the first implementation.

## Phase 4: Replay And Before/After Measurement

Goal: make every fix measurable.

Use `scripts/replay-parse.ts` as the starting point, but Quartermaster should add:

- per-case issue labels;
- whether the current parse is better/worse than historical save;
- whether a specific previous finding is resolved;
- top recurring transcripts that should become golden fixtures;
- "regression risk" cases before parser edits.

Golden fixture plan:

- Generate `scripts/fixtures/quartermaster-golden-utterances.json`.
- Include protein shake variants.
- Include recurring Luke staples.
- Include known jokes/non-foods.
- Include high-risk unit phrases:
  - "six strawberries";
  - "fifteen grams";
  - "one bar";
  - "half carton";
  - "one bottle";
  - "one scoop";
  - "one and a half scoops";
  - "cup";
  - "ounce";
  - "serving".

## Phase 5: Telemetry Gaps

Goal: make invisible user behavior visible.

Likely missing events:

- parse opened but not saved;
- user edited item name;
- user edited quantity;
- user edited unit;
- user edited calories/macros;
- user selected a disambiguation candidate;
- user deleted a parsed item;
- user added an item after parse;
- user retried/reworded shortly after a bad parse;
- user canceled because result was useless;
- save failed;
- app displayed stale saved-meal FK or similar backend error;
- user used quick add after parse failure.

Recommended future table:

`food_log_events`

Possible columns:

- `id`
- `user_id`
- `session_id`
- `food_log_entry_id`
- `event_type`
- `raw_input_text`
- `payload`
- `created_at`
- `client_platform`
- `app_version`

Event types:

- `parse_requested`
- `parse_returned`
- `parse_failed`
- `parse_abandoned`
- `food_item_edited`
- `food_item_deleted`
- `food_item_added`
- `disambiguation_selected`
- `save_requested`
- `save_succeeded`
- `save_failed`
- `quick_add_after_parse`
- `retry_after_parse`

Do not add this migration in the first pass unless Luke explicitly scopes it. First pass should document the gap and prove value with current logs.

## Phase 6: Controlled Write Lanes

Goal: let Quartermaster eventually repair safe issues.

Write lanes, in increasing risk:

1. Add read-only docs/report only.
2. Generate local action packets only.
3. Apply exact aliases to existing product/saved-meal targets.
4. Apply rejections for known bad source refs.
5. Add unit alternatives when source is USDA/OFF/standard and exact.
6. Repair saved meals with explicit approval.
7. Add pantry products through existing Pantry Forge governance.
8. Add migrations/telemetry events.

Default lightning-round stance:

- Phases 0-4 are green.
- Phase 5 is planning only unless approved.
- Phase 6 writes need separate user confirmation except docs and local output.

## Phase 7: Simulator And Native UX Validation

Goal: test how fixes land for Luke.

Use Expo/simulator for:

- parse latency perception;
- protein shake logging;
- common phrase logging;
- disambiguation surfaces;
- edit flows;
- save success/failure;
- whether native sends usable payloads for Quartermaster.

Do not run EAS build/update/submit without explicit scope.

Once input automation is available:

- script common logs;
- compare screenshots/results;
- collect timings;
- verify repeat logs hit fast paths.

## First Lightning Round Work Plan

Target duration: long block, roughly 4-6 hours if uninterrupted.

Step 1: Build read-only audit skeleton.

- Load env.
- Connect Supabase service role.
- Query recent food logs.
- Normalize parse/saved food rows.
- Extract telemetry path.
- Emit summary counts.

Step 2: Add parse-vs-save diffing.

- Match foods by normalized name/source_ref/order.
- Detect calories/macros/qty/unit/name deltas.
- Flag large deltas.
- Preserve uncertainty.

Step 3: Add identity/source-ref checks.

- Detect stale `lib:saved_meal:*`.
- Detect missing live target for saved meal refs.
- Detect chained refs.
- Detect history/hourly refs leaking as durable identities.
- Detect deleted/stale names like old protein shake identities if present.

Step 4: Add latency and path analysis.

- Bucket cache, shortcut, segmented full, segmented partial, candidates, LLM.
- Highlight slow rows and recurring slow phrases.
- Identify fast-path misses where the saved result now exists in library.

Step 5: Add action packet generation.

- Produce JSON + markdown under `scripts/output/`.
- Group findings by action lane.
- Rank by severity and frequency.

Step 6: Create first Quartermaster handoff.

- Summarize real findings.
- Recommend the next repair batch.
- Explicitly list no-action/joke rows if detected.

Step 7: Run verification.

- `npm run typecheck`
- `npm run lint`
- `npx tsx scripts/verify-pantry-governance.ts`
- a limited Quartermaster smoke run.

Step 8: Commit and push if clean.

## Success Criteria For First Version

Quartermaster v0 is successful if it can answer:

- How many recent logs did Pantheon parse?
- Which logs were slow?
- Which logs used LLM fallback?
- Which logs likely got edited before save?
- Which parser outputs were accepted unchanged?
- Which foods were saved from weak sources?
- Which phrases recur but lack pantry/saved-meal support?
- Which stale refs or identity bugs exist?
- Which issues should become aliases, rejections, pantry adds, saved-meal repairs, parser fixes, or no-action?

It does not need to automatically fix everything.

## Questions For Luke

These are useful but not blockers for the first read-only lightning round:

1. Should Quartermaster treat a saved log with manual edits as "user correction" even when we cannot see the exact edit gesture?
2. Is it okay for Quartermaster reports to quote recent raw food transcripts in local markdown under `scripts/output/` and summarized handoffs?
3. Do you want a "joke/non-food" lane explicitly named that way, or a more clinical label like `non_food_or_intent_mismatch`?
4. For the first write-enabled version, should alias/rejection applies require explicit approval every time, or can we auto-apply high-confidence fixes after one read-only report cycle?

## Default Answers If Luke Is Busy

Assume:

- Yes, infer edits from parse-vs-save differences, but mark them inferred.
- Yes, local reports may include transcripts because they stay on Hive unless committed.
- Use `non_food_or_intent_mismatch` in data and plain English in markdown.
- Keep all Quartermaster writes manual until the first report proves its judgment.

