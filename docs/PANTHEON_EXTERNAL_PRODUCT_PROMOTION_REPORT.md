# Pantheon External Product Promotion Report

Date: 2026-05-20
Status: Read-only Quartermaster report
Scope: external `off:*` / `usda:*` foods that reached saved logs.

## ELI5

Sometimes Pantheon can log a food from an outside database before it has a real product row in Luke's pantry.

That is okay once.

If it repeats, or if Luke edits it, Quartermaster should ask:

> Should this become a reviewed Pantheon product?

## Command

Run:

```bash
npx tsx scripts/report-external-product-promotion.ts
```

For JSON:

```bash
npx tsx scripts/report-external-product-promotion.ts --json
```

## Decisions

The report emits:

- `already_promoted`: a matching `products` row already appears to exist.
- `review_for_promotion`: repeated saved evidence suggests a reviewed product row may be worthwhile.
- `watch`: one observation only; keep evidence but do not create a product yet.

## Safety

The report is read-only.

It does not:

- call OFF or USDA;
- create products;
- add aliases;
- mutate food logs;
- deploy;
- migrate.

## Doctrine

External refs are allowed as temporary truth, not permanent ideal identity.

Promotion requires:

- reviewed serving facts;
- reviewed unit facts;
- provenance preserved as barcode, OFF id, or USDA id;
- no duplicate product already covering the same external id.

Blocked:

- Do not promote from one observation unless Luke explicitly asks.
- Do not create saved meals for barcode products.
- Do not trust OFF serving data blindly.

Quartermaster Track: Leg 10 - Self-Improving Pantry/Product Loop | Grade: B | Plain English: external food logs can now become watch or product-promotion packets | Next: use repeated external refs and edits to feed reviewed Pantry Forge promotion.
