# Quartermaster Product Identity Bundle

Date: 2026-05-20
Status: Active bundle plan
Scope: backend/Quartermaster learning infrastructure, product identity health, and safe repair planning.

## ELI5

This bundle helps Pantheon answer:

> "Is this a real food identity problem, a quantity problem, a UI trust problem, or just old history?"

The point is not to fix one phrase at a time. The point is to make the system better at choosing the right kind of repair.

## Why This Bundle Matters

The two most important active goals are:

1. **Protect Log Food accuracy.**
   Luke needs voice, barcode, servings, grams, scoops, bars, cartons, and favorites to behave reliably.

2. **Turn Quartermaster into the learning engine.**
   Quartermaster should translate real usage into repair packets: parser, product identity, unit conversion, UI trust, saved-meal cleanup, or manual review.

This bundle supports both without touching release lanes, migrations, native files, or production data.

## Current Safe Work Shape

Allowed in this bundle:

- read-only audits;
- docs/doctrine;
- read-only scripts;
- repair packet planning;
- test/check runs;
- local reports under ignored `scripts/output/`.

Blocked in this bundle:

- production data mutation;
- migrations;
- web deploys;
- native OTA/EAS/build;
- auth/proxy/session work;
- broad parser ranking changes while integration is coordinating parser branches.

## Product Identity Audit Signal

Current live audit highlights:

- 228 products.
- 23 saved meals.
- 608 active aliases.
- 65 active rejections.
- 29 barcode products.
- 219 products with unit alternatives.
- 7 saved-meal component refs still contain `lib:hourly_go_to:*` wrappers.
- 3 saved meals have at least one component without `source_ref`.
- No duplicate product wrapper refs were found.

Plain English: the pantry/product layer is getting strong. The main identity cleanup target is old saved-meal component evidence, not a broad parser rewrite.

## Repair Packet Lanes

The product identity audit now emits repair packets with these lanes:

- `data_repair_plan`: write dry-run plans for stale refs or wrapper cleanup. No live writes without explicit approval.
- `quartermaster_watch`: keep tracking evidence until real user behavior proves a fix is needed.
- `pantry_forge`: feed missing unit/product gaps into Pantry Forge.
- `parser_contract`: keep parser behavior aligned with product identity doctrine.

## Top Repair Themes

### 1. Hourly Wrapper Refs Inside Saved Meals

Meaning: some saved-meal components still point at recall/history wrappers instead of durable identities.

Desired repair:

- dry-run a mapping from wrapper ref to live product/saved-meal ref or null;
- confirm live parser output already strips wrappers;
- only mutate production data after integration approval.

### 2. Missing Component Source Refs

Meaning: a few saved meals are usable but weakly connected to canonical identity.

Desired repair:

- classify each as product candidate, saved-meal shortcut, recipe component, or manual-only;
- avoid inventing refs from name similarity alone.

### 3. Protein Shake Composition

Meaning: product shortcut rows exist today, but custom phrases should be ingredient math, not alias sprawl.

Desired repair:

- keep common deterministic shortcuts;
- use ingredient rows for custom protein/dextrose quantities;
- avoid creating saved meals for every scoop combination.

### 4. Barcode Product Quality

Meaning: barcode coverage exists, but scan edits should decide whether a product needs repair or promotion.

Desired repair:

- join barcode scan events to save/edit events;
- promote OFF/USDA hits only after review or repeated clean saves.

## Next Best Move

After PR #11 and PR #12 are integrated or explicitly coordinated, the best next implementation move is:

1. Add a dry-run saved-meal source-ref repair planner.
2. Feed its output into Quartermaster as `data_repair_plan` packets.
3. Do not write production data until Luke/integration approves the proposed mapping.

This is the cleanest path because it repairs identity evidence without guessing, deploying, or changing native behavior.

## Track Footer

Quartermaster Track: Leg 4 - Recommend Durable Fix Strategy | Grade: B+ | Plain English: product identity now produces prioritized repair packets instead of vague warnings | Next: integrate or dry-run saved-meal source-ref repair planning.
