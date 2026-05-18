# Pantheon S28 Hive Instacart Lightning 4

Date: 2026-05-17
Author: Codex on Hive
Status: Cucumber anchor repair completed.

## Summary

This round narrowed the pantry risk rule that was blocking raw cucumber. The prior classifier treated any target query containing `with` as composite, which is correct for phrases like `with sauce` or `with vegetables`, but too broad for `cucumber with peel raw`.

Changed:

- `lib/pantry-builder/risk.ts`
- `scripts/test-pantry-builder.ts`
- `data/pantry/generic-aliases-instacart-5.json`

The raw Instacart CSV remains local and uncommitted:

- `/Users/scroggdawg/Downloads/instacart_food_items.csv`

## Live Delta

Applied 1 USDA product anchor from dry-run:

- run: `35a4c65d-5f4f-44da-8eb5-a012c413e2e6`
- inserted: `Cucumber, with peel, raw`
- review-left: 5

Applied 2 aliases from:

- `data/pantry/generic-aliases-instacart-5.json`

Aliases:

- `Lazy Acres Cucumbers Organic` -> `Cucumber, with peel, raw`
- `Organic Cucumbers` -> `Cucumber, with peel, raw`

## Coverage Lift

Before this round:

- exact Instacart coverage: 84 / 261
- Produce: 56 / 68
- products: 208

After this round:

- exact Instacart coverage: 86 / 261
- Produce: 58 / 68
- products: 209

Net lift:

- +1 safe USDA product
- +2 exact-covered Instacart names
- Produce moved from 82% to 85%

## Rule Change

`with peel` is now allowed as an edible-portion state modifier, not treated as a composite recipe phrase.

Still review-only:

- `coffee with half and half`
- `with sauce`
- `with vegetables`
- other composite food phrases

## Held On Purpose

Still held:

- mint, because USDA search returns cocktail/noisy results;
- lemongrass, because USDA search returns prepared soup or wrong-food drift;
- butter, because USDA search returns pretzel/buttered drift or missing macros;
- rice, because current candidates are glutinous rice or rice noodles, not generic white/jasmine rice;
- salt, because zero-calorie macro sanity needs a separate rule if we want salt as a product;
- cheese variants and branded substitutes, because formulations vary.

## Verification

Passed:

- `npx tsx scripts/test-pantry-builder.ts`
- `npx tsx scripts/test-pantry-packs.ts`
- `npx tsx scripts/autonomous-pantry-builder.ts --profile=data/pantry/packs/instacart-usda-anchors-2.json --limit=25 --offset=0`
- `npx tsx scripts/autonomous-pantry-builder.ts --apply --run-id=35a4c65d-5f4f-44da-8eb5-a012c413e2e6 --run-file=scripts/output/pantry-builder-35a4c65d-5f4f-44da-8eb5-a012c413e2e6.json --max-insert=25`
- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-instacart-5.json`
- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-instacart-5.json --apply --allow-alias-writes --max-alias=25`
- `npx tsx scripts/report-instacart-pantry-coverage.ts --csv=/Users/scroggdawg/Downloads/instacart_food_items.csv --limit=40`
- `npx tsx scripts/report-pantry-lightning-status.ts`
- `npx tsx scripts/verify-pantry-governance.ts`
- `npm run typecheck`
- `npm run lint`

Live status after the applies:

- products: 209
- pantry-imported products: 148
- pantry import runs: 29
- pantry import candidates: 464
- latest apply: `35a4c65d-5f4f-44da-8eb5-a012c413e2e6`, completed

## Next Move

The remaining Instacart safe bucket is no longer mostly safe. Best next move is guard/search refinement for mint, lemongrass, butter, rice, and salt, or starting a branded-product pilot with an explicit nutrition source. Do not broad-alias the remaining cheese, dairy substitute, pie crust, or branded prepared rows.
