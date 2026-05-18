# Pantheon S28 Hive Instacart Branded Pilot 2

Date: 2026-05-18
Status: Additional branded pilot lanes probed; no live writes.

## Summary

After the first five frozen dessert products were applied, the next Instacart pass tested whether the same Open Food Facts text-search lane could handle other branded packaged foods.

No products or aliases were written in this round.

## Tooling Change

Extended:

- `scripts/plan-instacart-branded-pilot.ts`

New lanes:

- `packaged-beverages`
- `condiments-sauces`

Also fixed macro gating so zero-calorie beverages with 0P / 0C / 0F can be considered macro-complete instead of automatically rejected.

Updated:

- `scripts/apply-instacart-branded-pilot.ts`

Apply metadata now reads the pilot lane from the artifact and writes lane-specific `canonical_category` values instead of assuming every branded pilot is a frozen dessert.

## Packaged Beverages Probe

Command:

```bash
npx tsx scripts/plan-instacart-branded-pilot.ts --csv=/Users/scroggdawg/Downloads/instacart_food_items.csv --lane=packaged-beverages --limit=20 --candidates=5
```

Output:

- run id: `76822613-88a8-444b-9d9a-a7c550d1af27`
- items searched: 20
- ready exact candidates: 0
- needs manual review: 20

OFF text search returned no candidates for the tested beverage names, including REBBL, Yerba Madre, coconut water, Diet Coke, Dr Pepper Zero Sugar, Silk chocolate almond milk, FITAID, Martinelli's, and related products.

## Condiments And Sauces Probe

Command:

```bash
npx tsx scripts/plan-instacart-branded-pilot.ts --csv=/Users/scroggdawg/Downloads/instacart_food_items.csv --lane=condiments-sauces --limit=20 --candidates=5
```

Output:

- run id: `0547a19a-c8c2-49b5-937b-57fcfd61e79c`
- items searched: 8
- ready exact candidates: 0
- needs manual review: 8

OFF text search returned no candidates for the tested condiment/sauce names, including Bionaturae tomato paste, Thai Kitchen fish sauce, Kikkoman soy sauce, Sweet Baby Ray's barbecue sauce, Lea & Perrins Worcestershire, and Kraft Catalina.

## Decision

Do not force these through OFF.

The first frozen-dessert lane proved that OFF can support exact branded writes when it has good records. These two lanes show that OFF text search is not reliable enough as the only branded source.

Recommended next Instacart path:

1. Add a USDA Branded fallback pilot for packaged beverages and condiments.
2. Require exact brand/name fit, branded data type, complete macros, positive serving size, and sensible serving unit.
3. Keep the apply cap at 5.
4. If USDA Branded is also weak, leave these rows for Quartermaster/human review rather than guessing.
