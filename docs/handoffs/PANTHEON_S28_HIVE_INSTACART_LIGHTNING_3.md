# Pantheon S28 Hive Instacart Lightning 3

Date: 2026-05-17
Author: Codex on Hive
Status: Anchor-first Instacart round completed.

## Summary

This round followed the post-round-2 plan: dry-run the held USDA anchors first, apply only clean rows, then unlock aliases only where a safe target exists.

Added:

- `data/pantry/packs/instacart-usda-anchors-2.json`
- `data/pantry/generic-aliases-instacart-4.json`
- `docs/INSTACART_BRANDED_BACKLOG.md`

The raw Instacart CSV remains local and uncommitted:

- `/Users/scroggdawg/Downloads/instacart_food_items.csv`

## Live Delta

Applied 1 USDA product anchor from dry-run:

- run: `da0e8a5b-9394-4e97-b860-7c3aafd568fd`
- inserted: `Peppers, serrano, raw`
- review-left: 6

Applied 5 aliases from:

- `data/pantry/generic-aliases-instacart-4.json`

Alias themes:

- `Green Serrano Pepper` -> `Peppers, serrano, raw`
- `Trufresh Serrano Peppers` -> `Peppers, serrano, raw`
- sweet/yellow/white onion grocery forms -> `White Onion`

## Coverage Lift

Before this round:

- exact Instacart coverage: 79 / 261
- Produce: 51 / 68
- active aliases: 536
- products: 207

After this round:

- exact Instacart coverage: 84 / 261
- Produce: 56 / 68
- active aliases: 543
- products: 208

Net lift:

- +1 safe USDA product
- +5 exact-covered Instacart grocery names
- Produce moved from 75% to 82%

## Dry-Run Findings

`Instacart USDA Anchors 2` produced:

- auto-approved: 1
- review-required: 1
- rejected: 5

Applied:

- `serrano peppers raw -> Peppers, serrano, raw`

Held:

- `cucumber with peel raw -> Cucumber, with peel, raw`
  - review-required because current risk logic treats the with-peel target as composite/review-only.
- `mint raw -> Mint julep`
  - rejected; cocktail drift.
- `lemongrass raw -> Beets, raw`
  - rejected; low token coverage and wrong food.
- `rice white cooked -> Rice, white, cooked, glutinous`
  - rejected as existing glutinous rice, not generic white rice.
- `rice jasmine cooked -> Rice noodles, cooked`
  - rejected; wrong form.
- `iodized salt -> Salt, table`
  - rejected by macro sanity on zero-calorie salt.
- `butter unsalted`
  - missing macros from the candidate path; no write.

## Branded Backlog

Added `docs/INSTACART_BRANDED_BACKLOG.md` to hold the hard remainder without blocking safe pantry expansion.

Current post-round lanes:

- covered: 84
- needs_branded_product: 76
- review_only: 57
- safe_alias_candidate: 34
- alcohol_hold: 8
- non_food: 2

## Verification

Passed:

- `npx tsx scripts/test-pantry-packs.ts`
- `npx tsx scripts/autonomous-pantry-builder.ts --profile=data/pantry/packs/instacart-usda-anchors-2.json --limit=25 --offset=0`
- `npx tsx scripts/autonomous-pantry-builder.ts --apply --run-id=da0e8a5b-9394-4e97-b860-7c3aafd568fd --run-file=scripts/output/pantry-builder-da0e8a5b-9394-4e97-b860-7c3aafd568fd.json --max-insert=25`
- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-instacart-4.json`
- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-instacart-4.json --apply --allow-alias-writes --max-alias=25`
- `npx tsx scripts/report-instacart-pantry-coverage.ts --csv=/Users/scroggdawg/Downloads/instacart_food_items.csv --limit=25`
- `npx tsx scripts/verify-pantry-governance.ts`

Live status after the applies:

- products: 208
- pantry-imported products: 147
- pantry import runs: 28
- pantry import candidates: 462
- latest apply: `da0e8a5b-9394-4e97-b860-7c3aafd568fd`, completed

## Next Move

Best next step is not another blind pack. The next good work is one of:

1. Add a targeted guard or search refinement so lemongrass cannot resolve to beets and mint stays away from cocktails.
2. Decide cucumber doctrine: accept `Cucumber, with peel, raw` as the generic cucumber anchor, or keep cucumber held.
3. Add a branded nutrition source plan for the frozen dessert / functional beverage clusters.
4. Create a small alias batch only from already-safe targets, but avoid cheese, butter, rice, mint, lemongrass, cucumber, and branded prepared foods until their anchors are fixed.
