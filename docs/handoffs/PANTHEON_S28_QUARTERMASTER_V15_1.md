# Pantheon S28 Quartermaster v1.5

Date: 2026-05-18
Status: Implemented on branch `codex/stale-saved-meal-log-hardening`.

## What Changed

Quartermaster is no longer just a raw findings report.

It now produces:

- cycle state for "since last run" auditing;
- a parse/save/edit scoreboard;
- interaction outcomes;
- ranked work packets with lane, owner, score, priority, recommendation, and evidence.

## Commands

Full historical audit:

```bash
npm run quartermaster
```

Cycle audit:

```bash
npm run quartermaster -- --cycle
```

Dry-run a cycle without advancing local state:

```bash
npm run quartermaster -- --cycle --no-state-write
```

The cycle state file is local-only:

```text
scripts/output/quartermaster-cycle-state.json
```

## New Concepts

### Interaction Outcomes

Quartermaster classifies user interactions as:

- `clean_success`
- `slow_success`
- `edited_success`
- `identity_failure`
- `quantity_unit_failure`
- `coverage_failure`
- `confidently_wrong`
- `save_path_failure`
- `joke_or_non_log`
- `ambiguous_review`

### Work Packets

Work packets are the reviewable bridge between observation and repair.

They route findings into lanes:

- Pantry Forge;
- Matcher / Pantry Forge;
- Parser;
- Backend;
- Native UX / Telemetry;
- Library Identity;
- Intent Classifier;
- Human Review.

Each packet has a priority from `P0` to `P3`.

## Verification

Passed:

- `npm run typecheck`
- `npm run lint`
- `npx tsx scripts/test-matcher-invariants.ts`
- `npx tsx scripts/test-segmented-library.ts`
- `npm run quartermaster -- --limit=5 --json-only --no-state-write`
- `npm run quartermaster -- --limit=8 --cycle --no-state-write`

The segmented-library regression run caught a protein-shake alias overmatch
against `with half an ounce of half and half`; the scorer now requires
protein-shake context before protein-shake shortcuts can match.

Smoke result:

- `rows_read: 8`
- `events_read: 8`
- `findings: 38`
- `work_packets: 15`

Full historical dry-run after outcome tuning:

- `rows_read: 49`
- `events_read: 20`
- `findings: 218`
- `work_packets: 91`
- `clean_success: 31`
- `slow_success: 10`
- `quantity_unit_failure: 4`
- `coverage_failure: 4`
- `confidently_wrong: 2`

## Important Scope

Quartermaster remains read-only against production data.

It writes only local ignored artifacts under `scripts/output/`.

It does not apply aliases, product rows, saved-meal repairs, parser rules, native changes, or migrations by itself.

## Next Step

After the native event branch reaches Luke's real app, run:

```bash
npm run quartermaster -- --cycle
```

Then use the top `P0`/`P1` work packets to choose the next Pantry Forge, parser, native UI, or backend repair.
