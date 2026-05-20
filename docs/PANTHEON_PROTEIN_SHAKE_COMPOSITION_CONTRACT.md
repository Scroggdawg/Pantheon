# Protein Shake Composition Contract

Date: 2026-05-20
Owner: Backend / Quartermaster lane
Status: Draft PR #12 support doc; review-only, no production writes.

## Plain English

Protein shakes should not become a giant pile of saved items.

Pantheon needs two layers:

1. Real ingredient products:
   - Isopure chocolate protein
   - Nutricost dextrose
2. Friendly shortcuts for common defaults:
   - Protein Shake - No Dextrose
   - Protein Shake - Half Dextrose
   - Protein Shake - With Dextrose

Custom phrases should be math, not new identities.

Example:

`two scoop protein shake with half dextrose`

Should mean:

- Isopure protein: 2 scoops
- Nutricost dextrose: 0.5 serving

It should not create a new permanent item called `Two Scoop Protein Shake With Half Dextrose`.

## Command

```bash
npx tsx scripts/report-protein-shake-composition-contract.ts
```

## Current Contract

Common shortcut phrases may resolve to shortcut products when that is fast and clear.

Custom quantity phrases should resolve to ingredient rows:

- `protein shake no dextrose` -> 1 scoop protein, 0 dextrose
- `protein shake half dextrose` -> 1 scoop protein, 0.5 dextrose
- `protein shake with dextrose` -> 1 scoop protein, 1 dextrose
- `double protein shake no dextrose` -> 2 scoops protein, 0 dextrose
- `two scoop protein shake with half dextrose` -> 2 scoops protein, 0.5 dextrose
- `protein shake with one and a half scoops protein and half dextrose` -> 1.5 scoops protein, 0.5 dextrose

## Safety Rules

- Do not create one product or saved meal for every shake quantity.
- Do not let broad `protein shake` aliases override explicit dextrose instructions.
- Do not route `no dextrose` to a dextrose shortcut.
- Do not route `half dextrose` to full dextrose.
- Do not use stale names like `Protein Shake A - Pre-Workout` as live candidates.
- Verify the Nutricost dextrose serving facts before changing durable macros.

## Current Watch Items

Quartermaster should keep watching:

- duplicate protein shake rows from one spoken shake
- old `Protein Shake A` style identities surfacing in candidate lists
- broad aliases that hide dextrose quantity
- mismatch between Luke's stated dextrose serving and stored dextrose product facts
- weak unit surfaces on Isopure/Nutricost ingredient rows

## Current Live Read

The current audit sees the right basic shape:

- 1 Isopure ingredient product
- 1 Nutricost dextrose ingredient product
- 3 common shortcut products
- ingredient shortcut code present

The active risks are narrower:

- old `Protein Shake A - Pre-Workout` appears in historical saved logs and must stay history-only
- one recent shake-adjacent log used an hourly Isopure wrapper instead of the durable Isopure product ref

That means the next real repair is not "add more shake products." The next repair is to keep live parsing pointed at current shortcuts or ingredient rows, and keep stale/history wrappers out of live candidate surfaces.

## Stop Rules

- Do not mutate product rows from this report.
- Do not add broad aliases from one failure.
- Do not create more opaque shortcut identities to fix custom quantity parsing.
- Any product macro correction or data repair needs integration review and explicit approval.

## Quartermaster Track Footer

Quartermaster Track: Leg 10 - Self-Improving Pantry/Product Loop
Grade target: A-
Plain English: Quartermaster can now judge protein shake work by whether it moves toward ingredient math, not saved-item sprawl.
