# Pantheon S28 Review Refresh 1

Date: 2026-05-16
Repo: `/Users/scrogdawg/BMF Headquarters/2026 - THE NARRATIVE/26_09 Pantheon/pantheon`
Status: Fresh review packet exported, obvious-no rejections applied, safe alias memory applied.

## Summary

Exported a fresh pantry review packet after the initial live packs and compressed the obvious safe work from it.

No products were inserted. This pass only added rejection memory and a small set of one-to-one already-covered aliases.

## Fresh Review Packet

Generated:

`data/pantry/approvals/plain-review-2026-05-16-refresh.md`

Packet counts:

- `obvious-no`: 66
- `already-covered`: 69
- `manual-source`: 39
- `needs-choice`: 23
- `probably-yes`: 3

Validation:

`npx tsx scripts/validate-pantry-approval-ledger.ts data/pantry/approvals/plain-review-2026-05-16-refresh.md`

Result: 200 rows, `rejected=66`, `edit_needed=134`.

## Rejection Memory Apply

Planned:

`npx tsx scripts/plan-live-pantry-review.ts --ledger=data/pantry/approvals/plain-review-2026-05-16-refresh.md`

Plan result:

- `would_record_rejection`: 66
- `needs_manual_edit`: 134
- protected writes: 0

Applied:

`npx tsx scripts/apply-live-pantry-review.ts --ledger=data/pantry/approvals/plain-review-2026-05-16-refresh.md --apply --allow-review-writes --max-insert=25`

Apply result:

- approved products: 0
- rejected rows processed: 66
- `edit_needed` left for future handling: 134
- inserted products: 0
- new rejection rows: 24

Post-apply counts observed immediately after:

- `products`: 134
- `food_identity_aliases`: 245
- `food_identity_rejections`: 65
- `pantry_import_candidates`: 252

## Already-Covered Alias Apply

The first refresh alias plan proposed 8 aliases, but 3 were unsafe generic-to-specific mappings:

- `tomato paste` -> `Aicha Tomato Paste`
- `olive oil` -> `EXTRA VIRGIN OLIVE OIL`
- `protein oats` -> `Quaker Protein Old-Fashioned Rolled Oats`

I tightened `lib/pantry-builder/alias-routing.ts` so a generic alias cannot target an existing product carrying brand/subtype-specific tokens that are absent from the alias. Added tests for the tomato paste and olive oil cases.

After tightening, the alias plan dropped to 5 safe one-to-one aliases:

- `bell pepper` -> `Bell Peppers`
- `flank steak` -> `Beef, flank, steak, boneless, choice, raw`
- `low fat cottage cheese` -> `Low-Fat Cottage Cheese`
- `pork tenderloin` -> `Pork, loin, tenderloin, boneless, raw`
- `sirloin steak` -> `Beef, top sirloin steak, raw`

Applied:

`npx tsx scripts/plan-already-covered-aliases.ts --ledger=data/pantry/approvals/plain-review-2026-05-16-refresh.md --apply --allow-alias-writes --max-alias=25`

Result: inserted aliases: 5.

## Verification

Passed:

- `npx tsx scripts/test-already-covered-alias-routing.ts`
- `npx tsx scripts/test-matcher-invariants.ts`
- `npx tsx scripts/test-search-first-resolver.ts`
- `npx tsx scripts/test-segmented-library.ts`
- `npm run typecheck`
- `npm run lint`
- `npx tsx scripts/report-pantry-lightning-status.ts`

Important behavior confirmed:

- Generic `chips` resolves toward tortilla chips, not dessert/chocolate-chip products.
- Generic `coffee` remains review-only against REBBL overmatches.
- Segmenter regression suite remains 10 pass / 0 fail.

## Current Live Pantry Snapshot

`scripts/report-pantry-lightning-status.ts` reports:

- products: 134
- pantry-imported products: 73
- pantry import runs: 10
- pantry import candidates: 252
- latest apply: `501af6a4-8e3e-4e7a-b10c-000cf7dc14e6`, completed

## Next

The original pantry packs are effectively exhausted. The next useful work is not another offset on the same packs; it is either:

1. Build v2 expansion packs from the gaps: fruit/veg, protein cuts, sauces/condiments, breakfast/dairy/snacks, and cuisine-specific staples.
2. Build a smarter review compiler that can classify the remaining `manual-source` / `needs-choice` rows into safe alias, recipe/saved-meal, product insert, or rejection lanes without asking Luke for row-by-row judgment.

Stop before writing branded/OFF/restaurant/alcohol/LLM-estimated product rows.
