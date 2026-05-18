# Pantheon S28 Hive Instacart Lightning 5

Date: 2026-05-17
Author: Codex on Hive
Status: Anchor repair session completed.

## Summary

This round targeted the remaining tricky Instacart anchors with better USDA query wording. It produced two clean USDA inserts, one conservative alias batch, and one narrow risk-rule improvement for zero-calorie staples.

Added:

- `data/pantry/packs/instacart-usda-anchors-3.json`
- `data/pantry/generic-aliases-instacart-6.json`

Changed:

- `lib/pantry-builder/risk.ts`
- `scripts/test-pantry-builder.ts`

The raw Instacart CSV remains local and uncommitted:

- `/Users/scroggdawg/Downloads/instacart_food_items.csv`

## Live Delta

Applied 2 USDA product anchors from dry-run:

- run: `e7dd2ae6-3b9a-4617-822d-43be6f200a41`
- inserted: `Rice, white, long-grain, regular, enriched, cooked`
- inserted: `Butter, without salt`
- review-left: 2

Applied 2 aliases from:

- `data/pantry/generic-aliases-instacart-6.json`

Aliases:

- `Kerrygold Grass-Fed Unsalted Butter Sticks` -> `Butter, without salt`
- `H-E-B Unsalted Butter` -> `Butter, without salt`

## Coverage Lift

Before this round:

- exact Instacart coverage: 86 / 261
- Dairy & Eggs: 19 / 37
- products: 209

After this round:

- exact Instacart coverage: 88 / 261
- Dairy & Eggs: 21 / 37
- products: 211

Net lift:

- +2 safe USDA products
- +2 exact-covered Instacart names
- Dairy & Eggs moved from 51% to 57%

The cooked rice product does not raise exact Instacart coverage yet because the remaining Instacart rice rows are dry packaged rice names. Those were intentionally not aliased to cooked rice.

## Rule Change

Zero-calorie products are now macro-sane when protein, carbs, and fat are all exactly zero. This is needed for staples such as table salt and keeps negative or malformed macro rows rejected.

Salt itself was not inserted in this round because the candidate path still returned missing macros for the searched row. The risk-rule change is ready for a better salt fetch path later.

## Dry-Run Findings

`Instacart USDA Anchors 3` produced:

- auto-approved: 2
- review-required: 0
- rejected: 2
- missing macro path: 1

Applied:

- `rice white long-grain regular enriched cooked -> Rice, white, long-grain, regular, enriched, cooked`
- `butter without salt -> Butter, without salt`

Held:

- `lemon grass raw -> Lemon, raw`
  - rejected; still wrong-food drift.
- `vanilla extract -> Vanilla extract`
  - rejected by macro sanity because alcohol-derived calories do not reconcile with protein/carbs/fat.
- `salt table`
  - still missing macros through the builder path despite USDA having a zero-calorie salt row.

## Important Non-Apply Decision

Do not alias these dry packaged rice rows to cooked rice yet:

- `Golden Star Thai Hom Mali Jasmine Rice 2 lbs`
- `4Sisters Organic White Rice`

Reason: the accepted rice anchor is cooked rice. The Instacart rows are dry package/product names. Pantheon can use the cooked rice anchor for logging cooked rice, but dry package names need either a dry-rice product or a clearer parser rule before exact aliases are safe.

## Verification

Passed:

- `npx tsx scripts/test-pantry-builder.ts`
- `npx tsx scripts/test-pantry-packs.ts`
- `npx tsx scripts/autonomous-pantry-builder.ts --profile=data/pantry/packs/instacart-usda-anchors-3.json --limit=25 --offset=0`
- `npx tsx scripts/autonomous-pantry-builder.ts --apply --run-id=e7dd2ae6-3b9a-4617-822d-43be6f200a41 --run-file=scripts/output/pantry-builder-e7dd2ae6-3b9a-4617-822d-43be6f200a41.json --max-insert=25`
- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-instacart-6.json`
- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-instacart-6.json --apply --allow-alias-writes --max-alias=25`
- `npx tsx scripts/report-instacart-pantry-coverage.ts --csv=/Users/scroggdawg/Downloads/instacart_food_items.csv --limit=35`
- `npx tsx scripts/report-pantry-lightning-status.ts`
- `npx tsx scripts/verify-pantry-governance.ts`

Live status after the applies:

- products: 211
- pantry-imported products: 150
- pantry import runs: 30
- pantry import candidates: 467
- latest apply: `e7dd2ae6-3b9a-4617-822d-43be6f200a41`, completed

## Next Move

Anchor repair is mostly exhausted for safe automatic writes. Remaining options:

1. Build a better USDA/manual fetch path for salt, vanilla extract, mint, and lemon grass, with explicit tests.
2. Start the branded product pilot for one cluster, likely frozen desserts or functional beverages.
3. Begin the regression/predictive layer from the Instacart corpus.

Recommended next session: branded product pilot. The remaining generic-anchor work is possible, but the easy safe wins are now mostly harvested.
