# Pantheon S28 Protein Shake Taxonomy Repair

Date: 2026-05-18
Status: Live data repair applied; fast-library scorer patch ready in repo.

## Why

Luke's protein shake logging had two user-facing problems:

- old shortcut names like `Protein Shake A - Pre-Workout` and `Protein Shake B - General` were still surfacing;
- phrases such as `protein shake with dextrose` needed to resolve cleanly to the full-dextrose shortcut, while `no dextrose` and `half dextrose` needed to stay distinct.

## Live Data Writes

Updated existing product shortcut rows:

- `c7d28acb-8772-4372-8123-a79a2740f29b`
  - from `Protein Shake B - General`
  - to `Protein Shake - No Dextrose`
- `300255c3-cd29-4cac-9f91-190ad2ed167f`
  - from `Protein Shake A - Pre-Workout`
  - to `Protein Shake - With Dextrose`

Inserted one missing shortcut product:

- `25c2b241-126f-4301-99a5-da89392f6fae`
  - `Protein Shake - Half Dextrose`
  - `168 kcal`, `25P / 11.5C / 1F`
  - computed from the existing no-dextrose shortcut plus half of the existing Nutricost dextrose serving.

Inserted 20 high-confidence aliases into `food_identity_aliases` with source `protein_shake_taxonomy`.

Parse response cache was busted for the active user after the write.

## Code Fix

`search_user_library` now loads active `food_identity_aliases` and scores them alongside saved-meal tags and product names.

Added a protein-shake dextrose-intent guard so these no longer blur together:

- `protein shake no dextrose`
- `protein shake with half dextrose`
- `protein shake with dextrose`
- `protein shake full dextrose`

Added a protein-shake context guard so generic phrases like `with half an
ounce of half and half` do not overmatch the half-dextrose shake shortcut.

## Verification

Passed:

- `npm run typecheck`
- `npm run lint`
- `npx tsx scripts/test-matcher-invariants.ts`
- `npx tsx scripts/test-segmented-library.ts`

Regression spot-check:

- `with half an ounce of half and half` no longer returns a protein shake.

Live search verification after data write:

- `protein shake no dextrose` -> `Isopure Protein Shake - No Dextrose`
- `protein shake with half dextrose` -> `Isopure Protein Shake - Half Dextrose`
- `protein shake with dextrose` -> `Isopure Protein Shake - With Dextrose`
- `protein shake full dextrose` -> `Isopure Protein Shake - With Dextrose`
- `protein shake b general` -> `Isopure Protein Shake - No Dextrose`

## Next

Run simulator parse/save smoke after the web scorer patch is deployed, then verify Quartermaster records both `parse_returned` and `save_succeeded`.
