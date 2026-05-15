# Pantry Lightning Execution Contract

Date: 2026-05-15
Status: Active for Pantry Lightning Pass v1

## Goal

Grow Pantheon's parser-facing pantry through repeatable training packs without letting quiet database wrongness outrun review.

## Autonomy

Codex may:

- edit pantry builder docs, scripts, tests, pack files, and schema drafts
- run dry-runs and read-only audits
- apply the forward-only governance schema after tests pass
- live-apply USDA rows only when classified `auto_approved` and the apply would insert at most 25 new products

Codex must stop before:

- branded, OFF, Chipotle, restaurant, alcohol, supplement, recipe, or LLM-estimated live writes
- destructive changes or rollbacks
- credential workarounds
- any novel bad-match class
- any auto-approved sample that looks semantically wrong

## Batch Rules

- Default batch size is `--limit=25`.
- Apply cap is `--max-insert=25`.
- Use `--offset` to move through a pack without reshuffling the pack.
- Run `scripts/verify-pantry-governance.ts` before any apply.
- Do not apply from artifacts generated before the current risk engine.

## Pack Order

1. `data/pantry/packs/core-usda.json`
2. `data/pantry/packs/breakfast-protein.json`
3. `data/pantry/packs/mexican-chipotle-review.json`
4. `data/pantry/packs/bbq.json`

## Review Surface

Markdown artifacts under `scripts/output/` are the v1 review surface.

Each report shows target query, candidate, source, macros, units, aliases, risk score, and reasons. Auto-approved rows are eligible for apply. Review-required rows are candidate inventory only. Rejected rows are duplicate, unsafe, or bad-match evidence.

## First Live Apply Checklist

1. Tests pass:
   - `npx tsx scripts/test-pantry-builder.ts`
   - `npm run typecheck`
   - `npm run lint`
   - `npx tsx scripts/test-matcher-invariants.ts`
   - `npx tsx scripts/test-segmented-library.ts`
   - `npx tsx scripts/test-search-first-resolver.ts`
2. Migration `021_pantry_builder_governance.sql` is applied.
3. `npx tsx scripts/verify-pantry-governance.ts` passes.
4. Dry-run:
   - `npx tsx scripts/autonomous-pantry-builder.ts --profile=data/pantry/packs/core-usda.json --limit=25 --offset=0`
5. Manual report scan finds no suspicious auto-approved rows.
6. Apply:
   - `npx tsx scripts/autonomous-pantry-builder.ts --apply --run-id=<id> --run-file=<artifact.json> --max-insert=25`
7. Re-run tests and focused parser probes.
