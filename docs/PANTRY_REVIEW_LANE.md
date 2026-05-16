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

Export smart review packets:

```bash
npx tsx scripts/export-smart-pantry-review-packets.ts \
  --limit=250 \
  --output-dir=data/pantry/approvals/smart-review-YYYY-MM-DD
```

Export the plain-English identity worksheet:

```bash
npx tsx scripts/export-plain-pantry-review-packet.ts \
  --limit=120 \
  --output=data/pantry/approvals/plain-review-YYYY-MM-DD.md
```

Smart packet order:

- `01_quick_reject.md`: rows already rejected or carrying strong bad-match signals. These can become rejection memory after review.
- `02_quick_approve_usda.md`: very boring USDA review rows. These stay `edit_needed` until Luke flips a row to `approved`.
- `03_brands_restaurants.md`: protected rows for branded, restaurant, alcohol, supplement, composite, or profile-specific decisions.
- `04_manual_needed.md`: rows needing corrected source data or future importer guardrails.

Validate a reviewed ledger:

```bash
npx tsx scripts/validate-pantry-approval-ledger.ts \
  data/pantry/approvals/live-review-YYYY-MM-DD.md
```

Plan an approval apply from a live DB-backed ledger:

```bash
npx tsx scripts/plan-live-pantry-review.ts \
  --ledger=data/pantry/approvals/live-review-YYYY-MM-DD.md
```

Dry-run the guarded live apply command:

```bash
npx tsx scripts/apply-live-pantry-review.ts \
  --ledger=data/pantry/approvals/live-review-YYYY-MM-DD.md
```

Apply a reviewed ledger only after the planner is boring and Luke has explicitly approved the review writes:

```bash
npx tsx scripts/apply-live-pantry-review.ts \
  --ledger=data/pantry/approvals/live-review-YYYY-MM-DD.md \
  --apply \
  --allow-review-writes \
  --max-insert=25
```

Plan an approval apply from an older artifact-backed ledger:

```bash
npx tsx scripts/plan-pantry-approval-apply.ts \
  --artifact=scripts/output/pantry-builder-<run-id>.json \
  --ledger=data/pantry/approvals/<ledger>.md
```

## Review Decisions

- `approved`: Candidate is acceptable for a future explicit review apply.
- `edit_needed`: Candidate needs a corrected name, richer source data, or manual replacement.
- `rejected`: Candidate is a known bad match and should become rejection memory.

For smart review packets, Luke only edits the top approval table. The details below the table are reference material.

For plain review packets, Luke is mostly checking identity:

> If I say the spoken phrase, should Pantheon understand it as the robot match?

Macros come second. If the identity is wrong, the macros are automatically useless.

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

The current implementation step is not blind apply. The live review planner reads the live queue packet and produces three buckets:

- safe approved USDA writes
- rejection memory writes
- manual/edit-needed rows

The guarded review apply command now exists, but its default mode is dry-run. Live writes require both `--apply` and `--allow-review-writes`; branded, restaurant, alcohol, OFF, supplement, recipe, composite, and LLM-estimated rows still need explicit approval before they leave the review lane.

## Already-Covered Alias Lane

`Already Covered` rows should not create duplicate products. They either become safe aliases to one existing product or they stay unresolved.

Dry-run:

```bash
npx tsx scripts/plan-already-covered-aliases.ts \
  --ledger=data/pantry/approvals/plain-review-2026-05-16.md
```

The planner only proposes an alias when one existing product is unambiguous. It marks composites like bowls, shakes, soups, sandwiches, and bars as `not_aliasable`, because those need saved-meal or recipe handling instead of a product alias.

Live alias writes are guarded:

```bash
npx tsx scripts/plan-already-covered-aliases.ts \
  --ledger=data/pantry/approvals/plain-review-2026-05-16.md \
  --apply --allow-alias-writes --max-alias=25
```

Alias writes do not increase `products`; they improve parser routing into rows Pantheon already has.
