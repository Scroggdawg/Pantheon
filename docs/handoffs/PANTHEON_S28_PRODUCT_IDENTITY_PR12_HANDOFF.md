# Pantheon S28 Product Identity PR12 Handoff

Date: 2026-05-20
Author: Codex backend / Quartermaster chat
Branch: `codex/product-identity-model`
PR: https://github.com/Scroggdawg/Pantheon/pull/12
Status: Ready for integration review. Do not merge/deploy without traffic-light clearance.

## Plain English

PR #12 gives Quartermaster a product-identity review brain.

It does not change live parser behavior, mutate production data, run migrations, or deploy anything. It adds read-only scripts and docs that inspect live data and turn product/pantry problems into ranked review packets.

## What This PR Adds

- Product identity audit
- Quartermaster product worklist
- Saved-meal source-ref repair dry run
- Saved-meal source-ref human review packet
- Barcode quality report
- Barcode failure classifier
- External product promotion report
- External product promotion review packet
- Protein shake composition contract report
- Product unit surface review

One `package.json` script was added:

```bash
npm run product-identity:audit
```

This is why the traffic light flags the PR for integration before merge/release.

## Current Live Findings

### Saved Meal Source Refs

- 10 saved-meal component source-ref issues
- 0 automatic maps
- 7 review-required
- 3 leave-null

Main rule: prefer null over a guessed source ref.

### Product Promotion

- 16 external refs reviewed
- 1 already promoted
- 1 review-for-promotion candidate
- 14 watch-only

Top candidate: Harmless Harvest Organic Coconut Water (`usda:2081302`).

Important: observed units/macros conflict across `4 serving` and `16 oz`, so this is review-only, not ready for automatic product creation.

### Barcode Failure

- 1 barcode failure reviewed
- barcode `632432737775`
- classified as incomplete macros / Pantry Forge coverage work
- eventual saved ref: `off:632432737775`

### Protein Shake Contract

Current good shape:

- 1 Isopure ingredient product
- 1 Nutricost dextrose ingredient product
- 3 common shortcut products
- ingredient shortcut code present

Current risks:

- old `Protein Shake A - Pre-Workout` appears in historical logs and must stay history-only
- one recent shake-adjacent log used an hourly Isopure wrapper ref

### Product Unit Surfaces

- 17 unit-surface packets
- 3 P1 user-observed unit gaps
- 1 P2 barcode product with no unit alternatives
- 13 P3 watch items

Top examples:

- Bananas: `serving` vs `medium`
- Protein Shake - With Dextrose: `serving` vs `shake`
- Yasso Black Raspberry Chip: `serving` vs `bar`
- Aicha Tomato Paste: barcode product with no unit alternatives

## Checks Run

Passed during the branch:

```bash
npm run product-identity:audit
npx tsx scripts/plan-saved-meal-source-ref-repair.ts
npx tsx scripts/report-saved-meal-source-ref-review.ts
npx tsx scripts/report-barcode-quality.ts
npx tsx scripts/report-barcode-failure-review.ts
npx tsx scripts/report-external-product-promotion.ts
npx tsx scripts/report-product-promotion-review.ts
npx tsx scripts/report-protein-shake-composition-contract.ts
npx tsx scripts/report-product-unit-surface-review.ts
npm run typecheck
npm run lint
```

## Integration Notes

- This PR is read-only tooling and docs.
- `scripts/output/` remains ignored/local.
- No production data was changed.
- No migrations were run.
- No web deploy was run.
- No native OTA/EAS/build action was run.
- Do not merge while traffic light is RED.
- Because `package.json` changed, merge/release should go through integration.

## Recommended Next Step

Integration should review PR #12 as a read-only reporting bundle.

If accepted:

1. Merge PR #12.
2. Deploy web only if integration confirms current web deploy lane is clear.
3. After deploy, run reports again from main.
4. Only then consider explicit production data repair/product creation tasks.

## Do Not Do Automatically

- Do not create Harmless Harvest as a product yet.
- Do not repair saved_meals source refs yet.
- Do not edit protein shake product facts yet.
- Do not add unit alternatives yet.
- Do not deploy or mutate production data without explicit approval.

## Quartermaster Track Footer

Quartermaster Track: Leg 10 - Self-Improving Pantry/Product Loop
Grade target: A-
Plain English: PR #12 makes Quartermaster better at deciding what should be reviewed next, while leaving live data untouched.
