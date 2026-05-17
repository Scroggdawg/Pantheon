# Pantheon S28 Hive Generic Alias Pass 1

Date: 2026-05-17
Author: Codex on Hive
Status: Generic alias pass completed; verification/commit pending.

## Summary

Luke shifted the next pantry move from product insertion to alias/generic rounding. This pass did not add products. It added parser-memory aliases so real purchase-history wording and natural voice phrases route to existing pantry products when the food is practically the same.

Live product counts are unchanged:

- products: 203
- pantry-imported products: 142
- pantry import runs: 25
- pantry import candidates: 455
- latest product apply: `086e121c-0944-4783-98a5-832651b7ec58`, completed

## Doctrine

Use a generic alias when:

- it is the same practical food;
- prep state matches;
- calories are within about 10% or 10 kcal per 100g;
- there is no structural macro difference.

Do not collapse:

- raw vs cooked;
- dry vs cooked;
- fried/breaded vs raw;
- light vs full-fat;
- whole egg vs yolk/white;
- meat leanness percentages;
- pickled vs raw when sodium/prep matters;
- branded prepared foods.

## New Alias Tooling

Added:

- `scripts/apply-generic-pantry-aliases.ts`

Default mode is read-only. Live alias writes require:

```bash
npx tsx scripts/apply-generic-pantry-aliases.ts --file=<alias-file.json> --apply --allow-alias-writes --max-alias=25
```

The script:

- resolves alias targets by exact normalized product name;
- refuses to write more than the alias cap;
- skips already-existing aliases;
- flags alias conflicts and missing target products;
- prints nearby target names for missing targets during dry-run;
- writes `food_identity_aliases` rows with `alias_type = generic_equivalent` and `source = pantry_generic_alias`.

## Applied Alias Batches

### Amazon Grocery Generic Aliases 1

File:

- `data/pantry/generic-aliases-amazon-1.json`

Applied 13 aliases:

- Hass avocado variants -> `Avocado, raw`
- broccoli crowns -> `Broccoli Florets`
- red grapes -> `Grapes, raw`
- tricolor/green bell pepper variants -> `Bell Peppers`
- whole wheat pita -> `Bread, pita`

Blocked because the library does not yet have a safe generic target product:

- tomato on the vine/cherry/grape tomato variants need a raw tomato product anchor;
- everything bagel needs a generic bagel product anchor;
- brown basmati rice cooked needs a cooked brown rice product anchor.

### Lightning Pantry Generic Aliases 1

File:

- `data/pantry/generic-aliases-lightning-1.json`

Applied 18 aliases:

- navel orange/oranges -> `Oranges, raw, navels`
- mandarin oranges/mandarins -> `Tangerines, (mandarin oranges), raw`
- medjool date/dates -> `Dates, medjool`
- bok choy -> `Cabbage, bok choy, raw`
- brussel/brussels sprouts -> `Brussels sprouts, raw`
- collard greens -> `Collards, raw`
- mustard greens -> `Mustard greens, raw`
- fennel bulb -> `Fennel, bulb, raw`
- butternut/acorn squash -> matching raw winter squash products
- green beans -> `Beans, snap, green, raw`
- garbanzo beans cooked -> cooked chickpeas
- red kidney beans cooked -> cooked red kidney beans
- bulgur wheat cooked -> `Bulgur, cooked`

Seven requested aliases in that file already existed and were skipped.

## Additional Fix

Updated `scripts/report-pantry-lightning-status.ts` so the next gate says `--max-insert=25`, not the outdated future/proposal cap of 50.

## Verification

Passed during the round:

- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-amazon-1.json`
- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-amazon-1.json --apply --allow-alias-writes --max-alias=25`
- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-lightning-1.json`
- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-lightning-1.json --apply --allow-alias-writes --max-alias=25`
- `npx tsx scripts/verify-pantry-governance.ts`
- `npx tsx scripts/report-pantry-lightning-status.ts`

## Next Move

The next highest-yield alias/product bridge is a tiny product-anchor round, not a blind alias round:

1. add safe generic anchors for `Tomatoes, raw`, generic bagel, and cooked brown rice if clean USDA rows can be found;
2. rerun `data/pantry/generic-aliases-amazon-1.json` so the blocked tomato/bagel/rice aliases become inserts;
3. continue mining purchase-history and dry-run artifacts for voice phrases that route to exact existing products.

Keep product writes under `--max-insert=25`. Do not write branded, restaurant, supplement, alcohol, recipe/composite, OFF, or LLM-estimated foods.
