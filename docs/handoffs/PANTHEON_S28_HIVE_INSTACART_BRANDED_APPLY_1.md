# Pantheon S28 Hive Instacart Branded Apply 1

Date: 2026-05-17
Status: First capped branded product apply completed.

## Summary

Luke approved the first five vetted branded products from the Instacart frozen-dessert pilot.

This was the first live branded-product write in the Instacart campaign. It was intentionally capped at five and limited to exact Open Food Facts matches with:

- barcode present;
- exact/strong brand match;
- complete calories/protein/carbs/fat;
- positive serving size;
- serving unit matching the natural item unit, e.g. `bar`;
- no `serving_unit_mismatch` warnings.

## Script Added

Added:

- `scripts/apply-instacart-branded-pilot.ts`

The script requires all of:

- `--run-id=<pilot-run-id>`
- `--run-file=<local pilot json>`
- `--max-insert=5`
- `--apply`
- `--allow-branded-writes`

Dry-run mode prints exact insert payloads and writes nothing.

## Live Apply

Command:

```bash
npx tsx scripts/apply-instacart-branded-pilot.ts --apply --allow-branded-writes --run-id=90da9515-918c-4c82-a9db-a5302fabdc91 --run-file=scripts/output/instacart-branded-pilot-90da9515-918c-4c82-a9db-a5302fabdc91.json --max-insert=5
```

Result:

- inserted products: 5
- inserted aliases: 15
- latest apply run: `90da9515-918c-4c82-a9db-a5302fabdc91`
- run status: completed

## Products Added

| Product | Brand | Barcode | Unit | Serving | Macros |
| --- | --- | --- | --- | --- | --- |
| Yasso Frozen Greek Yogurt Bars Fudge Brownie | Yasso | `0851035003630` | bar | 65g | 100 cal, 5P, 20C, 0.5F |
| Yasso Frozen Greek Yogurt Bars Black Raspberry Chip | Yasso | `0851035003562` | bar | 62g | 100 cal, 4P, 16C, 2F |
| Ben & Jerry's Cookie Dough Ice Cream Bars | Ben & Jerry's | `0076840004676` | bar | 59g | 200 cal, 3P, 22C, 12F |
| Van Leeuwen Strawberry Shortcake Ice Cream Bar | Van Leeuwen | `0850005872689` | bar | 57g | 163 cal, 2P, 15C, 10F |
| Alden's Organic Fudge Bars | Alden's Organic | `0072609741233` | bar | 60g | 100 cal, 2P, 14C, 4.5F |

## Coverage Impact

Before:

- products loaded: 211
- active aliases loaded: 552
- exact Instacart coverage: 88 / 261
- Frozen coverage: 0 / 20
- needs branded product: 76
- uncovered: 173

After:

- products loaded: 216
- active aliases loaded: 567
- exact Instacart coverage: 93 / 261
- Frozen coverage: 5 / 20
- needs branded product: 71
- uncovered: 168

## Unit Doctrine

For branded packaged foods, one product row should preserve the label serving unit and its gram weight.

Example:

- `unit = bar`
- `serving_size_g = 65`
- `unit_alternatives = [{ unit: "bar", grams: 65, source: "off" }, { unit: "g", grams: 1, source: "standard" }]`

This lets Pantheon support both:

- natural speech/count logging: "one Yasso fudge brownie bar";
- weighed logging: "65 grams Yasso fudge brownie" or fractional weights.

This is materially equivalent to MacroFactor's model: a branded/custom food has nutrition for a serving, the serving has a name and gram or ml weight, and the user can log by serving/count or by mass/volume.

## Verification

Passed after apply:

- `npx tsx scripts/report-pantry-lightning-status.ts`
- `npx tsx scripts/report-instacart-pantry-coverage.ts --csv=/Users/scroggdawg/Downloads/instacart_food_items.csv --limit=8`
- `npm run typecheck`
- `npm run lint`
