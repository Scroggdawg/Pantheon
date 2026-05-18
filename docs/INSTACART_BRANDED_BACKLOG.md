# Instacart Branded Backlog

Date: 2026-05-17
Status: Planning backlog. No branded product writes are approved by this document.

## Purpose

The Instacart export has a large group of foods that are valuable for Luke's real logging life, but not safe to collapse into generic USDA anchors. This backlog keeps those items useful without letting them pollute Pantry Lightning.

Current post-anchor-round lanes:

- covered: 84
- needs_branded_product: 76
- review_only: 57
- safe_alias_candidate: 34
- alcohol_hold: 8
- non_food: 2

## Doctrine

Use exact branded/product nutrition when the formulation drives calories or macros:

- frozen desserts and bars;
- ready-to-drink protein or functional beverages;
- electrolyte mixes and hydration products;
- prepared sushi, poke, bowls, sandwiches, pizza, soups, and meals;
- sauces, dressings, dips, condiments, and hummus;
- cereals, granola, snack bars, chips, crackers, and breads with meaningful formulation differences;
- deli meats, sausages, smoked fish, breaded/fried proteins, and prepared poultry.

Do not write these as generic USDA product rows unless Luke explicitly accepts the approximation.

## Priority Clusters

### Frozen Desserts

Examples include Yasso bars, ice cream sandwiches, fudge bars, and dairy-free frozen dessert bars.

Recommended lane: exact branded products later. These are high-frequency, high-formulation items where generic aliases would be too loose.

### Functional Beverages

Examples include REBBL drinks, yerba mate variants, FITAID variants, Pedialyte, Liquid I.V., soda, sparkling water, teas, and coconut water variants.

Recommended lane: split into exact products where calories/macros matter, ignore or lightweight aliases for zero-calorie drinks if the product semantics are clear.

### Prepared Foods

Examples include sushi rolls, poke bowls, roasted chicken, soups, breakfast sandwiches, burritos, pizza, and smoothies.

Recommended lane: saved-meal or exact-product/composite work, not generic pantry aliases.

### Sauces And Condiments

Examples include fish sauce, soy sauce, barbecue sauce, Catalina dressing, Worcestershire sauce, pasta sauce, mustard, mayonnaise, salsa, hummus, tomato paste, and chili paste.

Recommended lane: exact products when serving calories/sodium matter; generic anchors only for very stable base ingredients after review.

### Breads And Bakery

Examples include white bread, baguette, bagels, pie crusts, biscuits, and gluten-free baking flour.

Recommended lane: exact branded product or narrowly reviewed generic. Bread and crust calories vary too much for broad aliasing.

### Proteins

Examples include raw chicken breast, salmon fillet, ground turkey breast, sausage, deli turkey, prosciutto, prepared roasted chicken, ahi tuna, and smoked/prepared fish.

Recommended lane: preserve raw/cooked, smoked/raw, leanness, cut, breading, and prepared state. Use USDA anchors only when exact state is preserved.

## Explicit Holds

Hold without writes:

- alcohol;
- supplements;
- non-food household/wellness rows;
- recipe/composite prepared foods;
- rows whose exact identity depends on a package label we have not inspected.

## Next Work

1. Finish safe aliases and missing USDA anchors first.
2. Create a small exact-product pilot only after deciding the source of truth for branded nutrition.
3. Use this backlog to build Luke-facing review packets, grouped by cluster instead of dumping all held rows at once.
4. Promote accepted branded products into parser regression tests only after their nutrition source is durable.
