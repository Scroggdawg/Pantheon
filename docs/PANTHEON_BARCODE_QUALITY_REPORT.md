# Pantheon Barcode Quality Report

Date: 2026-05-20
Status: Read-only Quartermaster report
Scope: barcode scan events, barcode-backed saved logs, barcode product identity quality.

## ELI5

Barcode scanning should make logging faster, not create a new mess.

This report helps Pantheon ask:

- Did the scan resolve?
- Did Luke edit the scanned product?
- Did it save as a durable product?
- Did it fall back to OFF/USDA or parser behavior?
- Are barcode products missing useful units?

## Command

Run:

```bash
npx tsx scripts/report-barcode-quality.ts
```

For machine-readable output:

```bash
npx tsx scripts/report-barcode-quality.ts --json
```

## Safety

The report is read-only.

It does not:

- create products;
- create saved meals;
- add aliases;
- mutate food logs;
- deploy anything;
- run migrations.

## Doctrine

Barcode evidence should strengthen product identity.

Priority:

1. Existing `products.barcode` hit.
2. Reviewed product promotion from repeated clean OFF/USDA hits.
3. Temporary OFF/USDA log-ready result.
4. Parser fallback.

Blocked:

- Do not create one saved meal per barcode.
- Do not auto-promote weak OFF rows from one scan.
- Do not treat a clean scan as proof that all serving units are correct.

## How Quartermaster Should Use It

If barcode scans fail:

- classify camera/permission/lookup/fallback cause;
- feed repeated lookup misses into reviewed product coverage.

If barcode products are edited:

- compare displayed quantity/unit to final saved quantity/unit;
- repair product facts or unit alternatives only when evidence repeats.

If barcode saves use external refs:

- consider product promotion after review;
- prefer durable `lib:product:*` identity over `off:*` or `usda:*`.

Quartermaster Track: Leg 9 - Measure Improvement Over Time | Grade: B+ | Plain English: barcode quality can now be measured as scan, edit, save, and product identity evidence | Next: use repeated scan edits/failures to feed product repair packets.
