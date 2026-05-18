# Pantheon S28 Hive Instacart Lightning 2

Date: 2026-05-17
Author: Codex on Hive
Status: Instacart campaign infrastructure and alias batch 3 completed.

## Summary

This round turned the Instacart dataset from a one-off CSV into a reusable campaign surface.

Added:

- `docs/INSTACART_PANTRY_DATASET_PLAN.md`
- `scripts/report-instacart-pantry-coverage.ts`
- `data/pantry/generic-aliases-instacart-3.json`

The raw Instacart CSV remains local and uncommitted:

- `/Users/scroggdawg/Downloads/instacart_food_items.csv`

## Live Delta

Applied 25 additional Instacart-derived aliases from:

- `data/pantry/generic-aliases-instacart-3.json`

The batch was dry-run first:

- aliases: 25
- planned inserts: 25
- target match errors: 0
- conflicts: 0
- max alias cap: 25

Then applied live with:

```bash
npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-instacart-3.json --apply --allow-alias-writes --max-alias=25
```

## Coverage Lift

Post-round-1 coverage:

- exact Instacart coverage: 54 / 261
- active aliases loaded: 511
- Produce: 36 / 68
- Dairy & Eggs: 12 / 37
- Baking: 0 / 11

After this round:

- exact Instacart coverage: 79 / 261
- active aliases loaded: 536
- Produce: 51 / 68
- Dairy & Eggs: 19 / 37
- Baking: 3 / 11

Net lift:

- +25 exact-covered Instacart names
- Produce moved from 53% to 75%
- Dairy & Eggs moved from 32% to 51%
- Baking moved from 0% to 27%

## Applied Alias Themes

This batch covered safe grocery vocabulary:

- potted basil -> `Basil, raw`
- blueberry brands -> `Blueberries`
- plural shallots -> `Shallots, raw`
- egg brand/color/housing variants -> `Eggs - Large`
- Bosc pear variants -> `Pear, raw`
- plural lemons -> `Lemon, raw`
- half-and-half store brand -> `Cream, half and half`
- Chinese parsley wording -> `Cilantro, raw`
- Hass avocado variants -> `Avocado, raw`
- mini-cut carrots -> `Carrots, baby, raw`
- singular red bell pepper -> `Bell Peppers`
- exact Instacart-normalized flour/sugar/buttermilk spellings -> existing anchors

## Held On Purpose

Still held:

- cucumber, because the current anchor question is peel/edible portion;
- serrano peppers, because no safe anchor exists yet;
- mint and lemongrass, because previous USDA searches drifted into cocktails/prepared soup;
- butter, because prior dry-run exposed pretzel/butter bad-match drift;
- rice, because current anchors are not generic white/jasmine rice;
- cheese variants, because shred/blend/fat/brand formulation can matter;
- frozen/prepared foods, beverages, sauces, alcohol, supplements, and non-foods.

## New Measurement Tool

Run:

```bash
npx tsx scripts/report-instacart-pantry-coverage.ts --csv=/Users/scroggdawg/Downloads/instacart_food_items.csv
```

It reports:

- row count, unique names, repeats;
- product vs alias exact coverage;
- category coverage;
- action-lane counts;
- uncovered samples by lane.

Current action lanes after this round:

- covered: 79
- needs_branded_product: 76
- review_only: 57
- safe_alias_candidate: 39
- alcohol_hold: 8
- non_food: 2

## Verification

Passed:

- `npx tsx scripts/report-instacart-pantry-coverage.ts --csv=/Users/scroggdawg/Downloads/instacart_food_items.csv --limit=20`
- `npx tsx scripts/report-pantry-lightning-status.ts`
- `npx tsx scripts/verify-pantry-governance.ts`
- `npm run typecheck`
- `npm run lint`

Live pantry status after the alias apply:

- products: 207
- pantry-imported products: 146
- pantry import runs: 27
- pantry import candidates: 460
- latest product apply: `f476173c-fe67-41cb-8fff-370eb8684351`, completed

## Next Move

Recommended next long-session sequence:

1. Create an Instacart USDA anchor pack for cucumber, generic white/jasmine rice, iodized salt, vanilla extract, mint, lemongrass, serrano, and butter, but dry-run only until safe candidates are inspected.
2. Patch guards if mint/lemongrass/butter/pepper searches produce another novel bad-match class.
3. Build `generic-aliases-instacart-4.json` only after the missing anchors exist.
4. Create a branded backlog doc for frozen desserts, REBBL/Yerba Mate/Pedialyte/Liquid I.V., sauces, prepared sushi/poke, and breads.
5. Promote the safest Instacart names into matcher regression tests once coverage stabilizes.
