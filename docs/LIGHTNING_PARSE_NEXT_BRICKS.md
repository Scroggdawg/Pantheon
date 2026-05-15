# Lightning Parse Next Bricks

Date: 2026-05-15
Status: Proposed next execution batch after LP-0 through LP-9.
Scope: Web parser/backend first, native Plate only where needed.

This document scopes the next set of bricks after the autonomous LP-0 through LP-9 build. It can be changed when evidence justifies a better order, but changes should name the reason: new replay data, product priority, data risk, native constraint, or a better architecture discovery.

## ELI5 Version

Pantheon just got a new brain map.

It can now:

- split meals into pieces,
- search for known foods very fast,
- say when it is unsure,
- propose what the pantry is missing,
- and prepare for streaming Plate results later.

But some shelves are still empty. If Luke says "chips with guacamole," Pantheon knows that is two foods, but it does not yet have a strong canonical "restaurant tortilla chips" entry. If Luke says "dos xx," Pantheon knows that should be Dos Equis, but the pantry does not have the right beer identity yet.

So the next work is:

1. Fill the pantry holes.
2. Teach the parser to use the new search-first resolver in real parse flow.
3. Add the fast planner only for the uncertain middle cases.
4. Let Plate edits become learning proposals.
5. Measure everything against the 5-second target.

Plain English: first give Pantheon better food cards, then let it deal those cards fast.

## Current Starting Point

Completed:

- LP-0 telemetry/replay harness.
- LP-1 canonical identity spec.
- LP-2 identity search proof.
- LP-3 safer segmenter and overmatch guards.
- LP-4 inactive search-first resolver proof.
- LP-5 inactive fast planner contract.
- LP-6 correction learning proposal engine.
- LP-7 read-only data coverage report.
- LP-8 approval-required librarian task proposals.
- LP-9 streaming Plate event protocol.

Important current finding:

- Identity search is fast enough locally: millisecond-level after docs are built.
- The biggest immediate blockers are coverage and activation, not raw search latency.

Current high-priority coverage gaps:

- `chips`
- `dos xx`
- `stevia hazelnut liquid`

Medium-priority coverage gaps:

- `bacon`
- `chocolate sauce`
- `coffee`
- `guacamole`
- `half half half`
- `protein shake dextrose`

Lower-priority but important:

- `margaritas`

## Operating Rules

Use the existing Codex Fast Track autonomy:

- **Green:** implement, verify, commit, push.
- **Yellow:** implement, verify, commit, push, but do not activate protected production effects.
- **Red:** ask before touching.

Production Supabase writes remain Red unless Luke explicitly approves the exact mutation.

## Brick LP-10: Pantry Gap Approval Packet

Classification: Green for doc/script, Red for live writes.

Goal: turn LP-7 and LP-8 into an approval-ready packet Luke can inspect.

Why this comes first:

The search-first resolver already sees the shape of the meal, but missing canonical foods make it return review/fallback items. Coverage first makes later route activation less ugly.

Tasks:

- Generate a human-readable pantry gap packet from current coverage gaps.
- Include proposed food names, aliases, default units, and why each row matters.
- Separate safe defaults from product calls.
- Include exact Supabase/product fields that would be written later.
- Include a dry-run JSON artifact if useful.

Acceptance:

- Luke can approve, edit, or reject each proposed pantry addition.
- No production data is mutated.

Likely outputs:

- `docs/LIGHTNING_PARSE_PANTRY_GAP_PACKET.md`
- Optional `scripts/output/pantry-gap-proposals.json` if repo patterns support generated artifacts.

Stop conditions:

- If a proposed row would require uncertain macros where a wrong default would be worse than fallback, mark it for user/product review instead of pretending.

## Brick LP-11: Pantry Gap Apply Script

Classification: Yellow for script, Red for live execution.

Goal: prepare the exact write path for approved pantry additions.

Why this follows LP-10:

We should not write pantry data until the proposal set is reviewable. But once approved, writes should be boring, repeatable, and reversible.

Tasks:

- Add an idempotent script that reads approved proposal rows.
- Upsert products/aliases/unit alternatives only for approved rows.
- Print before/after diff.
- Support `--dry-run` as default.
- Require explicit `--apply` for live writes.
- Refuse to run apply without a clear approval file.

Acceptance:

- Dry-run prints the exact rows that would be written.
- Apply mode is impossible to trigger accidentally.
- Live execution remains Red until Luke approves.

Stop conditions:

- If schema lacks a clean alias/rejected-alias storage place, split data writes into product rows now and alias schema later.

## Brick LP-12: Alias And Rejected-Alias Storage

Classification: Yellow for migration/code, Red for applying migration.

Goal: give Pantheon a durable place to store identity-preserving aliases and "never match this phrase to that food" lessons.

Why this matters:

Right now aliases mostly live in code or tags. The future correction-learning system needs a real storage surface for:

- `dos xx` -> Dos Equis
- `coffee` must not become REBBL
- `chips` must not become a chocolate chip bar

Tasks:

- Choose minimal schema:
  - either additive columns on products/saved_meals,
  - or a separate `food_identity_aliases` table.
- Include rejected aliases or negative match rules.
- Add read-model support in `food-identity.ts`.
- Add invariant tests for accepted and rejected aliases.

Acceptance:

- Positive aliases improve recall.
- Rejected aliases prevent known wrong matches.
- No production migration is applied without approval.

Recommendation:

Prefer a separate table if rejected aliases need source phrase + target identity + reason. Prefer columns only if keeping this extremely small.

## Brick LP-13: Search-First Route Shadow Mode

Classification: Green if telemetry-only, no behavior change.

Goal: run the LP-4 search-first resolver alongside the current parse route and record what it would have done.

Why shadow mode:

Before changing live parse behavior, compare the resolver's draft against current output on real traffic. This gives us confidence without risking user-facing wrongness.

Tasks:

- In `/api/claude/parse-meal`, build identity docs and run `resolvePlateDraftFromIdentities` after cache lookup or in a safe side path.
- Do not return its result yet.
- Add `_telemetry.search_first_shadow` fields:
  - item count
  - fallback count
  - can skip expert LLM
  - resolver latency
  - outcome distribution
- Avoid storing bulky candidate payloads in telemetry.

Acceptance:

- Live response behavior is unchanged.
- Replay can report how often search-first would avoid expert fallback.
- Route latency increase is measured and acceptable.

Stop conditions:

- If identity doc build adds too much per-request latency, add caching or precomputed read-model before activation.

## Brick LP-14: Identity Document Cache

Classification: Green if in-process/cache-only; Yellow if persistent storage; Red if production infra.

Goal: make identity docs cheap enough for every parse.

Why this matters:

LP-2 proved search is fast, but building docs from Supabase can still cost hundreds of milliseconds to seconds depending on cache state. A sub-5-second parser can afford some setup, but not pointless repeated full reads.

Tasks:

- Add a small in-memory per-user identity-doc cache with TTL.
- Invalidate or bypass on explicit pantry/favorite changes where possible.
- Add telemetry for cache hit/miss and build latency.
- Keep the first version simple and safe for Vercel serverless reality.

Acceptance:

- Warm identity-doc build is near-zero app overhead.
- Cold build latency is visible.
- No stale cache can persist long enough to make correction testing confusing.

Stop conditions:

- If serverless lifecycle makes in-memory cache ineffective, consider Vercel Runtime Cache or Supabase-backed read model as a later brick.

## Brick LP-15: Search-First Partial Activation

Classification: Green if activation is guarded and replay-backed; Red if wrong-confident risk appears.

Goal: let the route return search-first Plate drafts for safe cases without expert LLM fallback.

Activation rule:

Only activate for cases where every item is one of:

- `resolved_high`
- `needs_choice`
- `needs_review`

Do not activate when any item is `fallback_required`.

Do not fast-save. Return an editable Plate response with pills.

Tasks:

- Convert `SearchFirstPlateDraft` into `ParsedMealResponse`.
- Map:
  - `resolved_high` -> high confidence food
  - `needs_choice` -> placeholder + disambiguation
  - `needs_review` -> low/medium confidence visible review
- Preserve existing native expectations.
- Add route telemetry:
  - `search_first_hit`
  - `search_first_outcomes`
  - `expert_llm_skipped`
- Add replay/golden tests.

Acceptance:

- Golden cases with no fallback return without expert LLM.
- Wrong-confident examples remain review/choose, not high.
- Native Plate still renders correctly.

Stop conditions:

- If native cannot represent the new response shape cleanly, pause and add native compatibility work first.

## Brick LP-16: Fast Planner Shadow Mode

Classification: Green if non-returning telemetry/probe; Red if live activation changes output without replay evidence.

Goal: run the LP-5 fast planner on uncertain search-first drafts and measure whether it can reduce expert fallback safely.

Why after LP-15:

The planner should help the uncertain middle, not replace deterministic search. It needs search-first candidates as input.

Tasks:

- Add a script or route shadow mode that calls `runFastPlanner` on selected golden/replay cases.
- Validate every plan with `validateFastPlannerPlan`.
- Report:
  - planner latency
  - invalid plan rate
  - fallback reduction
  - unsafe-action rejection count
- Do not return planner output live yet.

Acceptance:

- Planner latency is compatible with 5s target.
- Planner never invents candidate IDs in validated output.
- Planner reduces expert fallback in meaningful cases.

Stop conditions:

- If planner is slower or less reliable than expected, keep it as offline analysis and proceed with data coverage instead.

## Brick LP-17: Fast Planner Activation For Safe Middle Cases

Classification: Yellow/Red depending on live behavior risk.

Goal: use the fast planner in production only where it adds clear value.

Activation rule:

Planner may activate when:

- search-first produced candidates,
- no item requires external database lookup,
- validation passes,
- output maps to visible Plate review/choose/estimate states.

Planner must not:

- invent macros,
- invent source refs,
- auto-save uncertain food,
- override rejected aliases.

Acceptance:

- Harder utterances return editable Plate under 5 seconds when candidate context exists.
- Expert fallback rate drops without wrong-confident increase.

Stop conditions:

- Any wrong-confident planner action pauses activation.

## Brick LP-18: Correction Learning Inbox

Classification: Yellow for schema/code, Red for migration/apply.

Goal: persist LP-6 learning proposals into an approval inbox instead of throwing them away.

Why not direct learning yet:

Corrections are powerful. A bad learned rule can poison future parses. The first version should collect proposals and make them reviewable.

Tasks:

- Draft schema for `food_learning_proposals`.
- Store proposal type, phrase, accepted/rejected refs, payload, status.
- Add API endpoint to create proposals from Plate actions.
- Do not auto-apply proposals.
- Add admin/read endpoint or script for review.

Acceptance:

- Plate corrections can create reviewable learning events.
- Nothing changes matching behavior until approved.

Stop conditions:

- If native Plate does not yet emit enough correction metadata, add native event plumbing first.

## Brick LP-19: Approved Learning Apply Path

Classification: Yellow for code, Red for live production applies.

Goal: apply approved learning proposals to aliases, rejected aliases, unit alternatives, or pantry suggestions.

Tasks:

- Add idempotent apply script/API.
- Handle proposal statuses:
  - pending
  - approved
  - applied
  - rejected
- Write only approved proposals.
- Add dry-run diff.
- Add tests for duplicate applies.

Acceptance:

- One approved correction can improve future matching.
- Failed apply does not corrupt food identity.

## Brick LP-20: Streaming Plate API Prototype

Classification: Green for inactive/prototype endpoint; Red if native contract changes require rebuild or risky live activation.

Goal: expose LP-9 event protocol from an API route or local harness.

Tasks:

- Build a prototype endpoint or script that emits Plate stream events from a search-first draft.
- Keep existing `/api/claude/parse-meal` stable unless explicitly activating.
- Add event contract tests.
- Document native integration needs.

Acceptance:

- Events stream in order.
- Running totals update as items arrive.
- Fallback items are explicit.

## Recommended Execution Order

Default order:

1. LP-10 Pantry Gap Approval Packet
2. LP-11 Pantry Gap Apply Script
3. LP-12 Alias And Rejected-Alias Storage
4. LP-13 Search-First Route Shadow Mode
5. LP-14 Identity Document Cache
6. LP-15 Search-First Partial Activation
7. LP-16 Fast Planner Shadow Mode
8. LP-17 Fast Planner Activation For Safe Middle Cases
9. LP-18 Correction Learning Inbox
10. LP-19 Approved Learning Apply Path
11. LP-20 Streaming Plate API Prototype

Possible reorder with justification:

- Move LP-14 before LP-13 if shadow mode shows identity-doc build overhead is already obvious.
- Move LP-12 after LP-15 if we decide code-level aliases are enough for the first activation.
- Move LP-18 before LP-16 if native correction events are the highest leverage product move.
- Move LP-20 earlier if perceived speed becomes the priority after search-first activation.

## What Not To Do Next

- Do not lower global thresholds to make the golden set look better.
- Do not let `hourly_go_tos` become final identity.
- Do not auto-apply librarian proposals.
- Do not activate the fast planner before search-first has a stable shadow baseline.
- Do not solve pantry gaps with broad aliases when the correct fix is a product/default row.
- Do not build Progress scoring on dirty identity data.

## Definition Of Done For This Next Batch

The next batch is successful when:

- pantry gaps are reviewable and apply-ready,
- search-first shadow telemetry exists,
- identity docs are cached or build latency is controlled,
- search-first can safely skip expert LLM for the easy/middle golden cases,
- uncertain cases still show Plate review/choose instead of pretending,
- and all protected data writes remain approval-gated.

