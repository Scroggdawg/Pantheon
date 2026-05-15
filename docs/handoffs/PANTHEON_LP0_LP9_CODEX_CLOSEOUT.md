# Pantheon LP-0 Through LP-9 Codex Closeout

Date: 2026-05-14
Repo: `/Users/scrogdawg/BMF Headquarters/2026 - THE NARRATIVE/26_09 Pantheon/pantheon`
Status: Lightning Parse autonomous pass complete. Pushed to `origin/main`.

## Summary

Codex executed the full Lightning Parse batch from LP-0 through LP-9.

The pass deliberately separated three classes of work:

- **Active safe runtime improvements:** LP-0 telemetry and LP-3 segmenter/overmatch safety shipped into live code paths.
- **Inactive architecture/proof layers:** LP-1, LP-2, LP-4, LP-5, LP-6, LP-8, LP-9 define and test the next architecture without changing live parser behavior.
- **Read-only diagnostics:** LP-2 proof and LP-7 coverage report query current data but do not mutate Supabase or caches.

No production Supabase writes, migrations, deletes, EAS actions, paid infrastructure, or destructive git operations were performed.

## Commits

- `e21c8b3` — LP-0 add parse SLA telemetry harness
- `12c02fd` — LP-1 define canonical identity spec
- `c8bf49a` — LP-2 add identity search proof
- `d43c7f5` — LP-3 split accompaniment segments safely
- `29ad9c5` — LP-4 add search-first resolver proof
- `6d8b946` — LP-5 add fast planner contract
- `3a38c68` — LP-6 add correction learning proposals
- `72f433f` — LP-7 add data coverage gap report
- `2646551` — LP-8 add librarian task proposals
- `9aa0cf8` — LP-9 add streaming Plate event protocol

## What Is Live Now

### LP-0 Telemetry Harness

`app/api/claude/parse-meal/route.ts` now records route-stage telemetry:

- total route latency
- response cache lookup latency
- library shortcut lookup latency
- segmented lookup latency
- candidates lookup latency
- LLM latency
- fallback LLM flag

`scripts/replay-parse.ts` now supports:

- golden fixture mode
- p99/SLA/fallback reporting
- route-stage averages

Golden fixture:

- `scripts/fixtures/parse-golden-utterances.json`

### LP-3 Segmenter Safety

`lib/claude/parse-meal-library-shortcut.ts` now splits obvious accompaniment phrases:

- `20 chips with guacamole` -> `20 chips` + `guacamole`
- `2 churros with chocolate sauce` -> `2 churros` + `chocolate sauce`

It intentionally preserves integrated items:

- `protein shake with dextrose` remains one segment.

`lib/claude/tools/search-user-library.ts` now caps generic single-token overmatches for:

- `chip`
- `bacon`
- existing guards such as `coffee`, `tea`, `water`, `orange`, `lime`

This prevents wrong-fast matches like `chips` -> Yasso Mint Chocolate Chip bar or `bacon` -> McDonald's BEC from becoming high-confidence shortcut hits.

## What Is Built But Not Activated

### LP-1 Canonical Identity Contract

New doc:

- `docs/LIGHTNING_PARSE_CANONICAL_IDENTITY_SPEC.md`

Defines:

- canonical identity document shape
- source authority order
- alias/rejected-alias semantics
- Plate contract
- Provisions/Progress identity implications

### LP-2 Identity Search Proof

New code:

- `lib/claude/food-identity.ts`
- `scripts/proof-search-engine.ts`

Read-only proof result from latest run:

- identity docs: 154
- counts: saved meals 6, products 48, barcode products 13, recipes 26, history signals 61
- local search latency: p50 around 2ms, p95 around 5ms after doc build

Key finding:

- Search is already fast locally once identity docs are built.
- Remaining quality blockers are segmentation, data coverage, and review/choice semantics.

### LP-4 Search-First Resolver Proof

New code:

- `lib/claude/search-first-resolver.ts`
- `scripts/test-search-first-resolver.ts`

Latest proof:

- 6/8 golden utterances can produce a Plate draft without expert LLM fallback.
- Still not wired into the live route.

### LP-5 Fast Planner Contract

New code:

- `lib/claude/fast-planner.ts`
- `scripts/test-fast-planner.ts`

Defines a one-call Haiku planner contract using a forced `plan_plate` tool call.

Important safety rule:

- The planner can only choose candidates already fetched by search, estimate visibly, or request expert fallback.
- It cannot invent candidate IDs.

Not live yet.

### LP-6 Correction Learning Proposals

New code:

- `lib/corrections/learning.ts`
- `scripts/test-correction-learning.ts`

Generates proposed learning events for:

- identity swap/alias
- identity rejection
- unit/quantity review
- pantry suggestion

No writes are performed.

### LP-7 Data Coverage Report

New script:

- `scripts/report-data-coverage-gaps.ts`

Latest read-only report identified:

High priority:

- `chips`
- `dos xx`
- `stevia hazelnut liquid`

Medium priority:

- `bacon`
- `chocolate sauce`
- `coffee`
- `guacamole`
- `half half half`
- `protein shake dextrose`

Low priority:

- `margaritas`

### LP-8 Librarian Task Proposals

New code:

- `lib/librarian/proposals.ts`
- `scripts/test-librarian-proposals.ts`

Turns coverage gaps into approval-required librarian tasks such as:

- add tortilla/restaurant chips defaults
- add Dos Equis 16 oz plus voice aliases
- add guacamole/chocolate sauce/margarita defaults

No task is auto-applied.

### LP-9 Streaming Plate Protocol

New code:

- `lib/claude/streaming-plate.ts`
- `scripts/test-streaming-plate.ts`

Defines event protocol:

- `plate_started`
- `item_ready`
- `item_needs_fallback`
- `plate_completed`

Not wired to API or native UI yet.

## Verification Run

Final verification:

- `npm run typecheck` passed
- `npm run lint` passed

Focused checks run during the pass:

- `npx tsx scripts/test-matcher-invariants.ts` -> 10 pass / 0 fail
- `npx tsx scripts/test-segmented-library.ts` -> 10 pass / 0 fail
- `npx tsx scripts/proof-search-engine.ts` -> read-only proof passed
- `npx tsx scripts/test-search-first-resolver.ts` -> 6/8 golden can skip expert LLM
- `npx tsx scripts/test-fast-planner.ts` -> pass
- `npx tsx scripts/test-correction-learning.ts` -> pass
- `npx tsx scripts/report-data-coverage-gaps.ts` -> read-only report generated
- `npx tsx scripts/test-librarian-proposals.ts` -> pass
- `npx tsx scripts/test-streaming-plate.ts` -> pass

## Important Non-Actions

Not done, intentionally:

- No Supabase data writes.
- No migrations applied.
- No pantry rows inserted.
- No Typesense or paid search infrastructure created.
- No native OTA/EAS action.
- No live route activation of LP-4/LP-5/LP-9.

## Next Best Moves

1. **Approve or manually add LP-7 coverage items.**
   Highest leverage: chips, Dos Equis, stevia hazelnut, guacamole, chocolate sauce, bacon.

2. **Decide whether to activate search-first resolver behind the route.**
   Recommendation: do this after the first coverage pass so `chips` and `dos xx` do not enter the Plate as ugly Choose/fallback cases.

3. **Run a live golden replay after coverage improves.**
   Use `npm run replay -- --golden --no-clear-cache` cautiously. Full replay can write response cache rows.

4. **Plan the production data-write path.**
   LP-6 and LP-8 now produce proposal shapes. Applying them to Supabase remains Red and needs explicit approval.

## Current Head

`9aa0cf8 LP-9 add streaming Plate event protocol`

