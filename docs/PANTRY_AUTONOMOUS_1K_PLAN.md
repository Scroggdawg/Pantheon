# Pantry Autonomous 1K Plan

Date: 2026-05-16
Status: Active operating plan for Pantry Lightning Rounds

## ELI5

No, Luke should not be the common-sense judge for every pantry row.

Pantheon should know that tom kha soup is not a Tom Collins, Cracklin' Oat Bran is not raw oat bran, black coffee is not a black plum, and coconut juice is not coconut oil. Luke should only see the calls that are actually personal or product-shaped: exact brands/flavors, restaurant defaults, recipes, cocktails, and ambiguous serving conventions.

The plan is to reach roughly 1,000 foods by running several "skill disk" pantry packs. Each pack does three things:

1. Add boring safe USDA rows automatically.
2. Turn obvious bad matches into rejection memory automatically.
3. Save true product calls for later review, with Luke seeing fewer and better questions each round.

## Honest Boundary

Codex does not need Luke for:

- obvious identity mismatches
- obvious compatible duplicate calls
- USDA source sanity checks
- duplicate detection
- dry-runs, reports, tests, and guarded apply planning
- rejection-memory writes after a planner proves no product insert is involved

Codex still needs Luke for:

- exact branded products and flavors
- restaurant defaults
- recipes and composite foods
- supplement/protein shake defaults that are personal
- raising live insert caps
- destructive changes or broad parser behavior changes

## System Upgrade

The new layer is the **Pantry Review Referee**:

- Data file: `data/pantry/review-referee.json`
- Exporter: `scripts/export-plain-pantry-review-packet.ts`
- Test: `scripts/test-pantry-review-referee.ts`

The referee file has two key lists:

- `compatible_pairs`: identity-compatible matches that should not become hard rejections, even if they are already covered.
- `mismatch_pairs`: obvious wrong matches that can become rejection memory without asking Luke.

This turns review from "Luke reads USDA weirdness" into a repeatable calibration loop:

1. Dry-run a pack.
2. Export review packet.
3. Referee auto-splits obvious wrong / covered / true questions.
4. Apply rejection memory for hard mismatches.
5. Apply auto-approved USDA rows under cap.
6. Repeat.

## Current Baseline

As of this plan:

- `products`: 134
- `food_identity_rejections`: 41
- `pantry_import_candidates`: 252
- Approximate remaining path to 1,000 products: +866

The first objective is not brute-force 1,000. It is getting to 250-350 high-quality rows with very low wrongness, then raising throughput.

## Autonomy Gating

Green work, no Luke needed:

- edit docs, tests, packs, and referee rules
- run dry-runs and read-only reports
- export review packets
- run planner and dry-run apply commands
- commit and push after checks

Yellow work, Codex may do when planner is boring:

- apply safe USDA `auto_approved` rows at or under the current cap
- apply rejection memory when planner shows zero product inserts
- move compatible duplicates into alias-routing proposals

Red work, stop for Luke:

- branded/OFF/restaurant/alcohol/supplement/recipe/composite live product writes
- raising cap above agreed threshold
- deleting data
- schema migrations outside already-approved governance shape
- any novel source-risk class

## Lightning Rounds

### Round 1: Referee Autonomy

Goal: stop showing Luke obvious wrong matches.

Actions:

- Keep expanding `data/pantry/review-referee.json`.
- Regenerate plain review packets after each dry-run batch.
- Apply rejection memory when planner shows only `would_record_rejection`.
- Add tests for every new obvious class.

Expected product gain: 0

Expected quality gain: high. This prevents bad rows from recurring.

### Round 2: Already-Covered Alias Routing

Goal: make compatible duplicates route to existing products instead of staying in review.

Examples:

- almond milk unsweetened -> existing almond milk row
- balsamic vinegar -> existing balsamic vinegar row
- banana -> existing banana row
- cilantro/coriander leaves -> existing cilantro row

Actions:

- Build a planner for `Already Covered` rows.
- It should propose alias writes only when one existing product is unambiguous.
- It must skip when multiple plausible existing products exist.
- Apply aliases under a guarded cap.

Expected product gain: 0

Expected speed gain: meaningful, because parser skips more fallbacks.

### Round 3: Core USDA Windows

Goal: expand boring generic foods.

Pack:

- `data/pantry/packs/core-usda.json`

Actions:

- Run offsets in 25-target windows.
- Auto-apply safe USDA rows only.
- Apply rejection memory from referee.
- Stop on any suspicious auto-approved row.

Expected product gain: +50 to +125 over several windows.

### Round 4: Breakfast And Protein

Goal: cover Luke's highest-frequency daily foods.

Pack:

- `data/pantry/packs/breakfast-protein.json`
- `data/pantry/packs/luke-staples.json`

Auto-safe:

- eggs
- cooked/raw simple proteins
- oats
- generic dairy basics
- fruits/toppings

Review-only:

- protein shakes
- protein powders
- Magic Spoon/Kashi/Cracklin exact products
- Yasso-style bars
- REBBL products

Expected product gain: +50 to +100.

### Round 5: Mexican Generic Plus Chipotle Review

Goal: improve the food lane Luke uses often without silently inventing Chipotle.

Pack:

- `data/pantry/packs/mexican-chipotle-review.json`

Auto-safe:

- plain tortillas
- beans
- rice
- lime
- cilantro
- generic salsa/hot sauce if exact enough

Review-only:

- Chipotle menu items
- queso
- guacamole/chips defaults
- margarita / Dos Equis
- bowl composites

Expected product gain: +25 to +75.

### Round 6: Thai And Vietnamese Ingredients

Goal: cover the ingredient primitives before recipes.

Packs:

- `data/pantry/packs/thai.json`
- `data/pantry/packs/vietnamese.json`

Auto-safe:

- herbs
- rice/noodle primitives
- simple sauces when exact
- proteins

Review-only:

- pad thai
- tom yum / tom kha
- pho
- banh mi
- vermicelli bowls
- nuoc cham
- curry pastes when source quality is weak

Expected product gain: +50 to +100.

### Round 7: Italian Ingredients

Goal: cover bolognese/pasta defaults by adding ingredients first.

Pack:

- `data/pantry/packs/italian.json`

Auto-safe:

- pasta shapes
- tomato paste/crushed tomato/plain tomato sauce when exact
- garlic/onion/basil/oregano
- cooked/raw simple proteins
- cheeses when exact

Review-only:

- turkey bolognese
- lasagna
- chicken parmesan
- meatballs
- spaghetti with meat sauce

Expected product gain: +40 to +90.

### Round 8: BBQ Skill Disk

Goal: prove "add BBQ" as a repeatable cuisine pack.

Pack:

- `data/pantry/packs/bbq.json`

Auto-safe:

- simple meats
- buns
- beans/slaw/cornbread only when exact

Review-only:

- BBQ plate
- sandwiches
- sauces
- restaurant-style composites

Expected product gain: +25 to +75.

### Round 9: Brand Exact-Product Queue

Goal: add Luke's branded staples without guesswork.

Sources:

- Open Food Facts
- manual source links
- package labels if provided later

Targets:

- REBBL flavors
- Harmless Harvest / Taste Nirvana / Goya coconut waters
- Magic Spoon flavors
- Kashi / Cracklin Oat Bran
- Chocolate Silk
- Yasso bars
- Mott's / applesauce variants

Expected product gain: +50 to +150.

Requires Luke only when exact flavor/variant matters.

### Round 10: Recipe And Composite Defaults

Goal: stop pretending recipes are ingredients.

Targets:

- turkey bolognese
- protein shake with dextrose
- cottage cheese bowls
- pho
- banh mi
- pad thai
- vermicelli bowls
- mango sticky rice
- BBQ plates

This round should create recipe/saved-meal structures or source-gated defaults, not random USDA rows.

Expected product gain: variable.

Expected parse gain: very high for Luke-specific speech.

## Throughput Plan

Phase A: Conservative

- cap: 25 product inserts per apply
- repeat until three clean applies after referee upgrade
- expected total: 175-250 products

Phase B: Moderate

- cap: 50 product inserts per apply
- only after no suspicious auto-approvals
- expected total: 350-500 products

Phase C: Pack Scale

- cap: 75-100 for boring USDA core only
- brands/restaurant/composite still review-gated
- expected total: 750-1,000 products

## Success Metrics

Per round:

- product count delta
- rejection-memory delta
- alias delta
- parser tests green
- search-first resolver has fewer fallback-required rows
- no new generic overmatch class

The target is not "1,000 rows." The target is:

- fast hits for common speech
- no confident wrong matches
- exact handling for Luke's staple foods
- intelligent fallback for recipes and composites

## Next Execution

Immediate next brick:

1. Run the referee test.
2. Regenerate the plain review packet from the referee data file.
3. Plan and dry-run the already-covered alias-routing lane.
4. If the planner can prove one-to-one existing product matches, write aliases under cap.
5. Continue Core USDA windows.
