# Pantheon S28 Product Identity Data Repair 1

Date: 2026-05-20
Owner: Backend / Quartermaster lane
Status: Applied successfully.

## Plain English

This repair removes stale hourly-memory refs from seven favorite saved-meal components.

Five rows map to reviewed product identities. Two 365 cheese rows clear the ref to `null` because no reviewed product row exists, and null is safer than keeping an hourly wrapper.

## Scope

Script:

```bash
npx tsx scripts/apply-reviewed-product-identity-repairs.ts
npx tsx scripts/apply-reviewed-product-identity-repairs.ts --apply
```

Table touched on apply:

- `saved_meals`

Column touched:

- `foods_json`

No product rows are created.
No migrations are run.
No deploy is required.

## Apply Result

Applied on 2026-05-20.

Result:

- 7 reviewed repairs applied
- 5 hourly refs mapped to product refs
- 2 hourly refs cleared to `null`
- 0 product rows created
- 0 migrations run
- 0 deploys required

Post-apply verification:

- `plan-saved-meal-source-ref-repair` dropped from 10 items to 5
- hourly wrapper refs inside saved meals dropped out of the Quartermaster worklist
- remaining 5 items are intentional review/null cases:
  - 2 cheese rows should stay null until a reviewed 365 cheese product exists
  - Churro remains null
  - Poke sauce remains null
  - ahi tuna remains null

## Repairs

- Avocado hourly wrapper -> `Avocado, raw`
- Isopure whey protein isolate hourly wrapper -> `Isopure Low Carb Protein Powder - Chocolate`
- Whole eggs hourly wrapper -> `Eggs - Large`
- Egg whites hourly wrapper -> `Egg, white, raw, fresh`
- cooked white rice hourly wrapper -> `Rice, white, long-grain, regular, enriched, cooked`
- 365 Mexican style blend cheese 0.25 oz hourly wrapper -> `null`
- 365 Mexican style blend cheese 1 oz hourly wrapper -> `null`

## Stop Rules

- Do not apply if any expected current source_ref has changed.
- Do not apply if any saved meal name or food name differs.
- Do not create or guess a 365 cheese product in this pass.
- Do not touch Churro, Poke sauce, or ahi tuna because they are already null.
- Do not touch Harmless Harvest coconut water in this pass.

## Verification

After apply, run:

```bash
npx tsx scripts/plan-saved-meal-source-ref-repair.ts
npx tsx scripts/report-saved-meal-source-ref-review.ts
npx tsx scripts/report-quartermaster-product-worklist.ts
```

Expected result:

- hourly wrapper refs inside saved meals should drop to zero
- missing source refs may remain where null is intentionally safer than guessing

## Quartermaster Track Footer

Quartermaster Track: Leg 11 - Reviewed Data Repair
Grade target: A-
Plain English: This is the first small production data repair pass, limited to exact stale wrapper cleanup.
