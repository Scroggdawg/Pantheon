# Pantheon Product Identity Model

Date: 2026-05-20
Status: Backend / Quartermaster operating doctrine
Scope: pantry products, saved meals, barcode products, recipe/composite shortcuts, parser source refs, and Quartermaster repair packets.

## ELI5

Pantheon should not create a new food every time Luke says a different amount.

The durable thing is the food identity. The amount is just how much of that food he ate.

Examples:

- `Yasso bar` is one identity. `two Yasso bars` is quantity math.
- `Harmless Harvest coconut water` is one identity. `4 servings` is quantity math.
- `Isopure chocolate protein powder` and `Nutricost dextrose` are ingredient identities. A protein shake is composition logic built from those ingredients.
- `hourly_go_to` and old food logs are evidence. They are not final identity.

## Layers

Pantheon should keep these layers separate:

1. **Product / Pantry Identity**
   A reusable food or product with nutrition facts and unit conversions.

2. **Recipe / Composite Identity**
   A recurring combination of ingredients, such as a shake, cooked recipe, or meal shortcut.

3. **Saved Meal / Favorite Shortcut**
   Luke-facing memory and convenience. It may point at products or recipes, but it should not become a parallel identity universe.

4. **History / Hourly Recall**
   Ranking evidence only. It can make likely foods appear faster, but it should not persist as `lib:hourly_go_to:*` or resurrect deleted saved meals.

5. **Quantity / Unit**
   How much Luke ate. This must remain editable and visible, but it should not create new food identities.

## Canonical Home Rules

| Food type | Canonical home | Notes |
| --- | --- | --- |
| Plain ingredient or packaged product | `products` | Best home for barcode, OFF/USDA, pantry imports, and unit alternatives. |
| Branded single item | `products` | Use barcode/product facts where possible. Do not create one saved meal per quantity. |
| Common reusable composed meal | `recipes` long term, `saved_meals` short term | Should retain component rows when possible. |
| User favorite wrapper | `saved_meals` | Must preserve canonical component `source_ref` so hearts do not fracture by quantity. |
| Old logs and hourly go-tos | evidence only | Never outrank a live product/saved meal/recipe for the same identity. |
| External OFF/USDA hit | temporary external ref | Good for logging. Promote only after review or confidence gates. |

## Protein Shake Doctrine

Protein shakes are the canonical test case.

Long-term truth:

- Isopure chocolate protein powder is a product.
- Nutricost dextrose is a product.
- `protein shake no dextrose`, `half dextrose`, and `with dextrose` are composed shortcuts or recipes.
- Custom phrases like `one and a half scoops protein with half dextrose` should become ingredient rows, not a new saved meal for that exact combination.

Allowed shortcut behavior:

- Common shake phrases can resolve fast through deterministic composition.
- The visible Plate may show a friendly shake label later, but the saved evidence should preserve the ingredient components or a clean recipe/composite identity.

Blocked shortcut behavior:

- Do not route new protein shake phrases back to deleted A/B names.
- Do not create endless saved meals for every scoop/dextrose quantity.
- Do not let generic `isopure protein` tie with shake-with-dextrose products when Luke did not say `shake` or `dextrose`.

## Barcode Doctrine

Barcode scanning should strengthen product identity, not create another identity system.

Priority:

1. Existing `products.barcode` hit.
2. Reviewed product promotion from OFF/USDA.
3. Temporary OFF/USDA log-ready result.
4. Parser fallback.

Do not auto-promote weak OFF rows on first scan. Quartermaster should watch scan failures, edits, and saves, then generate review packets for products that deserve durable promotion.

## Quartermaster Rules

Quartermaster should grade identity health by asking:

- Did the same canonical `source_ref` survive parse, display, edit, and save?
- Did Luke's spoken quantity remain visible?
- Did a quantity change create a new favorite or saved meal?
- Did a historical source ref outrank a live product?
- Did barcode evidence point to a durable product or a temporary external row?
- Is this a missing product, a missing unit, a composition problem, or a UI trust problem?

Repair order:

1. Fix save-path or source-ref breakage.
2. Fix canonical identity routing.
3. Add or repair unit alternatives.
4. Add narrow aliases or rejections.
5. Promote reviewed barcode/OFF/USDA products.
6. Leave one-off human judgment as manual review.

## Audit Command

Use the read-only audit when identity behavior feels blurry:

```bash
npm run product-identity:audit
```

The audit should never write production data. It reports products, saved meals, barcode coverage, alias/rejection coverage, favorite wrappers, stale refs, and composition-shaped rows that deserve attention.

## Doctrine

Product identity is the spine. Quantity is math. History is evidence. Favorites are a user surface. Recipes and composites are composition. Quartermaster should keep those apart so Pantheon gets faster without becoming cluttered.
