# Pantheon S28 Mac Mini Migration Handoff

Date: 2026-05-16
Author: Codex
Status: Good stopping point. Web repo clean and synced on this machine at commit `0af914f`.

## ELI5

This is a good place to switch computers.

The pantry work is not halfway through a dangerous write. The latest safe batches are applied, the code is committed and pushed, and the next step is a new dry-run. That makes this a clean handoff point for moving the active Codex session to the Mac Mini.

## Current Repo State

Web repo:

`/Users/scrogdawg/BMF Headquarters/2026 - THE NARRATIVE/26_09 Pantheon/pantheon`

Branch:

`main`

Current commit:

`0af914f Add v2 pantry expansion packs`

Git status on this machine before writing this handoff:

`## main...origin/main`

Recent commits:

- `0af914f` Add v2 pantry expansion packs
- `063a997` Tighten pantry review alias routing
- `83acda8` Block generic chips dessert overmatches
- `561b762` Record already-covered alias apply
- `3a332a7` Add already-covered alias planner

## Live Pantry State

Latest status report:

- products: 151
- pantry-imported products: 90
- pantry import runs: 13
- pantry import candidates: 299
- latest apply: `bf0a1ae5-0025-4ccb-99d0-1ac45be6ff55`, completed

Last live writes:

- Produce Grains v2 offset 0: 13 product inserts
- Produce Grains v2 offset 25: 2 product inserts
- Protein Cuts v2 offset 0: 2 product inserts

Total from the v2 pass: 17 safe USDA product inserts.

No branded, restaurant, OFF, alcohol, supplement, recipe, composite, or LLM-estimated product rows were written.

## What Just Changed

Added v2 pantry packs:

- `data/pantry/packs/produce-grains-v2.json`
- `data/pantry/packs/protein-cuts-v2.json`
- `data/pantry/packs/sauces-condiments-v2.json`
- `data/pantry/packs/breakfast-dairy-v2.json`
- `data/pantry/packs/cuisine-staples-v2.json`

Added docs:

- `docs/PANTRY_V2_EXPANSION_PACKS.md`
- `docs/handoffs/PANTHEON_S28_V2_PACKS_1.md`

Added static validation:

- `scripts/test-pantry-packs.ts`

Hardened importer risk logic:

- `NFS` / `NS as to ...` rows go review.
- `additives`, `imported`, `new zealand`, `prime`, `choice`, `select`, `blade`, `stuffed` go review unless present in the target.
- If a target says `raw`, candidate must say `raw`.
- If a target says `cooked`, candidate must say `cooked`.
- If a target says `lean` or a 2-3 digit lean percentage like `99`, candidate must preserve that specificity.

## Verification Already Run

Passed:

- `npx tsx scripts/test-pantry-packs.ts`
- `npx tsx scripts/test-pantry-builder.ts`
- `npx tsx scripts/test-matcher-invariants.ts`
- `npx tsx scripts/test-search-first-resolver.ts`
- `npx tsx scripts/test-segmented-library.ts`
- `npm run typecheck`
- `npm run lint`
- `npx tsx scripts/report-pantry-lightning-status.ts`

## Best Next Step

Start with Breakfast Dairy v2:

```bash
cd "/Users/scrogdawg/BMF Headquarters/2026 - THE NARRATIVE/26_09 Pantheon/pantheon"
npx tsx scripts/autonomous-pantry-builder.ts --profile=data/pantry/packs/breakfast-dairy-v2.json --limit=25 --offset=0
```

Then inspect the generated markdown under `scripts/output/`.

Apply only if the auto-approved rows are boring USDA rows:

```bash
npx tsx scripts/autonomous-pantry-builder.ts --apply \
  --run-id=<run-id> \
  --run-file=scripts/output/pantry-builder-<run-id>.json \
  --max-insert=25
```

Expected behavior:

- Safe USDA basics may apply.
- Brand/protein-powder/Yasso/Magic Spoon/Silk/Kashi/Cracklin rows should remain review-only.
- Stop if a new bad-match class appears in auto-approved rows.

## Mac Mini Migration Checklist

On the Mac Mini, open Codex against the web repo first. This pantry work is web/backend data work, not native app work.

1. Pull latest code:

```bash
cd "/Users/scrogdawg/BMF Headquarters/2026 - THE NARRATIVE/26_09 Pantheon/pantheon"
git status --short --branch
git pull --ff-only
git rev-parse --short HEAD
```

Expect HEAD at or after `0af914f`.

2. Confirm local env exists:

```bash
test -f .env.local && echo "env present"
```

Do not paste or print `.env.local` values.

3. Verify pantry governance and status:

```bash
npx tsx scripts/verify-pantry-governance.ts
npx tsx scripts/report-pantry-lightning-status.ts
```

4. Run the standard safety checks:

```bash
npx tsx scripts/test-pantry-packs.ts
npx tsx scripts/test-pantry-builder.ts
npm run typecheck
npm run lint
```

5. Continue with Breakfast Dairy v2 dry-run.

## Native Repo Note

Native repo:

`/Users/scrogdawg/Code/pantheon-native`

Native is not the active surface for this pantry batch. Do not run EAS build/update/submit unless Luke explicitly scopes native work. If switching to native later, read that repo's `AGENTS.md` and `OTA_RUNBOOK.md` first.

## Guardrails

Green lane:

- docs
- scripts
- tests
- dry-runs
- read-only reports
- safe USDA auto-approved rows under cap after manual inspection of the generated markdown

Stop before:

- branded/OFF rows
- restaurant rows
- alcohol/cocktail rows
- supplements
- recipe/composite rows
- LLM-estimated rows
- migrations
- destructive changes
- cap increases
- novel auto-approved bad-match class

## Why This Is A Good Migration Point

No process is running.

No uncommitted code was present before this migration doc.

The latest production data writes completed successfully and are documented.

The next action is a clean dry-run, not a half-finished apply.
