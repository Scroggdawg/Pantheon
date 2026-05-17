# Pantheon S28 Hive Anchor Alias Lightning 1

Date: 2026-05-17
Author: Codex on Hive
Status: Partial anchor unlock completed; verification/commit pending.

## Summary

This round executed the planned generic anchor + alias unlock pass, but kept the apply conservative. It added one safe USDA raw tomato anchor and used it to unlock tomato-family purchase-history aliases. Bagel and cooked brown rice remained blocked because dry-runs did not produce clean generic anchors.

Current live status after the apply:

- products: 204
- pantry-imported products: 143
- pantry import runs: 26
- pantry import candidates: 455
- latest product apply: `1cf5b0b7-bc99-4b3f-ba8b-7b23b6f8c70d`, completed

## New Pack

Added:

- `data/pantry/packs/generic-anchor-alias-unlock-1.json`

Current pack target:

- `tomatoes raw`

The pack was narrowed to tomato only after bagel and brown rice produced unsafe/non-generic candidates.

## Product Apply

Applied from dry-run:

- `1cf5b0b7-bc99-4b3f-ba8b-7b23b6f8c70d`

Inserted 1:

- `Tomatoes, grape, raw`

Why this is acceptable:

- Luke explicitly approved cherry/grape/vine tomatoes as generic tomato-equivalent if macros are close.
- The row is raw USDA Foundation, not canned, crushed, sauce, prepared, branded, or restaurant.
- The alias layer now treats it as the practical raw tomato anchor.

Not applied:

- `bagel plain -> Yogurt, plain, nonfat`
- `brown rice cooked -> Flour, rice, brown`

Additional query tuning also exposed:

- `bagel -> Bagels, wheat`
- `rice brown cooked no added fat -> Rice, brown, parboiled, cooked, UNCLE BENS`
- a transient USDA API path that could see FNDDS rows, but not consistently enough to keep as importer behavior this round

Those were not applied.

## Alias Apply

Updated:

- `data/pantry/generic-aliases-amazon-1.json`

Tomato aliases now target:

- `Tomatoes, grape, raw`

Applied 8 new aliases:

- `tomato on the vine raw`
- `tomato on the vine`
- `vine on tomato`
- `organic tomato on the vine`
- `cherry tomatoes raw`
- `cherry tomatoes`
- `grape tomatoes raw`
- `grape tomatoes`

Still blocked:

- `everything bagel` because no clean generic bagel product anchor exists.
- `brown basmati rice cooked` because no clean cooked brown rice product anchor exists.

## Verification

Passed during the round:

- `npx tsx scripts/verify-pantry-governance.ts`
- `npx tsx scripts/test-pantry-packs.ts`
- `npx tsx scripts/test-pantry-builder.ts`
- `npx tsx scripts/report-pantry-lightning-status.ts`
- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-amazon-1.json`
- `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-amazon-1.json --apply --allow-alias-writes --max-alias=25`

## Next Move

Move to Instacart intake unless Luke specifically wants a deeper brown-rice/bagel resolver first.

For Instacart:

- keep the raw export local and uncommitted;
- count rows, unique items, repeats, and discard/review buckets;
- prefer alias/rejection improvements before product additions;
- add USDA anchors only when repeated items are personally relevant and cleanly generic.
