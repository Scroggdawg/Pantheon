# Pantheon S28 Alias Apply 1

Date: 2026-05-16
Repo: `/Users/scrogdawg/BMF Headquarters/2026 - THE NARRATIVE/26_09 Pantheon/pantheon`
Status: Completed

## Summary

Applied the first guarded `Already Covered` alias batch from the plain pantry review worksheet.

This did not insert products. It only added parser-memory aliases for rows that the planner could route to exactly one existing product under the 25-alias cap.

## Command

```bash
npx tsx scripts/plan-already-covered-aliases.ts \
  --ledger=data/pantry/approvals/plain-review-2026-05-16.md \
  --apply --allow-alias-writes --max-alias=25
```

## Planner Result

- Covered rows inspected: 45
- Existing aliases already present: 18
- New aliases proposed/applied: 12
- No confident match: 12
- Ambiguous: 2
- Not aliasable: 1

## Live Counts After Apply

- `products`: 134
- `food_identity_aliases`: 245
- `food_identity_aliases` with `source = pantry_review_alias`: 12
- `food_identity_rejections`: 41
- `pantry_import_candidates`: 252

## Verification

Passed after the alias write:

- `npx tsx scripts/test-matcher-invariants.ts`
- `npx tsx scripts/test-segmented-library.ts`
- `npx tsx scripts/test-search-first-resolver.ts`
- `npx tsx scripts/test-already-covered-alias-routing.ts`
- `npx tsx scripts/report-pantry-lightning-status.ts`

Observed existing non-blocking tail:

- Search-first resolver still surfaces `chips -> Yasso Greek Yogurt Bar - Mint Chocolate Chip` as a `needs_choice` candidate. This predates the alias apply and should be a next guardrail/referee target.

## Next

Proceed to the next pantry compiler pass:

1. Add a guardrail for generic `chips` so it cannot choose sweet/branded dessert products.
2. Re-run resolver proof.
3. Continue the next conservative USDA/core pack window.
