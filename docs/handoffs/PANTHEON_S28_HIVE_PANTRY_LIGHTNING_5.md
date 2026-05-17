# Pantheon S28 Hive Pantry Lightning 5

Date: 2026-05-17
Author: Codex on Hive
Status: Purchase-history round completed; verification/commit pending.

## Summary

Luke provided an Amazon/grocery history CSV from 2023-2026. The raw CSV stays local and should not be committed because it contains order metadata. This round translated recurring purchased foods into a USDA-only pack and applied only the clean auto-approved rows.

Current live status after the applies:

- products: 203
- pantry-imported products: 142
- pantry import runs: 25
- pantry import candidates: 455
- latest apply: `086e121c-0944-4783-98a5-832651b7ec58`, completed

## New Pack

Added:

- `data/pantry/packs/amazon-grocery-usda-1.json`

Source signal:

- 324 purchase rows
- 237 unique item names
- high-frequency staples included avocados, Spindrift, ground turkey, onions, cilantro, spaghetti squash, bell peppers, salsa/chips, lettuce, chicken, eggs, cucumbers, and tomatoes

The pack intentionally maps branded grocery items to generic USDA targets where safe, while leaving branded, restaurant, alcohol, prepared meals, candy/cookies, and protein powders review-only.

## Applied Batches

### Amazon Grocery USDA 1 offset 0

Run:

- `2065dfc7-aafb-4b59-8df2-91f658a447a0`

Inserted 1:

- Carrots, baby, raw

### Amazon Grocery USDA 1 offset 25

Run:

- `086e121c-0944-4783-98a5-832651b7ec58`

Inserted 3:

- Beef, ground, 80% lean meat / 20% fat, raw
- Beef, ground, 90% lean meat / 10% fat, raw
- Beverages, almond milk, chocolate, ready-to-drink

## Guard Updates

Added specificity/prep guards:

- `meat and skin`
- `yolk`
- `block`
- `candies`
- prepared terms for `breakfast bars`, `granola bar`, and `granola bars`

Why:

- Plain chicken thigh targets must not auto-approve to meat-and-skin rows when Luke buys boneless/skinless chicken.
- Large eggs must not auto-approve to yolk-only rows.
- Generic cream cheese must not auto-approve to block cream cheese when the purchase history includes whipped/branded cream cheese.
- Chocolate almond milk must not drift to chocolate almond candy.
- Granola clusters must not drift to granola/breakfast bars.

## Review/Reject Drift Not Applied

Notable rows held out of live data:

- `hass avocado raw -> Avocado, Hass, peeled, raw`
- `tomato on the vine raw -> Tomatoes, raw`
- `cherry tomatoes raw -> Tomatoes, grape, raw`
- `jalapeno peppers raw -> Peppers, jalapeno, seeded, raw`
- `chicken thigh raw -> fried/coated chicken thigh`
- `large eggs -> egg yolk`
- `cream cheese -> full fat block/light cream cheese`
- `granola oats honey coconut -> granola/breakfast bar`
- `chocolate almond milk -> chocolate almond candy`

## Verification

Passed during the round:

- `npx tsx scripts/test-pantry-packs.ts`
- `npx tsx scripts/test-pantry-builder.ts`
- `npx tsx scripts/report-pantry-lightning-status.ts`

Final verification passed:

- `npx tsx scripts/verify-pantry-governance.ts`
- `npx tsx scripts/test-pantry-packs.ts`
- `npx tsx scripts/test-pantry-builder.ts`
- `npx tsx scripts/test-matcher-invariants.ts`
- `npm run typecheck`
- `npm run lint`

## Next Move

The purchase-history pack proves the new source is valuable, but most bought items are either already covered, branded, or need review-specific handling. Next best moves:

- build a review packet for branded/repeat grocery items such as Spindrift, Casa Sanchez salsa/chips, Oatly, REBBL, Rao's, Jimmy Dean, and 365 products;
- add a second purchase-history USDA pack focused on exact unbranded staples that survived this scan;
- improve duplicate/alias handling for purchased variants like Hass avocado, broccoli crowns, tomato-on-vine, cherry/grape tomatoes, and eggs.

Keep live applies under `--max-insert=25` and do not commit the raw purchase CSV.
