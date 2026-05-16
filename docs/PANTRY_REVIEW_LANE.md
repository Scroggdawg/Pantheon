# Pantry Review Lane

## ELI5

The auto lane is the robot adding boring safe USDA foods.

The review lane is the clipboard for foods the robot is not allowed to trust yet: Chipotle, BBQ plates, branded drinks, cocktails, sauces, restaurant foods, weird USDA matches, and composites.

Luke should only have to make the decisions that matter. Codex handles the export, validation, planning, and future apply mechanics.

## Current Contract

- Auto-apply remains limited to safe USDA rows.
- Review-required rows are exported to Markdown first.
- Markdown review packets are read-only until Luke edits decisions.
- No branded, restaurant, alcohol, OFF, supplement, recipe, composite, or LLM-estimated row is live-written without explicit approval.
- Bad matches discovered during review become future rejection memory, not repeated manual work.

## Commands

Export the live review queue:

```bash
npx tsx scripts/export-pantry-review-queue.ts \
  --limit=150 \
  --output=data/pantry/approvals/live-review-YYYY-MM-DD.md
```

Export one category:

```bash
npx tsx scripts/export-pantry-review-queue.ts \
  --category=prepared_common \
  --output=data/pantry/approvals/live-review-prepared-common.md
```

Validate a reviewed ledger:

```bash
npx tsx scripts/validate-pantry-approval-ledger.ts \
  data/pantry/approvals/live-review-YYYY-MM-DD.md
```

Plan an approval apply from an artifact-backed ledger:

```bash
npx tsx scripts/plan-pantry-approval-apply.ts \
  --artifact=scripts/output/pantry-builder-<run-id>.json \
  --ledger=data/pantry/approvals/<ledger>.md
```

## Review Decisions

- `approved`: Candidate is acceptable for a future explicit review apply.
- `edit_needed`: Candidate needs a corrected name, richer source data, or manual replacement.
- `rejected`: Candidate is a known bad match and should become rejection memory.

## What Luke Should See

Luke should see a short table first:

```markdown
| candidate_key | decision | corrected_name | notes |
| --- | --- | --- | --- |
| ... | edit_needed | Sauce, barbecue | Needs known brand or manual macros. |
```

Then detail below each row:

- target phrase
- proposed food
- source dataset/id
- macros
- units
- aliases
- risk reasons

## Next Build Step

The next implementation step is not blind apply. It is a review-apply planner that reads the live queue packet and produces three buckets:

- safe approved USDA writes
- rejection memory writes
- manual/edit-needed rows

Only after that planner is boring should Codex add a guarded review apply command.
