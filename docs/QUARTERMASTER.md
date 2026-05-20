# Quartermaster

Quartermaster is Pantheon's read-only feedback audit loop.

It watches what actually happened in food logging:

- what Luke said or typed;
- what Pantheon parsed;
- what got saved;
- what likely changed between parse and save;
- which parser path was used;
- which identities or units looked weak;
- which failures should become parser, pantry, alias, saved-meal, UI, or telemetry work.

Core rule:

> User experience feedback is the Bible. Watch users.

## Run

From the web repo:

```bash
npm run quartermaster
```

Useful variants:

```bash
npm run quartermaster -- --since=30d
npm run quartermaster -- --limit=50
npm run quartermaster -- --cycle
npm run quartermaster -- --cycle --no-state-write
npm run quartermaster -- --markdown-only
npm run quartermaster -- --json-only
```

By default the audit reads all visible `food_log_entries` rows plus any
available `food_log_events` rows, then writes local reports to `scripts/output/`:

- `quartermaster-<run-id>.json`
- `quartermaster-<run-id>.md`

The script does not write production data.

`--cycle` turns the audit into a "since last run" loop. It stores local state in
`scripts/output/quartermaster-cycle-state.json`, which is ignored by Git. Use
`--no-state-write` to rehearse a cycle without advancing that pointer.

Cycle output includes:

- a scoreboard for parse/save/edit signals;
- interaction outcomes such as `clean_success`, `quantity_unit_failure`, and
  `save_path_failure`;
- ranked work packets with priority, lane, owner, recommendation, and evidence.

## Current Visibility

Quartermaster v0 can see saved food-log entries.

Quartermaster v1 adds an optional `food_log_events` stream for native app
events that do not always become saved logs:

- parse requested;
- parse returned;
- parse failed;
- parse abandoned;
- food item edited;
- food item deleted;
- food item added;
- disambiguation selected;
- save requested;
- save succeeded;
- save failed.

Until migration `022_food_log_events.sql` is applied and native is running the
event-emitting bundle, Quartermaster cannot fully see:

- parse attempts that failed before save;
- parse attempts Luke abandoned;
- exact edit gestures;
- whether Luke could visually read/trust a displayed row;
- native UI error events unless they were also saved into the log payload.

If the event table is missing, the audit still runs and records that gap.

## First Lanes

Quartermaster classifies findings into action lanes:

- `alias_add`
- `rejection_add`
- `pantry_product_add`
- `product_unit_add`
- `saved_meal_repair`
- `parser_bug`
- `backend_bug`
- `native_ui_or_telemetry`
- `ignore_or_joke`
- `manual_review`

No lane applies changes automatically.

## Work Packets

A finding says "something happened."

A work packet says "this is probably the next useful repair."

Each packet includes:

- priority: `P0` through `P3`;
- score: 1-100;
- owner: Pantry Forge, Parser, Backend, Native UX, Library Identity, or Human Review;
- recommended action;
- why it matters;
- example transcripts;
- finding ids that support it.

The first use of work packets is triage, not automation. They are intentionally
reviewable before any live data write, parser rule, or native change.

## Theme Safety

Quartermaster should group boldly and execute narrowly.

A theme is allowed to say "these symptoms are one larger lesson." That is how
Pantheon avoids a pile of tiny aliases, duplicate saved foods, and one-off
patches. But a theme is not permission to make broad live changes.

Each theme execution plan now includes:

- `grouping_scope`: how far the evidence can safely be grouped;
- `execution_mode`: `observe_only`, `plan_only`, `narrow_repair`, or
  `human_review_required`;
- `safety_gates`: checks that must pass before repair work counts as safe;
- `allowed_actions`: the kinds of narrow work this theme can justify;
- `blocked_actions`: moves that would create clutter, over-merge identities, or
  mutate production data too broadly.

Plain English: Quartermaster can think in big patterns, but repairs should start
with the strongest evidence, replay Luke's real phrase, and ship as small tested
changes.

## Luke-Facing Unit Rule

If Luke says `five strawberries`, Pantheon should show `5 strawberries`.

If Luke says `278 grams of sweet potatoes`, Pantheon should show `278 grams`, not `1 serving`.

Preserving the user's measurement is a trust signal. It lets Luke know Pantheon heard the important part.
