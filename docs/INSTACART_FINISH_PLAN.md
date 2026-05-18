# Instacart Finish Plan

Date: 2026-05-17
Status: Final Instacart plan before Quartermaster.

## Current State

Instacart export:

- total items: 261
- exact covered: 88
- exact uncovered: 173

Current lanes:

- covered: 88
- needs branded product: 76
- review only: 57
- safe alias candidate: 30
- alcohol hold: 8
- non-food: 2

The `173` uncovered names should not be treated as `173` foods to add. Most of the safe generic value has already been harvested. The remaining high-value work is a small branded/exact-product pilot, then Quartermaster.

## Finish Principle

Do not force all Instacart rows into the pantry.

The goal is to prove the next workflow class: exact branded products for formulation-dependent foods. After that, Quartermaster should decide what matters based on real user behavior.

## Final Instacart Stage

### 1. Pick One Branded Pilot Cluster

Candidate clusters:

- frozen desserts: Yasso, GoodPop, Alden's, Kroger/Signature ice cream sandwiches;
- functional beverages: REBBL, Yerba Mate, Liquid I.V., Pedialyte, FITAID;
- sauces/condiments: soy sauce, fish sauce, barbecue sauce, Worcestershire, dressing;
- breads/bagels: Dave's bagels, white bread, baguette.

Recommended pilot: frozen desserts or functional beverages.

Reason: they are clearly formulation-specific, likely to recur, and unsafe to collapse into USDA generics.

### 2. Write Branded Nutrition Doctrine

Document:

- source of truth;
- when exact branded products are allowed;
- when to hold;
- no generic collapse for formulation-dependent foods;
- no alcohol/supplement writes;
- no LLM-estimated branded products.

### 3. Build A Small Pilot Pack

Target:

- 10 to 15 items max;
- exact nutrition source only;
- stable brand/product names;
- sane serving units;
- provenance preserved.

No broad writes from OFF, restaurant, alcohol, supplements, recipes, composites, or LLM estimates.

### 4. Dry-Run And Inspect

Every row must be inspected for:

- exact name;
- exact brand;
- serving size and unit;
- calories/macros sanity;
- provenance;
- no restaurant/composite/alcohol/supplement drift.

Stop if a new bad-match class appears.

### 5. Apply Only Clean Rows

Stay under the active cap. Commit docs, pack, status report, and verification.

### 6. Final Closeout

Write:

- `docs/handoffs/PANTHEON_S28_HIVE_INSTACART_CLOSEOUT.md`

Include:

- final coverage;
- products added;
- aliases added;
- held categories;
- why not all rows should be added;
- what Quartermaster should watch next.

## Expected Final Gain

Before Quartermaster:

- 10 to 15 exact branded products;
- possibly 5 to 10 aliases;
- a proven exact-product workflow;
- a clean handoff from Instacart mining to Quartermaster learning.

## Explicit Holds

Continue holding:

- alcohol;
- supplements;
- non-foods;
- recipe/composite prepared foods unless modeled as saved meals or exact products;
- dry package names aliased to cooked foods;
- dairy substitutes aliased to dairy products;
- cheeses where formulation/fat level matters;
- anything without a trusted nutrition source.

## Decision Point

After the branded pilot, stop Instacart mining and build Quartermaster.

Quartermaster should decide future additions by watching real logs, corrections, saves, latency, and failures.
