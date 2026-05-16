# Pantry Approval Ledger Format

Date: 2026-05-16
Status: Draft format for PLR-10

## Purpose

Markdown approval ledgers let Luke review risky pantry candidates without needing an admin UI first.

The ledger is validation-only for now. It does not apply rows to Supabase.

## Decisions

Allowed `decision` values:

- `approved` - candidate is approved for a future explicit apply path
- `rejected` - candidate should not become a product row
- `edit_needed` - candidate is close but needs corrected name, macros, units, source, or aliases

Anything else fails validation.

## Table Shape

```md
| candidate_key | decision | corrected_name | notes |
| --- | --- | --- | --- |
| usda:SR Legacy:168561:whole_foods | rejected |  | Pickle relish is not a plain pickle. |
| usda:Survey (FNDDS):2707390:cuisine_staples | approved | Baked beans | Generic home-style baked beans is acceptable. |
```

Rules:

- `candidate_key` is required.
- `decision` is required.
- `corrected_name` is optional.
- `notes` is optional but strongly recommended for rejected or edit-needed rows.
- Duplicate `candidate_key` values fail validation.
- A ledger may contain comments and normal Markdown text outside the table.

## Generate From A Dry Run

Use the read-only generator to create a starter ledger from a Pantry Builder artifact:

```bash
npx tsx scripts/generate-pantry-approval-ledger.ts \
  --artifact=scripts/output/pantry-builder-<run-id>.json
```

Generated ledgers default `review_required` candidates to `edit_needed`, default `rejected` candidates to `rejected`, and omit `auto_approved` rows unless `--include-auto` is passed.

Validate the ledger before any future apply path consumes it:

```bash
npx tsx scripts/validate-pantry-approval-ledger.ts data/pantry/approvals/<ledger>.md
```

Preview the read-only apply plan:

```bash
npx tsx scripts/plan-pantry-approval-apply.ts \
  --artifact=scripts/output/pantry-builder-<run-id>.json \
  --ledger=data/pantry/approvals/<ledger>.md
```

## Apply Boundary

This format intentionally does not grant write permission.

A future apply script must still:

- require an explicit apply command
- re-load the candidate artifact
- verify the candidate key still matches the current artifact
- show a dry-run diff
- stop before branded, restaurant, alcohol, supplement, recipe, or LLM-estimated writes unless Luke explicitly approves that exact apply
