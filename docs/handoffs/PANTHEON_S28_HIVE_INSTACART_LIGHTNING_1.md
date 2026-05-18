# Pantheon S28 Hive Instacart Lightning 1

Date: 2026-05-17
Author: Codex on Hive
Status: Instacart alias/anchor round completed; verification/commit pending.

## Summary

Luke provided a local Instacart item export:

- `/Users/scroggdawg/Downloads/instacart_food_items.csv`

The raw CSV remains local and uncommitted. This export appears to be a deduped item catalog rather than order-line history:

- rows: 261
- exact unique item names: 261
- exact repeated item names: 0

Because there were no exact repeats, this round used the export as personal vocabulary and grocery-priority signal.

## Live Delta

Current live status after the applies:

- products: 207
- pantry-imported products: 146
- pantry import runs: 27
- pantry import candidates: 460
- latest product apply: `f476173c-fe67-41cb-8fff-370eb8684351`, completed

This round added:

- 3 USDA product anchors
- 50 Instacart-derived aliases
- 1 guardrail for a new bad-match class

## Coverage Signal

Before this round, exact product/alias coverage of the Instacart item names was very low:

- covered: 6 / 261

After the round:

- covered: 54 / 261
- Produce coverage: 36 / 68
- Dairy & Eggs coverage: 12 / 37

This is exact-name coverage only. Practical fuzzy coverage is better than that, because many remaining items share family-level anchors but have brand/prepared wording that should not be silently collapsed.

## Alias Batches

Added:

- `data/pantry/generic-aliases-instacart-1.json`
- `data/pantry/generic-aliases-instacart-2.json`

Applied 50 aliases total, capped at 25 per apply.

Examples:

- `Lazy Acres Organic Cilantro` -> `Cilantro, raw`
- `Organic Green Onions (Scallions) Bunch` -> `Onions, green, raw`
- `Village Farms Sinfully Sweet Campari Tomatoes` -> `Tomatoes, grape, raw`
- `Lazy Acres Organic Hass Avocados` -> `Avocado, raw`
- `Happy Egg ... Large ... Eggs` -> `Eggs - Large`
- `JENNIE-O Ground Turkey 93% Lean 7% Fat` -> `Turkey, ground, 93% lean/ 7% fat, raw`
- `Knudsen ... Low Fat Cottage Cheese` -> `Cheese, cottage, lowfat, 2% milkfat`
- `Dave's Killer Bread 21 Whole Grains and Seeds Organic Bread` -> existing Dave's product
- `Bob's Red Mill ... All Purpose ... Flour` -> `Flour, wheat, all-purpose, enriched, bleached`
- `C&H ... Granulated Sugar` -> `Sugars, granulated`
- `Knudsen ... Reduced Fat Buttermilk` -> `Buttermilk, low fat`

## Product Anchor Batch

Added:

- `data/pantry/packs/instacart-usda-anchors-1.json`

Applied from dry-run:

- `f476173c-fe67-41cb-8fff-370eb8684351`

Inserted 3:

- `Flour, wheat, all-purpose, enriched, bleached`
- `Sugars, granulated`
- `Buttermilk, low fat`

Held / not applied:

- `cucumber raw -> Cucumber, with peel, raw` because peel specificity is currently review-only.
- `serrano peppers raw` because no safe USDA candidate returned in the final run.
- `lemongrass raw -> SMART SOUP, Vietnamese Carrot Lemongrass` because that is prepared/branded drift.
- `mint raw -> Mint julep` because that is cocktail drift.
- `unsalted butter -> Pretzels, soft, ready-to-eat, unsalted, buttered` because that is a bad-match class.
- `plain nonfat greek yogurt -> Yogurt, Greek, plain, nonfat` because the product already exists.

## Guardrail Added

Added `no butter` as a state modifier in:

- `lib/pantry-builder/risk.ts`
- `lib/pantry-builder/usda-core.ts`

Added test coverage in:

- `scripts/test-pantry-builder.ts`

Why:

- `unsalted butter` must not auto-approve to `Pretzels, soft, ready-to-eat, unsalted, no butter`.

## Verification

Passed during the round:

- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-instacart-1.json`
- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-instacart-1.json --apply --allow-alias-writes --max-alias=25`
- `npx tsx scripts/autonomous-pantry-builder.ts --profile=data/pantry/packs/instacart-usda-anchors-1.json --limit=25 --offset=0`
- `npx tsx scripts/autonomous-pantry-builder.ts --apply --run-id=f476173c-fe67-41cb-8fff-370eb8684351 --run-file=scripts/output/pantry-builder-f476173c-fe67-41cb-8fff-370eb8684351.json --max-insert=25`
- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-instacart-2.json`
- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-instacart-2.json --apply --allow-alias-writes --max-alias=25`
- `npx tsx scripts/verify-pantry-governance.ts`
- `npx tsx scripts/test-pantry-packs.ts`
- `npx tsx scripts/test-pantry-builder.ts`
- `npx tsx scripts/report-pantry-lightning-status.ts`

## Next Move

Instacart round 2 should focus on review/anchor decisions, not broad branded writes.

Good next candidates:

- decide whether `Cucumber, with peel, raw` should become the generic cucumber anchor;
- decide whether seeded hot peppers can safely anchor serrano/jalapeno family items;
- add safe aliases for pears, cabbage, remaining berries, and dairy items missed by exact-name matching;
- keep frozen desserts, electrolyte mixes, alcohol, prepared sushi/poke, smoothies, pizza, and branded sauces review-only.
