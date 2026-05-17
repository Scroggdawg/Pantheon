# Pantheon S28 Hive Pantry Lightning 2

Date: 2026-05-17
Author: Codex on Hive
Status: Continued safe pantry expansion under `--max-insert=25`.

## Summary

This pass continued from `PANTHEON_S28_HIVE_PANTRY_LIGHTNING_1.md`.

Live pantry moved from:

- products: 158
- pantry-imported products: 97
- pantry import runs: 17
- pantry import candidates: 340

To:

- products: 164
- pantry-imported products: 103
- pantry import runs: 19
- pantry import candidates: 361

Net live product inserts in this pass: 6.

Net live product inserts across Hive Pantry Lightning 1 and 2: 13.

## Applied Runs

### Produce Grains v2 offset 25

Run:

`845e027b-7747-400c-9746-16a4f3be0e02`

Inserted 2:

- `rice paper -> Rice paper`
- `pita bread -> Bread, pita`

### Produce Grains v2 offset 0

Run:

`4bed199d-1073-4b06-851e-e71aa7e109dd`

Inserted 4:

- `peach -> Peaches, yellow, raw`
- `kiwi -> Kiwi fruit, raw`
- `yellow squash -> Summer squash, yellow, raw`
- `mushrooms -> Mushrooms, raw`

## Guard Fix Added

### Tots variant guard

Problem found:

- `sweet potato -> Sweet potato tots` was auto-approved in Core USDA offset 0.

Fix:

- Added `tots` to pantry state modifiers.
- Added regression test for generic sweet potato against `Sweet potato tots`.

Commit:

`02d6460 Guard pantry tots variant matches`

After the fix, rerunning Core USDA offset 0 produced zero auto-approved rows.

## Dry-Runs With No Applies

### Cuisine Staples v2 offset 25

Run:

`27e8db11-489a-4ea1-9e98-e54b41167725`

Result:

- auto-approved: 0
- review-required: 12
- rejected: 11

Useful bad-match evidence:

- `banh mi roll -> Pizza rolls`
- `marinara sauce -> Teriyaki sauce`
- `tom kha soup -> Tom Collins`
- `tom yum soup -> Tom Collins`
- `pho beef -> Beef, ground`

### Protein Cuts v2 offset 0

Run:

`9eeabe8c-aac6-4569-8b87-0e32b942eac9`

Result:

- auto-approved: 0
- review-required: 7
- rejected: 17

### Protein Cuts v2 offset 25

Run:

`dc649eed-de64-4739-83db-c2770d2f7bf8`

Result:

- auto-approved: 0
- review-required: 8
- rejected: 4

### Italian offset 0

Run:

`629012f7-2379-43d3-8d21-73d341784d77`

Result:

- auto-approved: 0
- review-required: 7
- rejected: 16

### Core USDA offset 0

Bad artifact before guard:

`45e54678-f7f1-4957-8815-1f2953186f39`

Problem:

- `sweet potato -> Sweet potato tots` auto-approved.

Fresh artifact after guard:

`70e3596e-aea5-409b-a8ca-14adf8b029f4`

Result:

- auto-approved: 0
- review-required: 2
- rejected: 23

## Verification

Passed:

- `npx tsx scripts/verify-pantry-governance.ts`
- `npx tsx scripts/report-pantry-lightning-status.ts`
- `npx tsx scripts/test-pantry-builder.ts`
- `npx tsx scripts/test-pantry-packs.ts`
- `npx tsx scripts/test-matcher-invariants.ts`
- `npm run typecheck`
- `npm run lint`

## Next Best Move

Do not rerun completed v2 windows for apply unless there is a reason.

Recommended next safe exploration:

1. Run `core-usda.json --offset=25 --limit=25`.
2. Inspect auto-approved rows carefully.
3. Patch any new formed/prepared/subtype bad-match class before apply.
4. Apply only clean USDA basics under `--max-insert=25`.

Alternative:

- Build/export a review packet from the accumulated review-required evidence, especially sauces/cuisine/protein rows, before continuing many more low-yield windows.

Still do not raise cap above 25.
