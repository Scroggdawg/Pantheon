# Log Food Parser Lightning Round

Date: 2026-05-19

## Goal

Prove that the native Log Food workflow and backend parser now agree on the
fixed behaviors:

- Taylor Farms whole-bag phrasing does not create a bogus clarification.
- Quantity phrases like `2 slices` and `1/4 medium avocado` scale library hits.
- Isopure + NutriCost protein shakes parse as ingredients, not mixed shortcut
  identities.
- Old response-cache entries do not mask the new parser behavior.

## Round 1: End-To-End App Proof

1. Start the Next backend from `/Users/scroggdawg/Code/pantheon`.
2. Start the Expo dev-client server from `/Users/scroggdawg/Code/pantheon-native`.
3. Run native QA reports for:
   - `salmon_taylor_farms_bag`
   - `protein_shake_full_dextrose`
   - `protein_shake_half_dextrose`
   - `protein_shake_no_dextrose`
   - `double_protein_full_dextrose`
   - `double_protein_half_dextrose`
   - `double_protein_no_dextrose`
4. Extract parser JSON and telemetry from each report.
5. Compare expected macros and failure flags.

Acceptance:

- Salmon report has `clarification_needed: null`.
- Salmon report has Dave's bread at quantity `2`.
- No protein shake report contains both powder and a saved protein-shake shortcut.
- Double-protein variants total `50g` protein, not `75g+`.
- Protein-shake route latency is sub-second or low single-digit seconds.

## Round 2: Regression Coverage

1. Add backend tests or focused scripts for the seven scenarios.
2. Include direct parser route checks for:
   - no bogus quantity-only clarification
   - quantity scaling
   - protein shake ingredient decomposition
   - cache bypass/avoidance for shake shortcut
3. Run typecheck and lint.

Acceptance:

- Tests fail on the old behavior and pass on the current behavior.
- Coverage lives near the parser code or replay fixtures, not only in ad hoc
  terminal commands.

## Round 3: Package And Handoff

1. Split work by repo:
   - backend parser fix
   - native QA workflow/harness work, if still pending
2. Write a short handoff with:
   - what changed
   - what was verified
   - remaining pantry/data questions
3. Confirm clean status or intentionally listed dirty files.

## Non-Goals For This Round

- Do not rewrite Quartermaster.
- Do not broadly rework pantry import/ranking.
- Do not invent a recipe system for composed meals.
- Do not tune all parser latency; only capture and improve the known shake
  shortcut path.

## Round 1 Result Snapshot

Completed through the native simulator against local backend code.

Evidence folders:

- Native salmon run:
  - `/Users/scroggdawg/Code/pantheon-native/qa/runs/2026-05-19T14-37-51-163Z-salmon_taylor_farms_bag/`
- Native protein shake runs:
  - `/Users/scroggdawg/Code/pantheon-native/qa/runs/2026-05-19T14-38-19-951Z-protein_shake_full_dextrose/`
  - `/Users/scroggdawg/Code/pantheon-native/qa/runs/2026-05-19T14-38-28-640Z-protein_shake_half_dextrose/`
  - `/Users/scroggdawg/Code/pantheon-native/qa/runs/2026-05-19T14-38-37-331Z-protein_shake_no_dextrose/`
  - `/Users/scroggdawg/Code/pantheon-native/qa/runs/2026-05-19T14-38-46-015Z-double_protein_full_dextrose/`
  - `/Users/scroggdawg/Code/pantheon-native/qa/runs/2026-05-19T14-38-54-691Z-double_protein_half_dextrose/`
  - `/Users/scroggdawg/Code/pantheon-native/qa/runs/2026-05-19T14-39-03-383Z-double_protein_no_dextrose/`

Observed:

- Salmon/Taylor Farms returned no clarification.
- `the entire bag of 12.8 ounces` was ignored as a quantity-only leftover.
- Dave's bread returned as `2 slice`.
- Protein shake variants returned ingredient rows only.
- Double protein returned `50g` protein, not `75g+`.
- Protein shake native parse durations were roughly `439-682ms`.
- Salmon still took roughly `13.3s` because salmon falls through to the
  LLM/database partial-resolve path.

## Round 2 Result Snapshot

Added:

- `scripts/test-parse-meal-regressions.ts`
- `npm run test:parse-regressions`

Verified:

- `npm run test:parse-regressions`
- `npx tsc --noEmit`
- `npx eslint app/api/claude/parse-meal/route.ts lib/claude/parse-meal-library-shortcut.ts scripts/test-parse-meal-regressions.ts`

Result:

- `parse-meal regressions: 7 pass / 0 fail`
