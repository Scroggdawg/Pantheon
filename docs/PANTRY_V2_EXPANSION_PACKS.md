# Pantry v2 Expansion Packs

Date: 2026-05-16
Status: v2 pack layer added. Safe USDA rows can be dry-run and applied under the existing Pantry Lightning guardrails.

## ELI5

Pantheon now has a second shelf of pantry training disks.

The first pantry packs proved the importer and got the database from tiny to useful. The v2 packs are for breadth: more produce, more protein cuts, more sauces, more breakfast/dairy, and more cuisine staples. Each pack can be loaded, dry-run, audited, and applied in conservative batches.

## New Packs

- `data/pantry/packs/produce-grains-v2.json`
- `data/pantry/packs/protein-cuts-v2.json`
- `data/pantry/packs/sauces-condiments-v2.json`
- `data/pantry/packs/breakfast-dairy-v2.json`
- `data/pantry/packs/cuisine-staples-v2.json`

## Intent

These packs are meant to push Pantheon closer to "fast by default" without forcing Luke to review row-by-row slop.

- Produce and grains: boring whole-food breadth.
- Protein cuts: raw/cooked anchors for chicken, turkey, beef, pork, seafood, eggs, and dairy.
- Sauces/condiments: common oils, vinegars, sauces, and sweeteners.
- Breakfast/dairy: oats, cereals, milk, yogurt, cottage cheese, and breakfast defaults.
- Cuisine staples: Mexican, Thai, Italian, and Vietnamese building blocks.

## Guardrails

The existing pantry contract still wins:

- Auto-write only USDA Foundation, Survey FNDDS, or SR Legacy rows.
- Keep batch caps conservative.
- Keep branded, restaurant, alcohol, supplement, recipe, composite, OFF, and LLM-estimated rows review-only.
- Stop on a novel bad-match class.
- Keep `products` as the parser-facing table.
- Keep `unit_alternatives` as the unit conversion surface.

## Recommended Run Order

1. `produce-grains-v2`
2. `protein-cuts-v2`
3. `breakfast-dairy-v2`
4. `sauces-condiments-v2`
5. `cuisine-staples-v2`

The order is intentionally boring first. The more a pack contains sauces, prepared dishes, or cuisine-specific composites, the more likely it is to generate review rows rather than safe inserts.

## Commands

Dry-run a pack:

```bash
npx tsx scripts/autonomous-pantry-builder.ts --profile=data/pantry/packs/produce-grains-v2.json --limit=25 --offset=0
```

Apply a dry-run only if the auto-approved rows are boring and under cap:

```bash
npx tsx scripts/autonomous-pantry-builder.ts --apply \
  --run-id=<run-id> \
  --run-file=scripts/output/pantry-builder-<run-id>.json \
  --max-insert=25
```

Validate pack structure:

```bash
npx tsx scripts/test-pantry-packs.ts
```

## Next Compiler Work

The review backlog still needs a stronger compiler that can split rows into:

- rejection memory
- already-covered alias memory
- safe USDA product insert
- recipe/saved-meal candidate
- branded/manual source candidate

That is the next autonomy unlock because it compresses Luke's review burden without pretending Tom Kha is Tom Collins.
