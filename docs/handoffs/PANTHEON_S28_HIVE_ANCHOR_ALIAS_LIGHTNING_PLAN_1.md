# Pantheon S28 Hive Anchor Alias Lightning Plan 1

Date: 2026-05-17
Author: Codex on Hive
Status: Plan queued before Instacart intake.

## Summary

Next Pantry Lightning round should group the missing generic product anchors with the alias unlock they enable. This is intentionally a small bridge round before the larger Instacart order-history pass.

## Why This Round

The previous generic alias pass improved parser routing without adding products, but it exposed three missing generic anchors:

- raw tomato
- generic bagel
- cooked brown rice

Those anchors unlock multiple real grocery phrases Luke has already used or bought:

- tomato on the vine
- cherry tomatoes
- grape tomatoes
- everything bagel
- brown basmati rice cooked

The principle is simple: if the right generic product does not exist, do not alias to a nearby wrong product. Add the anchor first, then reroute the variants.

## Work Plan

1. Create a tiny USDA-only anchor pack for:
   - `Tomatoes, raw`
   - `Bagel`
   - `Rice, brown, cooked`
2. Dry-run the pack with `--limit=25 --offset=0`.
3. Inspect the markdown for:
   - raw tomato, not canned/crushed/sauce;
   - plain bagel, not restaurant/branded/sandwich;
   - cooked brown rice, not dry rice or rice noodles.
4. Apply only clean `auto_approved` USDA anchors under `--max-insert=25`.
5. Rerun:
   - `npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-amazon-1.json`
6. Apply only newly unblocked aliases under `--max-alias=25`.
7. Run:
   - `npx tsx scripts/verify-pantry-governance.ts`
   - `npx tsx scripts/test-pantry-packs.ts`
   - `npx tsx scripts/test-pantry-builder.ts`
   - `npx tsx scripts/test-matcher-invariants.ts`
   - `npm run typecheck`
   - `npm run lint`

## Permissions Assumption

This round stays inside existing Pantry Lightning permissions:

- Green: docs, scripts, packs, dry-runs, tests, read-only reports.
- Yellow: safe USDA product anchors under `--max-insert=25` after manual markdown inspection; safe generic aliases under `--max-alias=25`.
- Stop: branded/OFF/restaurant/alcohol/supplement/recipe/composite/LLM-estimated products, cap raises, migrations, secrets, destructive git, native release flows.

## Instacart Follow-On

After this bridge round, use the Instacart export as the next purchase-history source. Treat it as alias/rejection intelligence first and product-add fuel second:

- count unique items and repeats;
- identify already-covered foods;
- add aliases for safe generic equivalents;
- add anchors only for repeated foods Luke likely eats and that lack safe generic products;
- hold branded/prepared foods for review.
