# Product Unit Surface Review

Date: 2026-05-20
Owner: Backend / Quartermaster lane
Status: Draft PR #12 support doc; review-only, no production writes.

## Plain English

Unit surfaces are how Pantheon knows that one food can be logged in different normal ways:

- grams
- ounces
- serving
- can
- bar
- carton
- slice
- tbsp
- bottle

This matters because Luke should not need a separate product for every quantity.

Bad model:

- Yasso bar, one bar
- Yasso bar, two bars
- Yasso bar, 80 grams

Good model:

- one Yasso product with strong unit conversions

## Command

```bash
npx tsx scripts/report-product-unit-surface-review.ts
```

## What Quartermaster Looks For

- barcode products with no unit alternatives
- repeated logs using units not covered by the product
- products that are likely to become duplicate quantity identities

## Current Known Example

`Aicha Tomato Paste` is currently a barcode product to review because it has a barcode but weak/missing unit alternatives.

Correct next step:

- verify package/label facts
- add reviewed units only if needed
- do not guess package size

## Current Live Read

The current unit review found:

- 17 total unit-surface packets
- 3 P1 user-observed unit gaps
- 1 P2 barcode product with no unit alternatives
- 13 P3 watch items

Top P1s:

- Bananas: Luke has used `serving` as well as `medium`
- Protein Shake - With Dextrose: Luke has used `serving` as well as `shake`
- Yasso Black Raspberry Chip: Luke has used `serving` as well as `bar`

Top P2:

- Aicha Tomato Paste: barcode product with no unit alternatives

This is a review queue, not an edit queue. Some of these may be display/normalization choices instead of product data changes.

## Doctrine

1. Units are part of product identity.
2. Quantity should not create a new identity.
3. Barcode scans should strengthen product unit surfaces.
4. User edits are high-signal unit repair evidence.
5. A product without trusted units is watch/review, not automatic repair.

## Stop Rules

- Do not guess package units.
- Do not create one product per quantity.
- Do not promote weak OFF/barcode data without review.
- Do not mutate products from this report.
- Any live product/unit repair needs explicit approval.

## Quartermaster Track Footer

Quartermaster Track: Leg 10 - Self-Improving Pantry/Product Loop
Grade target: A-
Plain English: Quartermaster can now find products whose units need review before they create duplicate logging behavior.
