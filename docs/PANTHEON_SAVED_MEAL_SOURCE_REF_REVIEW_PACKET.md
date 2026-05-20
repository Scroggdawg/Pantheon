# Saved Meal Source Ref Review Packet

Date: 2026-05-20
Owner: Backend / Quartermaster lane
Status: Draft PR #12 support doc; review-only, no production writes.

## Plain English

Some saved meal favorites still carry old `lib:hourly_go_to:*` memory refs inside their component JSON. Those refs are useful as history, but they should not be treated like durable product identities.

This packet turns the dry-run cleanup plan into a human decision sheet.

Run:

```bash
npx tsx scripts/plan-saved-meal-source-ref-repair.ts
npx tsx scripts/report-saved-meal-source-ref-review.ts
```

## Current Result

The latest dry run found:

- 10 saved-meal component issues
- 0 automatic maps
- 7 review-required items
- 3 leave-null items

This is the correct conservative posture. It means Quartermaster is not guessing.

## Review Buckets

### Review Product Match

Use when the dry run found a possible product row, but not a strong enough match to write automatically.

Expected examples:

- cooked white rice may map to a cooked white rice product, but rice variants are close enough that it still deserves review
- whole eggs may map to a generic egg product, but saved-meal shape should be checked
- avocado should prefer `Avocado, raw`, not avocado oil

### Review Saved Meal Shape

Use when the best match is another saved meal.

This is risky because saved meals can be wrappers around products. A saved meal should never point back to itself, and simple ingredients should usually point to products instead of saved-meal wrappers.

### Approve Null

Use when there is no safe durable identity.

Examples:

- Churro
- Poke sauce
- ahi tuna, raw

Leaving null is better than writing a wrong ref.

### Block Self Or Wrapper

Use when an hourly wrapper does not contain a clear final identity.

Correct outcome:

- leave null
- or create/review a real product later
- never preserve `lib:hourly_go_to:*` as the durable ref

## Stop Rules

- Do not run production data repair from this packet.
- Do not write guessed source refs.
- Do not self-map saved meals.
- Do not turn hourly wrappers into permanent identities.
- Any live data mutation needs integration review and explicit approval.

## Quartermaster Track Footer

Quartermaster Track: Leg 10 - Self-Improving Pantry/Product Loop
Grade target: A-
Plain English: Quartermaster can now turn stale favorite/source-ref problems into a human review sheet without touching live data.
