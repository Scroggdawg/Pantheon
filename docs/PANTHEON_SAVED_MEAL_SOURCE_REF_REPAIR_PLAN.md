# Saved Meal Source Ref Repair Plan

Date: 2026-05-20
Status: Dry-run planner added
Scope: saved meal component `source_ref` repair planning only.

## ELI5

Some saved meal ingredients still point at old "recent food" wrappers instead of real product or saved-meal identities.

That does not mean the app is broken right now. It means the history evidence is messier than it should be.

This plan lets Pantheon inspect those old refs and propose what they should become, without changing production data.

## Command

Run:

```bash
npx tsx scripts/plan-saved-meal-source-ref-repair.ts
```

The script writes ignored local artifacts under `scripts/output/`:

- `saved-meal-source-ref-repair-<run-id>.json`
- `saved-meal-source-ref-repair-<run-id>.md`

## What It Looks For

The planner looks for saved meal component rows where:

- `source_ref` starts with `lib:hourly_go_to:`;
- `source_ref` is missing.

It does not touch ordinary clean refs like:

- `lib:product:<uuid>`;
- `lib:saved_meal:<uuid>`;
- external refs.

## Decisions

The planner emits one of three decisions:

- `auto_map`: the old ref has a clear canonical replacement candidate.
- `review_required`: there is a plausible candidate, but a human/integration pass should inspect it.
- `leave_null`: no safe canonical identity is clear.

## Safety Rules

- The script is read-only.
- The script must never update Supabase.
- Any future production data mutation must be approved by Luke/integration.
- Prefer leaving a component ref empty over writing a guessed source ref.
- Do not recreate `lib:hourly_go_to:*` as durable identity.
- Do not map a saved-meal component back to its own parent saved meal.

## Current Relationship To Quartermaster

This is the first execution step after the product identity audit started producing repair packets.

The audit says:

> Plan cleanup for hourly wrapper refs inside saved meals.

This planner answers:

> What exact cleanup would we propose, and which parts are safe versus review-only?

## Next Step

Run the planner, inspect the markdown, and if the mappings look boring and correct, create a separate integration-reviewed data repair proposal. Do not apply it directly from this branch.

Quartermaster Track: Leg 5 - Generate Repair Packets | Grade: B+ | Plain English: product identity repair packets now have a dry-run planner for old saved-meal source refs | Next: inspect proposed mappings and decide whether a data repair proposal is warranted.
