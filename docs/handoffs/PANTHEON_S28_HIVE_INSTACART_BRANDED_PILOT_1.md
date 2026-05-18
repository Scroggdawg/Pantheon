# Pantheon S28 Hive Instacart Branded Pilot 1

Date: 2026-05-17
Status: Read-only branded pilot tooling and first frozen-dessert OFF probe completed.

## Summary

This was the first narrow branded-product pilot after the Instacart alias and USDA-anchor rounds.

No pantry/product rows were written. The point was to test whether Open Food Facts can safely source exact branded products from Luke's Instacart history without turning the pantry into guessed branded sludge.

## Tool Added

Added:

- `scripts/plan-instacart-branded-pilot.ts`

The tool:

- reads the local Instacart CSV;
- excludes names already covered by exact product or alias;
- selects a narrow pilot lane, currently `frozen-desserts`;
- queries Open Food Facts with brand-aware fallback search shapes;
- scores candidates for brand match, token overlap, complete macros, serving quantity, serving unit fit, nutriscore, and US availability;
- writes local-only markdown and JSON reports under `scripts/output/`;
- performs no live writes.

## Latest Run

Command:

```bash
npx tsx scripts/plan-instacart-branded-pilot.ts --csv=/Users/scroggdawg/Downloads/instacart_food_items.csv --lane=frozen-desserts --limit=15 --candidates=5
```

Output:

- run id: `90da9515-918c-4c82-a9db-a5302fabdc91`
- items searched: 12
- ready exact candidates: 5
- needs manual review: 7
- markdown: `scripts/output/instacart-branded-pilot-90da9515-918c-4c82-a9db-a5302fabdc91.md`
- json: `scripts/output/instacart-branded-pilot-90da9515-918c-4c82-a9db-a5302fabdc91.json`

## Ready Exact Candidates

These looked clean in OFF: exact brand, plausible exact product, complete macros, usable per-item serving unit.

| Instacart item | OFF product | Barcode | Serving | Macros |
| --- | --- | --- | --- | --- |
| Yasso Frozen Greek Yogurt Bars Fudge Brownie | fudge brownie frozen greek yogurt bars | `0851035003630` | 1 bar / 65g | 100 cal, 5P, 20C, 0.5F |
| Yasso Frozen Greek Yogurt Bars Black Raspberry Chip | black raspberry chip frozen greek yogurt bars | `0851035003562` | 1 bar / 62g | 100 cal, 4P, 16C, 2F |
| Ben & Jerry's Cookie Dough Ice Cream Bars | Cookie Dough Ice Cream Bar | `0076840004676` | 1 bar / 59g | 200 cal, 3P, 22C, 12F |
| Van Leeuwen Strawberry Shortcake Ice Cream Bar | STRAWBERRY SHORTCAKE FRENCH ICE CREAM BAR | `0850005872689` | 1 bar / 57g | 163 cal, 2P, 15C, 10F |
| Alden's Organic Fudge Bars | Chocolate Fudge Frozen Dessert Bar | `0072609741233` | 1 bar / 60g | 100 cal, 2P, 14C, 4.5F |

## Held For Review

These should not be written from this run.

- Yasso Chocolate Chip Cookie Dough returned no candidate in the final calibrated run, despite similar products existing in OFF.
- GoodPop Fudge n Vanilla Crunch returned no candidate.
- GoodPop Chocolate Fudge returned no candidate.
- Alden's Old School Vanilla Ice Cream Sandwich returned no candidate in the final run, even though an earlier run found a plausible OFF row. Treat this as OFF flakiness and re-probe before applying.
- Kroger mini/snowboard frozen dessert sandwiches returned no candidates.
- Signature SELECT mini frozen dessert sandwiches returned no candidates.

## Guard Learned

Serving unit matters as much as macro presence for branded bars/sandwiches.

The Ben & Jerry's search returned both:

- a per-bar candidate: 1 bar / 59g / 200 cal;
- a carton/package candidate: 1 carton / 236g / 800 cal.

The script now warns and downranks `serving_unit_mismatch` when an Instacart name implies a bar/pop/sandwich but OFF's serving unit is carton/serving/other. This prevents a very real logging failure class: one spoken "bar" accidentally becoming a whole box.

## Assessment

This pilot was successful as a source probe, not yet as a pantry expansion.

It shows branded exact products can be added safely in small batches when OFF has complete, item-level serving data. It also shows OFF coverage is uneven and flaky enough that branded products need a review/apply lane, not an automatic bulk lane.

Recommended next step:

1. Add a branded apply script only for candidates already present in a vetted pilot report.
2. Keep the cap tiny: 5 exact branded products for the first live branded apply.
3. Require barcode, brand match, complete macros, positive serving size, and serving-unit fit.
4. After apply, add aliases only for the exact Instacart display names that produced those products.
5. Re-run Instacart coverage and then move to Quartermaster.

## Verification

Passed:

- `npm run typecheck`
- `npm run lint`
- `npx tsx scripts/verify-pantry-governance.ts`
