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
npm run quartermaster -- --markdown-only
npm run quartermaster -- --json-only
```

By default the audit reads all visible `food_log_entries` rows and writes local reports to `scripts/output/`:

- `quartermaster-<run-id>.json`
- `quartermaster-<run-id>.md`

The script does not write production data.

## Current Visibility

Quartermaster v0 can see saved food-log entries.

It cannot yet fully see:

- parse attempts that failed before save;
- parse attempts Luke abandoned;
- exact edit gestures;
- whether Luke could visually read/trust a displayed row;
- native UI error events unless they were also saved into the log payload.

Those need future app telemetry.

## First Lanes

Quartermaster classifies findings into action lanes:

- `alias_add`
- `rejection_add`
- `pantry_product_add`
- `product_unit_add`
- `saved_meal_repair`
- `parser_bug`
- `native_ui_or_telemetry`
- `ignore_or_joke`
- `manual_review`

No lane applies changes automatically in v0.

## Luke-Facing Unit Rule

If Luke says `five strawberries`, Pantheon should show `5 strawberries`.

If Luke says `278 grams of sweet potatoes`, Pantheon should show `278 grams`, not `1 serving`.

Preserving the user's measurement is a trust signal. It lets Luke know Pantheon heard the important part.
