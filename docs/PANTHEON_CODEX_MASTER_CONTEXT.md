# Pantheon Codex Master Context

Date: 2026-05-17
Audience: Codex on any machine, especially Hive / Mac Mini
Status: Whole-system orientation. Pair with `docs/handoffs/PANTHEON_S28_MAC_MINI_MIGRATION_1.md` for the immediate migration checklist.

## ELI5

Pantheon is Luke's personal nutrition and fitness system.

The iPhone app is the product Luke uses. The web repo is the brain and control room. Supabase is the data spine. The current mission is to make voice food logging feel instant and trustworthy: speak a meal, Pantheon resolves it from a growing pantry database, shows what it thinks, and only asks Luke to intervene when that intervention matters.

The pantry is the moat. Every safe food, alias, rejection, and unit conversion makes the next parse faster. Accuracy is speed: if Luke has to redo the log, the first response was not actually fast.

## How To Use This Doc

Read this once when taking over Pantheon. Then use the more specific docs for the active workstream.

Immediate continuation on Hive:

1. Read `docs/handoffs/PANTHEON_S28_MAC_MINI_MIGRATION_1.md`.
2. Ensure `/Users/scroggdawg/Code/pantheon/.env.local` contains real values, not placeholders.
3. Run the verification commands in the migration handoff.
4. Continue with the Breakfast Dairy v2 pantry dry-run.

This document is broader than that. It gives the project map.

## The Mental Model

Pantheon has three major pieces:

- Native app = body
- Web repo = brain / control room
- Supabase = spine / memory

Native is canonical. The web app exists mostly to power API, AI, admin, pantry, Withings, and deployment control. Do not mistake the web UI for the product unless Luke explicitly scopes web UI work.

## Repositories

### Web Repo

MacBook path:

`/Users/scrogdawg/BMF Headquarters/2026 - THE NARRATIVE/26_09 Pantheon/pantheon`

Hive path:

`/Users/scroggdawg/Code/pantheon`

GitHub:

`https://github.com/Scroggdawg/Pantheon.git`

Responsibilities:

- `/api/claude/parse-meal`
- `/api/whisper/transcribe`
- `/api/claude/parse-workout`
- `/api/claude/parse-workout-image`
- `/api/withings/sync`
- Pantry builder scripts and review ledgers
- Food identity / matcher / parser logic
- Admin and operational surfaces
- Supabase migrations
- Vercel deploy surface

### Native Repo

Known MacBook path:

`/Users/scrogdawg/Code/pantheon-native`

Likely Hive path once cloned:

`/Users/scroggdawg/Code/pantheon-native`

GitHub:

`https://github.com/Scroggdawg/pantheon-native`

Responsibilities:

- Expo / React Native iOS app
- Voice logging UI
- Plate review and inline food editing
- Pantheon dashboard
- Progress surface
- Provision surface
- iOS widget and App Group writes
- HealthKit / native integrations
- EAS build and OTA update workflow

Do not run native EAS build/update/submit casually. Read native `AGENTS.md` and `OTA_RUNBOOK.md` first.

## Current Product Philosophy

Pantheon is being built toward this bar:

- Lightning fast parse: target around 5 seconds for normal utterances.
- Database-first accuracy: personal pantry, aliases, rejections, units, and historical signals resolve as much as possible before expert LLM fallback.
- Recoverable uncertainty: uncertain rows should surface as `Review`, `Choose`, or `Estimate`, not false `High`.
- Pantry flywheel: every parse, correction, edit, rejection, and review should teach the system.
- Native-first UX: the phone flow needs to feel fluid, not like a web admin bolted onto an app.

Luke's rule of thumb: accuracy is speed. A wrong fast answer is not fast if it makes him redo the work.

## Core User Flow

Food logging roughly works like this:

1. Luke opens native `Log Food`.
2. He speaks or types a meal.
3. Native calls web APIs through the shared-secret wrapper.
4. Web transcribes audio when needed.
5. Web parse route tries fast pantry/library resolution first.
6. If fast resolution is not enough, it falls through to expert LLM/tool logic.
7. Native receives structured foods, confidence/review labels, units, and macros.
8. Luke reviews in Plate UI.
9. Save writes to Supabase.
10. Dashboard/widget update from Supabase/App Group.

The target future state is that most everyday utterances skip the slow expert LLM because the pantry knows enough.

## Parse / Matcher Architecture

Key concepts:

- `products` are parser-facing pantry items.
- `saved_meals` are Luke-specific saved composites or repeat meals.
- `food_identity_aliases` safely route natural names to canonical identities.
- `food_identity_rejections` block known bad mappings.
- `unit_alternatives` converts natural quantities to grams.
- `hourly_go_tos` are ranking signals only, never canonical identities.

Important matcher rules already learned:

- Generic `coffee` must not become REBBL Hazelnut Coffee Elixir.
- Generic `chips` must not become chocolate chips or Yasso mint chocolate chip.
- `hourly_go_tos` collapse into canonical product/saved_meal when possible.
- Generic aliases must not bind to too-specific branded/subtype products.
- Same-name / plural variants need canonical collapse.
- Composite saved meal names must be protected from naive `and` splitting.
- Quantity/filler words can be stripped for search, but identity words must survive.

The matcher has intentionally accumulated guardrails because each one captures a real failure class.

## Current Active Workstream: Pantry Lightning

Pantry Lightning is the autonomous pantry-building project.

Goal:

Build a repeatable training-pack system that can expand Pantheon's food database safely and quickly.

Current live state after the latest MacBook work:

- products: 151
- pantry-imported products: 90
- pantry import runs: 13
- pantry import candidates: 299
- latest known apply: `bf0a1ae5-0025-4ccb-99d0-1ac45be6ff55`, completed

Important recent commits:

- `f53af37` Add Mac Mini migration handoff
- `0af914f` Add v2 pantry expansion packs
- `063a997` Tighten pantry review alias routing
- `83acda8` Block generic chips dessert overmatches
- `561b762` Record already-covered alias apply
- `3a332a7` Add already-covered alias planner

Current v2 packs:

- `data/pantry/packs/produce-grains-v2.json`
- `data/pantry/packs/protein-cuts-v2.json`
- `data/pantry/packs/sauces-condiments-v2.json`
- `data/pantry/packs/breakfast-dairy-v2.json`
- `data/pantry/packs/cuisine-staples-v2.json`

Already applied from v2:

- Produce Grains v2 offset 0: 13 product inserts
- Produce Grains v2 offset 25: 2 product inserts
- Protein Cuts v2 offset 0: 2 product inserts

Next planned step:

`breakfast-dairy-v2` offset 0 dry-run.

## Pantry Builder Guardrails

Autonomous product writes are allowed only when all of this is true:

- Source is USDA Foundation, Survey FNDDS, or SR Legacy.
- Candidate is classified `auto_approved`.
- Generated markdown has been inspected.
- Rows are boring canonical foods.
- Row count is under the active cap, currently 25 unless explicitly changed.
- No novel bad-match class appears in auto-approved rows.

Never auto-write:

- OFF / branded products
- restaurants
- alcohol / cocktails
- supplements
- recipes
- composites
- LLM-estimated rows
- rows with suspicious specificity mismatch

Review-only does not mean bad. It means "do not silently write this as canonical pantry truth."

## Pantry Commands

Verify pack shape:

```bash
npx tsx scripts/test-pantry-packs.ts
```

Verify pantry builder guardrails:

```bash
npx tsx scripts/test-pantry-builder.ts
```

Check live pantry status:

```bash
npx tsx scripts/report-pantry-lightning-status.ts
```

Verify governance schema:

```bash
npx tsx scripts/verify-pantry-governance.ts
```

Dry-run a pack:

```bash
npx tsx scripts/autonomous-pantry-builder.ts --profile=data/pantry/packs/breakfast-dairy-v2.json --limit=25 --offset=0
```

Apply only after inspecting generated markdown:

```bash
npx tsx scripts/autonomous-pantry-builder.ts --apply \
  --run-id=<run-id> \
  --run-file=scripts/output/pantry-builder-<run-id>.json \
  --max-insert=25
```

Scripts write generated artifacts into `scripts/output/`, which is ignored. Do not commit those artifacts unless deliberately changing doctrine.

## Environment Variables

Do not print values.

Web repo needs `.env.local` with real values. `.env.example` is only shape.

Important names include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `USDA_FDC_API_KEY`
- `PANTHEON_NATIVE_SECRET`
- Withings/Vercel-related values as defined in `.env.example`

Hive is currently expected at:

`/Users/scroggdawg/Code/pantheon/.env.local`

MacBook source was:

`/Users/scrogdawg/BMF Headquarters/2026 - THE NARRATIVE/26_09 Pantheon/pantheon/.env.local`

Notice the username difference:

- MacBook: `scrogdawg`
- Hive: `scroggdawg`

## Supabase And Data Integrity

Supabase is production data. Treat it with respect.

Reads are generally safe. Writes require an approved lane:

- Safe pantry apply under the guardrails above.
- Explicit Luke-approved mutation.
- Forward-only migration approved by Luke.

Do not use old hardcoded tokens or credential workarounds.

Do not run migrations unless Luke explicitly approves that exact migration.

Do not delete production rows unless Luke explicitly approves the rows and scope.

## Native App Context

The native app is Expo SDK 54 / React Native 0.81 era, iOS-first, TestFlight-distributed.

Major native surfaces:

- Log Food modal
- Plate review cards
- Inline per-food edit controls
- Big microphone / save button
- Pantheon dashboard
- Progress
- Provision
- iOS widget
- HealthKit/Withings-adjacent flows

Native has a very different release model:

- JS-only OTA can be fast if fingerprint-compatible.
- Native config/plugins/widgets/build files require EAS build/TestFlight.
- EAS builds can be slow.
- Preview channel historically existed but did not have a real installed preview audience.

Do not assume a Git push updates native. Web pushes deploy via Vercel; native changes require OTA or EAS depending on fingerprint.

Read native docs before native work:

- native `AGENTS.md`
- native `OTA_RUNBOOK.md`
- latest native handoff docs

## Web Repo Context

Web is Next.js on Vercel.

Treat web as backend/admin/API, not the main app. Main responsibility is reliable service to native.

Standard checks:

```bash
npm run typecheck
npm run lint
```

Run build for routing/runtime/deployment-sensitive changes:

```bash
npm run build
```

Do not deploy/promote/rollback Vercel production settings without explicit approval. Normal GitHub push may trigger configured deployment; be clear about that when pushing web code.

## Important Docs To Read

For immediate Hive continuation:

- `docs/handoffs/PANTHEON_S28_MAC_MINI_MIGRATION_1.md`
- `docs/handoffs/PANTHEON_S28_V2_PACKS_1.md`
- `docs/PANTRY_V2_EXPANSION_PACKS.md`

For Pantry Lightning:

- `docs/PANTRY_LIGHTNING_EXECUTION_CONTRACT.md`
- `docs/PANTRY_AUTONOMOUS_1K_PLAN.md`
- `docs/PANTRY_REVIEW_LANE.md`
- `docs/PANTRY_APPROVAL_LEDGER_FORMAT.md`
- `docs/AUTONOMOUS_PANTRY_BUILDER.md`

For Lightning Parse / matcher:

- `docs/MATCHER_CONSTITUTION.md`
- `docs/LIGHTNING_PARSE_CANONICAL_IDENTITY_SPEC.md`
- `docs/LIGHTNING_PARSE_NEXT_BRICKS.md`
- `docs/MACROFACTOR_LESSONS_DOCTRINE.md`

For audit trail:

- `docs/handoffs/PANTHEON_CODEX_S28_MATCHER_AUDIT_HANDOFF.md`
- recent docs under `docs/handoffs/PANTHEON_S28_*`

## Roadmap At 30,000 Feet

The project is not just pantry rows. Pantry rows are the current compounding layer.

Major future arcs:

1. Finish Pantry Lightning v2 packs and review compiler.
2. Make parser routinely hit fast database-first paths.
3. Improve review/approval flow so Luke makes high-leverage choices, not row-by-row trivia.
4. Deepen unit intelligence so natural quantities resolve correctly.
5. Continue Plate/inline editing as the recovery surface.
6. Connect Pantheon, Provision, and Progress into one closed loop.
7. Build cookbook/recipes/batch cooking.
8. Define and compute Greek God Score.
9. Mature widget and Progress surfaces.
10. Add barcode / branded product workflows when the data layer can support them.
11. Expand native HealthKit/energy-out integrations over time.

## Open Product Judgments

These are Luke decisions, not Codex guesses:

- Product/UX naming.
- Whether an ambiguous branded/restaurant row should become canonical.
- Whether a review-only row is worth adding manually.
- Recipe/composite semantics.
- Visual taste and animation intensity.
- Any production data deletion.
- Any migration or release-risk tradeoff.

Codex should make engineering calls where the data is clear, but should not pretend product judgment is a compiler problem.

## How Codex Should Work Here

Default posture:

- Read the relevant files first.
- Prefer repo patterns over new abstractions.
- Make small durable changes.
- Verify empirically.
- Commit and push safe green work when approved by standing policy.
- Write handoffs for meaningful state transitions.

For pantry:

- Dry-run first.
- Inspect generated markdown.
- Apply only boring safe USDA rows.
- Stop on a novel auto-approved bad-match class.
- Convert novel bad-match classes into tests/guards.

For native:

- Be conservative.
- Check OTA/fingerprint implications.
- Do not run EAS commands without explicit approval.

For data:

- Never print secrets.
- Never mutate production outside an approved lane.
- Prefer adding memory/guardrails over silently trusting a fuzzy match.

## What The Current Codex Knows Well

Strong context:

- Pantry builder architecture.
- Matcher/identity guardrails.
- Review aliases/rejections.
- Current live pantry counts.
- Lightning Parse philosophy.
- Native/web split.
- OTA/EAS high-level risks.
- Roadmap shape.

Always verify:

- Exact repo state.
- Current live DB counts.
- Current installed native build/channel.
- Current env availability.
- Any data row before mutation.

## Current Best Next Action

On Hive, after real `.env.local` is in place:

```bash
cd /Users/scroggdawg/Code/pantheon
npx tsx scripts/verify-pantry-governance.ts
npx tsx scripts/report-pantry-lightning-status.ts
npx tsx scripts/autonomous-pantry-builder.ts --profile=data/pantry/packs/breakfast-dairy-v2.json --limit=25 --offset=0
```

Then inspect the generated markdown before applying anything.

Expected caution for Breakfast Dairy v2:

- `cottage cheese with vegetables` should not auto-apply for plain cottage cheese.
- `whey protein powder` should stay review-only.
- branded cereal/milk/healthy-ice-cream rows should stay review-only.
- boring cereal/oat/milk basics may be safe if exact enough.

If a dry-run has suspicious auto-approved rows, do not apply. Add a guard and a test first.

## Closing Note

Pantheon is a living system. The pantry is not just data entry; it is how the parser learns the world Luke actually eats. The right move is not to rush to 1,000 rows. The right move is to make each expansion pack improve the compiler so the next pack is safer, faster, and less dependent on Luke.

Make the system harder to fool. Then make it bigger.
