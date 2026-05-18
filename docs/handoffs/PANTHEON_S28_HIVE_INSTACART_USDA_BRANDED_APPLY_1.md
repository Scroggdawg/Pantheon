# Pantheon S28 Hive Instacart USDA Branded Apply 1

Date: 2026-05-18
Status: USDA Branded fallback pilot implemented and first condiment/sauce apply completed.

## Summary

Open Food Facts worked for the first frozen-dessert batch, but failed to find useful candidates for packaged beverages and condiments/sauces.

This round added a USDA Branded fallback lane and applied the first clean condiment/sauce candidates.

## Tooling Added

Added:

- `scripts/plan-instacart-usda-branded-pilot.ts`
- `scripts/apply-instacart-usda-branded-pilot.ts`

The USDA planner:

- reads the local Instacart CSV;
- excludes already-covered product and alias names;
- supports `packaged-beverages` and `condiments-sauces`;
- searches USDA FDC `dataType=Branded`;
- scores candidates on brand match, core product-token coverage, UPC, serving size, serving unit, and macros;
- writes local-only JSON/markdown under `scripts/output/`;
- performs no live writes.

The USDA apply script:

- requires `--apply`, `--allow-branded-writes`, `--run-id`, `--run-file`, and `--max-insert`;
- writes provenance through `pantry_import_runs`;
- inserts exact product aliases;
- busts parse cache after writes.

## OFF Source Decision

OFF dry-run results:

- `packaged-beverages`: 20 searched, 0 ready candidates.
- `condiments-sauces`: 8 searched, 0 ready candidates.

Decision: do not force these lanes through OFF text search.

## USDA Branded Beverage Probe

Run:

- `18a0b2f8-4bed-480f-8158-8af3252efdf1`
- items searched: 20
- initially promising rows existed, but no live apply was done.

Important caution:

- Some USDA Branded beverage search results look exact but have questionable macro scaling for drinks.
- Example: a REBBL result produced implausibly high protein/carbs/fat after the current per-serving calculation.
- Beverage rows need a detail-record parsing pass before live apply.

## USDA Branded Condiment/Sauce Probe

Calibrated run:

- `4c764abf-20b4-4736-9ee6-98d497f0d6b7`
- items searched: 8
- ready exact candidates: 4
- held for review: 4

The tightened scorer correctly held:

- Bionaturae tomato paste, because USDA returned Bionaturae spaghettini as the brand match;
- Thai Kitchen fish sauce, because the brand match was red curry sauce and the fish-sauce match was under Simply Asia;
- Botticelli roasted garlic pasta sauce, because exact product rows were other brands;
- Kikkoman less sodium soy sauce, because the Kikkoman match was not reduced/less sodium.

## Live Apply

Command:

```bash
npx tsx scripts/apply-instacart-usda-branded-pilot.ts --apply --allow-branded-writes --run-id=4c764abf-20b4-4736-9ee6-98d497f0d6b7 --run-file=scripts/output/instacart-usda-branded-pilot-4c764abf-20b4-4736-9ee6-98d497f0d6b7.json --max-insert=5
```

Result:

- inserted products: 4
- inserted aliases: 7
- latest apply: `4c764abf-20b4-4736-9ee6-98d497f0d6b7`
- status: completed

## Products Added

| Product | Brand | FDC ID | UPC | Unit | Serving | Macros |
| --- | --- | ---: | --- | --- | --- | --- |
| Marukan Seasoned Gourmet Rice Vinegar | Marukan | `2084992` | `070641000110` | tbsp | 15g | 25.05 cal, 0P, 6C, 0F |
| Sweet Baby Ray's Barbecue Sauce Original | Sweet Baby Ray's | `2013494` | `013409515839` | tbsp | 36g | 69.84 cal, 0P, 16.99C, 0F |
| Lea & Perrins The Original Worcestershire Sauce | Lea & Perrins | `1514633` | `051600000044` | tsp | 5g | 5 cal, 0P, 1C, 0F |
| Kraft Classic Catalina Dressing | Kraft | `2210849` | `021000644698` | tbsp | 33g | 90.09 cal, 0P, 9.01C, 6.01F |

## Coverage Impact

After this apply:

- products loaded: 220
- active aliases loaded: 574
- exact Instacart coverage: 97 / 261
- uncovered: 164
- Condiments & Sauces coverage: 5 / 20
- needs branded product: 67

## Verification

Passed:

- `npx tsx scripts/report-pantry-lightning-status.ts`
- `npx tsx scripts/report-instacart-pantry-coverage.ts --csv=/Users/scroggdawg/Downloads/instacart_food_items.csv --limit=8`
- `npm run typecheck`
- `npm run lint`
