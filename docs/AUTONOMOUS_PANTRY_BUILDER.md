# Autonomous Pantry Builder

Date: 2026-05-15
Status: LP-10 through LP-19 implementation doctrine
Scope: Pantheon web parser/backend, `products` pantry, identity resolver, and governed import scripts.

## ELI5

Pantheon should not wait for Luke to manually add every food.

It should build a strong pantry by itself from trusted databases, then ask Luke only when the choice is genuinely risky. The first target is about 1,000 high-quality foods, not 1,000 random rows. Each row needs macros, aliases, source proof, and unit intelligence so phrases like "5 strawberries", "5 oz strawberries", and "250g strawberries" all hit the same food correctly.

## Strategy

The first autonomous build is **Core plus Luke overlay**:

- Core: USDA whole foods, proteins, produce, grains, sauces, drinks, breakfast/snack staples, and common prepared foods.
- Luke overlay: Mexican, Thai, Italian, Vietnamese, Chipotle, chicken, turkey, coconut waters, REBBL, applesauce, cottage cheese, cereals/granolas, Magic Spoon, Kashi, Cracklin' Oat Bran, Chocolate Silk, and Yasso-style bars.

USDA core rows can be auto-applied when the risk engine approves them. Branded, restaurant, alcohol, composite, OFF-derived, and LLM-estimated rows stay review-gated.

## Implementation Status

The first implementation pass is intentionally conservative:

- Schema, scripts, profile data, risk engine, unit resolver, and identity alias/rejection integration are implemented.
- Dry-runs write artifacts under `scripts/output/` and do not touch Supabase rows.
- Live apply requires `--apply --run-id <id> --run-file <artifact>` and only writes candidates still classified `auto_approved`.
- The initial 100-target audits found USDA selector drift such as apple -> apple dessert, rice -> rice flour, curry paste -> almond paste, and tortilla -> tortilla chips. Those classes are now guarded as review-required form/coverage mismatches.
- No live pantry rows were written in the implementation pass. The next live run should start with a reviewed 25- or 60-target artifact before any larger apply.

## Source Priority

1. Luke-approved pantry rows
2. User-corrected rows and aliases
3. USDA Foundation / Survey FNDDS / SR Legacy
4. OFF barcode or branded exact matches
5. Restaurant/manual defaults
6. LLM-estimated rows
7. History/hourly-go-to signals

History remains a ranking signal. It does not become canonical identity by itself.

## Auto-Write Rules

Auto-apply only when all are true:

- source is USDA Foundation, Survey FNDDS, or SR Legacy
- calories/protein/carbs/fat are present and macro math is sane
- at least one useful unit alternative exists
- the candidate is not a prepared-dish mismatch
- no duplicate product already exists
- no rejected alias conflict exists
- category is not branded, restaurant, alcohol, supplement, recipe, or composite

Review-required examples:

- Chipotle or other restaurant rows
- OFF/branded rows
- cocktails and alcohol defaults
- coffee, chips, shake, and other broad generics
- LLM-estimated macros
- duplicate-ish rows
- missing or low-confidence units

## First Build Allocation

Target count: ~1,000 rows.

- 250 whole foods
- 175 proteins
- 150 cuisine staples for Mexican, Thai, Italian, Vietnamese
- 125 sauces, condiments, oils, dressings, sweeteners
- 100 breakfast/snack staples
- 75 beverages
- 75 prepared/common restaurant-style foods
- 50 replay/coverage-gap buffer

The importer may start with smaller dry-runs: 25, 100, then full profile.

## Required Evidence Per Import

Every candidate must carry:

- source kind and dataset
- external id when available
- source release/version when known
- proposed product payload
- proposed unit alternatives
- aliases
- risk decision and reasons
- duplicate check result
- import run id

## Stop Conditions

Stop before live writes when:

- a new source/data failure mode appears
- more than 2% of auto-approved rows fail validation
- an auto-approved sample looks semantically wrong
- duplicate rate is unexpectedly high
- schema shape differs from the script expectation
- USDA/OFF access/rate-limit assumptions change

## Autonomy

After this doctrine is approved, Codex may implement scripts, tests, schema drafts, dry-runs, and auto-approved USDA core writes. Codex must ask before branded/OFF/Chipotle/alcohol/LLM-estimated writes, destructive rollbacks, or broad alias changes.
