# Product Promotion Review Packet

Date: 2026-05-20
Owner: Backend / Quartermaster lane
Status: Draft PR #12 support doc; review-only, no production writes.

## Plain English

Quartermaster should learn which external foods are worth turning into durable Pantheon products.

External foods are things like:

- `usda:*`
- `off:*`

Those are useful as evidence, but Pantheon works better when Luke's real repeat foods become reviewed product rows with strong units, provenance, and labels.

## Command

```bash
npx tsx scripts/report-product-promotion-review.ts
```

This reads recent saved logs and product rows, then classifies external refs as:

- already promoted
- review for promotion
- watch

## Current Important Candidate

Harmless Harvest Organic Coconut Water is the current top review candidate.

Evidence:

- It appears more than once in saved logs.
- It is still backed by `usda:2081302`.
- It has appeared as both `4 serving` and `16 oz`, which makes units especially important.

Correct next step:

- verify label/source facts
- confirm serving size and fluid-ounce / bottle / serving conversions
- only then create a reviewed product candidate, if approved

## Doctrine

1. Repeated clean saves are strong product-promotion evidence.
2. One-off external foods should usually stay in watch mode.
3. Barcode evidence is useful, but does not automatically create products.
4. Product promotion must improve unit handling, not create one product per quantity.
5. OFF/USDA rows are not automatically trusted enough to become durable Pantheon products.

## Stop Rules

- Do not create a product from this packet automatically.
- Do not promote if units or serving facts conflict.
- Do not create duplicate products for the same barcode/source.
- Do not create saved meals from barcode or external product evidence.
- Any live product insert needs integration review and explicit approval.

## Quartermaster Track Footer

Quartermaster Track: Leg 10 - Self-Improving Pantry/Product Loop
Grade target: A-
Plain English: Quartermaster can now recognize when repeated external food evidence should become a reviewed product candidate.
