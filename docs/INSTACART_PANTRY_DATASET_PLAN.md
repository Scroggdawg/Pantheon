# Instacart Pantry Dataset Plan

Date: 2026-05-17
Status: Active campaign plan for making Luke's Instacart export useful without committing the raw export.

## Aim

Use the Instacart item catalog as Luke's grocery fingerprint. The point is not to import every row. The point is to teach Pantheon the foods, grocery vocabulary, brand wrappers, and ambiguity classes that show up in Luke's real life.

Success means Pantheon becomes:

- faster, because common grocery names resolve without hunting;
- more accurate, because safe generics route to trusted anchors instead of branded guesses;
- more predictive, because parser/search can prefer foods that Luke actually buys;
- safer, because branded/prepared/alcohol/supplement rows are visibly held instead of quietly polluting the pantry.

## Current Baseline

The local file is:

- `/Users/scroggdawg/Downloads/instacart_food_items.csv`

The raw CSV stays local and uncommitted. The first Instacart round found:

- rows: 261
- exact unique item names: 261
- exact repeats: 0
- initial exact coverage: 6 / 261
- post-round-1 exact coverage: 54 / 261
- live writes so far: 50 aliases, 3 USDA product anchors

## Operating Model

Treat the dataset as four different assets:

- **Alias source:** store/brand/package names that should point at trusted generic foods.
- **Anchor backlog:** simple foods that need a USDA product before aliases can safely attach.
- **Branded backlog:** products whose nutrition depends on formulation and should not collapse blindly.
- **Regression corpus:** real names and spoken variants that should keep resolving as Pantheon evolves.

## Action Lanes

Every row should end in one lane:

- `covered`: already exact-covered by a product or active alias.
- `safe_alias_candidate`: same practical food, same prep state, no meaningful macro or serving ambiguity.
- `needs_usda_anchor`: simple food is useful, but the correct target product does not exist yet.
- `needs_branded_product`: nutrition depends on the exact branded/prepared formulation.
- `review_only`: plausible food, but current evidence is not enough for a write.
- `alcohol_hold`: alcohol or cocktail-adjacent; no pantry write in this campaign.
- `non_food`: household, wellness, or not useful for food logging.

## Equivalence Doctrine

Use a generic alias when all are true:

- same practical food;
- same prep state;
- same edible portion;
- no raw/cooked, dry/cooked, fried/raw, light/full-fat, leanness, yolk/white, smoked/raw, pickled/raw, or composite mismatch;
- brand/store/organic/packaging wording is not the source of macro difference;
- calories and primary macros are roughly within Luke's practical tolerance: about 10% or 10 kcal per 100g, with no structural macro shift.

Hold or create a specific product when:

- the item is a frozen meal, sauce, dessert, cereal, protein item, beverage, prepared deli item, or branded formulation;
- the serving shape is part of the food identity;
- the target product does not preserve the meaningful state, such as raw, cooked, nonfat, low-fat, unsalted, seeded, or skin/peel.

## Long Lightning Round Loop

For a multi-hour session:

1. Run the coverage report.
2. Pick one lane and one category cluster.
3. Build a capped alias or USDA-anchor batch.
4. Dry-run.
5. Inspect all inserts and holds.
6. Apply only green/yellow rows under the active cap.
7. Add a guard/test immediately if a bad auto-approval class appears.
8. Re-run coverage, governance, pantry tests, typecheck/lint when code changed.
9. Commit/push durable changes.
10. Update a handoff only when the batch changes live data, doctrine, or next decisions.

## High-Value Category Strategy

Produce should be mined first. It gives high speed, low macro variance, and strong spoken-logging wins. The remaining work is mostly aliases plus a few doctrine calls: cucumber peel, pepper seeds, tomato family, berries, pears, cabbage, citrus, herbs.

Dairy and eggs come second. Eggs, half-and-half, cottage cheese, plain yogurt, skyr, buttermilk, and milk variants are high-value. Fat level and flavoring must be preserved.

Baking and grains are third. Flour, sugar, oats, rice, pasta, and bread deserve coverage, but bread/rice/pasta variants need more careful equivalence decisions than produce.

Meat and seafood are useful but conservative. Preserve raw/cooked, smoked/raw, cut, leanness, and breaded/fried state.

Beverages, frozen, prepared foods, sauces, snacks, and cereals mostly become a branded backlog. Some can become aliases, but most need exact nutrition or review packets.

Alcohol, supplements, and non-food rows are hold/ignore lanes for this campaign.

## Measurement

After every meaningful batch, report:

- total rows, unique rows, exact repeats;
- exact coverage overall;
- product vs alias coverage;
- category coverage;
- action-lane counts;
- net aliases/products added;
- bad-match classes caught;
- top unresolved decisions.

Use:

```bash
npx tsx scripts/report-instacart-pantry-coverage.ts --csv=/Users/scroggdawg/Downloads/instacart_food_items.csv
```

## Stop Conditions

Stop before applying:

- branded/OFF/restaurant/alcohol/supplement/recipe/composite/LLM-estimated product writes;
- cap increases;
- destructive data changes;
- schema/data migrations;
- native EAS/release flows;
- any novel auto-approved bad-match class until a guard or doctrine decision exists.

## Next Concrete Moves

1. Run coverage report and snapshot the post-round-1 baseline.
2. Build `generic-aliases-instacart-3.json` from the safest remaining produce/dairy/baking rows.
3. Decide cucumber peel and seeded hot pepper doctrine before aliasing those rows broadly.
4. Create the first branded backlog doc for frozen/prepared/beverage/sauce items.
5. Promote stable high-value names into parser/matcher regression tests once alias coverage settles.
