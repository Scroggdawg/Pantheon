# Pantheon S28 Hive Instacart Branded Final 1

Date: 2026-05-18
Status: Final Instacart branded source pilots completed; stop product writes and move to Quartermaster next.

## Summary

This round finished the remaining planned Instacart branded source probes after the first OFF frozen-dessert batch and USDA Branded condiment batch.

The main change was making the USDA Branded pilot detail-aware. USDA search rows sometimes expose nutrient fields in mixed per-serving/per-100g shapes, especially beverages. The planner now fetches USDA detail records before scoring and records the macro mode used for each candidate.

Live writes in this round:

- packaged beverages: 4 products, 8 aliases;
- snacks/bread: 3 products, 6 aliases.

Combined with the earlier Instacart work, Pantry now has 16 new real purchase-history products from the branded pilots.

## Tooling Changes

Updated:

- `scripts/plan-instacart-usda-branded-pilot.ts`
- `scripts/apply-instacart-usda-branded-pilot.ts`

Planner changes:

- fetches USDA detail records from `/fdc/v1/food/{fdcId}` before scoring;
- supports `packaged-beverages`, `condiments-sauces`, and `snacks-bread`;
- handles USDA detail-style nutrient fields (`amount`, `nutrient.id`, derivation codes);
- resolves serving macros using `scaled_all`, `scaled_energy_unscaled_macros`, or `unscaled_all`;
- adds required-token guards for high-risk terms like apple, orange, pulp, peanut, hazelnut, sour, grape, avocado, greens, maca, mocha, and bluephoria;
- adds extra-variant guards for terms like fajita, honey, chipotle, baked, scoops, scoop, and restaurant.

Apply changes:

- writes `branded_snack_bread` category for the snack/bread lane.

## Packaged Beverage Apply

Run:

- `17f6d72e-ca2a-47b1-a40c-87c63f0a227b`

Result:

- inserted products: 4
- inserted aliases: 8
- existing exact product: 1

Products added:

| Product | Brand | FDC ID | UPC | Serving | Macros |
| --- | --- | ---: | --- | --- | --- |
| REBBL Revive Reishi Chocolate | REBBL | `2364173` | `858148003427` | 236g | 110.92 cal, 2.01P, 16C, 5.99F |
| C2O Coconut Water with Pulp | C2O | `1896776` | `090478500027` | 240g | 50.4 cal, 0P, 13.01C, 0F |
| Silk Dairy Free Dark Chocolate Almond Milk Gluten Free | Silk | `2756782` | `00025293001190` | 240g | 100 cal, 1P, 19C, 2F |
| Martinelli's Sparkling Cider | Martinelli's | `2109116` | `041244999668` | 240g | 139.2 cal, 1.01P, 34.99C, 0F |

Existing exact product recognized:

- REBBL Protein Dark Chocolate, `2757401`.

Important holds:

- apple/orange juice mismatches;
- coconut water rows missing `pulp`;
- zero-sugar mismatches;
- beverage rows with incomplete or suspicious serving data.

## Snacks/Bread Apply

Run:

- `42bab405-de10-4ae3-bc5e-43808d2f93bb`

Result:

- inserted products: 3
- inserted aliases: 6

Products added:

| Product | Brand | FDC ID | UPC | Serving | Macros |
| --- | --- | ---: | --- | --- | --- |
| Fritos Corn Chips The Original | Fritos | `1457572` | `00028400040037` | 28g | 159.88 cal, 2P, 16C, 10F |
| Tostitos Cantina Tortilla Chips Thin & Crispy | Tostitos | `1595517` | `028400163361` | 28g | 150.08 cal, 2P, 18C, 8F |
| Dave's Killer Bread Epic Everything Organic Bagels | Dave's Killer Bread | `1929355` | `013764028036` | 95g | 260.3 cal, 12P, 47C, 4.5F |

Important holds:

- Tostitos Original Scoops Party Size matched wrong variants such as restaurant/fajita/scoops rows;
- Bimbo Pan Blanco did not produce a sufficiently exact brand/product match;
- Wonder Bread Classic White remained brand/product ambiguous.

## Coverage Impact

After the final branded pilots:

- products loaded: 227
- active aliases loaded: 588
- exact Instacart coverage: 104 / 261
- uncovered: 157
- Beverages coverage: 6 / 40
- Frozen coverage: 5 / 20
- Condiments & Sauces coverage: 5 / 20
- Snacks coverage: 3 / 7
- Bakery & Bread coverage: 2 / 5
- needs branded product: 61
- review only: 56

Compared with the start of the branded source work:

- exact Instacart coverage improved from 88 / 261 to 104 / 261;
- products increased from 211 to 227;
- aliases increased from 552 to 588.

## Decision

Stop the Instacart product-write phase here.

The branded pilots proved the pattern:

- exact branded writes are valuable when the source record is exact;
- OFF and USDA both require strict lane-specific guards;
- many remaining Instacart rows are better handled by Quartermaster review, user-history analysis, or future specific product sourcing than by widening auto-approval.

Next planned work:

1. Finish any remaining verification and push this batch.
2. Start Quartermaster as the feedback-analysis layer.
3. Use Quartermaster to decide which remaining Instacart gaps deserve source work, alias work, parser repair, or no action.

## Verification

Passed:

- `npx tsx scripts/report-pantry-lightning-status.ts`
- `npx tsx scripts/report-instacart-pantry-coverage.ts --csv=/Users/scroggdawg/Downloads/instacart_food_items.csv --limit=10`
- `npx tsx scripts/verify-pantry-governance.ts`
- `npm run typecheck`
- `npm run lint`
