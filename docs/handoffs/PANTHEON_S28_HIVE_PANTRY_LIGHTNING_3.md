# Pantheon S28 Hive Pantry Lightning 3

Date: 2026-05-17
Author: Codex on Hive
Status: Lightning round completed; code changes ready for verification/commit.

## Summary

This round created a sharper USDA-only pack for high-probability Luke staples and applied two clean batches from it. The live pantry gained 11 additional USDA products, all under the active `--max-insert=25` cap.

Current live status after the applies:

- products: 175
- pantry-imported products: 114
- pantry import runs: 21
- pantry import candidates: 390
- latest apply: `28c4f32d-365a-4202-97e1-52afdabe0d7f`, completed

## New Pack

Added:

- `data/pantry/packs/lightning-usda-staples-1.json`

Purpose:

- Keep the next sprint focused on boring USDA staples likely to parse well from voice logging.
- Prioritize raw fruit, raw vegetables, cooked beans/grains, and simple proteins.
- Include count-unit grams for common spoken units such as mango, plum, carrot, beet, cup, tbsp, oz, and bread/tortilla pieces.

## Guard Updates

Added state/specificity modifiers to both USDA ranking and final risk classification:

- `without skin`
- `with salt`
- `includes`

Why:

- `russet potato raw` should not silently auto-approve to skin-specific potato rows unless the target asks for that specificity.
- `lentils cooked` should not silently auto-approve to salted rows when a plain cooked target was requested.
- `sourdough bread` should not silently auto-approve to broad "includes sourdough" bread rows.

Tests were added in `scripts/test-pantry-builder.ts`.

## Applied Batches

### Lightning USDA Staples 1 offset 0

Run:

- `7e8e18a5-6aed-4047-9ac4-53de4b8217b7`

Inserted 8:

- Mango, raw
- Plum, raw
- Cherries, raw
- Carrots, raw
- Asparagus, raw
- Beans, snap, green, raw
- Radishes, raw
- Beets, raw

### Lightning USDA Staples 1 offset 25

Run:

- `28c4f32d-365a-4202-97e1-52afdabe0d7f`

Inserted 3:

- Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt
- Beans, kidney, red, mature seeds, cooked, boiled, without salt
- Bulgur, cooked

## Dry-Run Notes

Before the guard fixes, the first dry-run exposed auto-approved potato and lentil specificity. Those rows were not applied.

Offset 25 also exposed broad bread drift:

- `sourdough bread -> Bread, french or vienna (includes sourdough)`

That row was not applied; the `includes` guard moved that class out of auto-approval.

Other review/reject drift observed but not applied:

- `farro cooked -> Calamari, cooked`
- `salmon cooked -> Salmon nuggets`
- `rice vinegar -> Rice, black, unenriched, raw`
- `oatmeal cooked -> Cookies, oatmeal, with raisins`

## Verification

Passed before apply:

- `npx tsx scripts/test-pantry-packs.ts`
- `npx tsx scripts/test-pantry-builder.ts`

Status after apply:

- `npx tsx scripts/report-pantry-lightning-status.ts`

Final verification passed:

- `npx tsx scripts/verify-pantry-governance.ts`
- `npx tsx scripts/test-pantry-packs.ts`
- `npx tsx scripts/test-pantry-builder.ts`
- `npx tsx scripts/test-matcher-invariants.ts`
- `npm run typecheck`
- `npm run lint`

## Next Move

The new pack has now run through its first 50 targets. The next high-yield move is another small USDA pack rather than grinding low-yield old windows:

- add a `lightning-usda-staples-2` pack with a fresh first window of exact raw/cooked targets,
- bias toward plain fruit/vegetable/bean/grain rows,
- avoid broad bread, seafood, branded, restaurant, and prepared-dish rows,
- keep live applies under `--max-insert=25`.

Do not raise the cap or apply review-required rows without explicit approval.
