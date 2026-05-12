# Pantheon Codex S28 Matcher Audit Handoff

Date: 2026-05-11
Author: Codex
Audience: Claude audit / successor agent
Repo: `/Users/scrogdawg/BMF Headquarters/2026 - THE NARRATIVE/26_09 Pantheon/pantheon`
Status: M3-M7 shipped to `origin/main`; Yellow decision point reached on long partial-resolve tail.

## Executive Summary

Codex took over the Op FASTRAK Brick Beta matcher cleanup arc after Claude's V20 handoff. The work stayed web-side and focused on parse-meal library matching / segmented shortcut behavior.

Shipped outcomes:
- M.3 compound segment protection: library names containing `and` / `&` no longer get split apart.
- M.4 generic overmatch guard: generic one-word queries like `coffee` no longer auto-resolve to long branded products like `REBBL Hazelnut Coffee Elixir`.
- M.5 singular/plural collapse: `banana` / `Banana` / `Bananas` no longer create equal-score gap-gate failures.
- M.6 canonical identity priority: durable `saved_meal` / `product` identities beat hourly/legacy rows when they collapse to the same food.
- M.7 restaurant-context normalization: `from McDonald's` style segments now resolve to saved meal identities instead of falling to LLM.

Current state:
- Web repo clean and synced with `origin/main` at `1014a24`.
- Focused segmented replay: `11 pass / 0 fail`.
- Safe capped replay: `10 ok / 0 errored`; replay median ~157ms on warm no-cache-clear run.
- Remaining issue is the long partial-resolve tail, especially the shrimp fajitas / chips / churros / Dos XX / margaritas utterance.

## Related Native Doc

Codex also created and pushed a native master roadmap:

- Native repo: `/Users/scrogdawg/Code/pantheon-native`
- Commit: `762fc82 Document Pantheon master roadmap`
- File: `docs/PANTHEON_MASTER_ROADMAP.md`

Doctrine in that doc:
- The order is intentional but not sacred.
- It can change with decent justification: audit findings, smoke-test evidence, dependency order, Luke priority, or newly discovered risk.
- Default principle: make Pantheon right, then fast, then beautiful, then wise.

## Operating Mode Locked With Luke

Luke approved "Codex Fast Track":

- Green: implement, verify, commit, and push without asking.
- Yellow: implement and commit after checks, then ask before push.
- Red: ask before touching.

Classification used so far:
- M3-M7 matcher fixes were treated as Green because they were narrow, replay-backed web matcher changes with no schema/data mutation.
- Broader replay was treated as Yellow because `scripts/replay-parse.ts` can touch live route behavior and external dependencies.
- `scripts/verify-alpha6-d.ts` was treated as not Green because it temporarily mutates `saved_meals.is_favorite` in production, even though it flips it back.

## Commit Trail

### `302e65f` — S28 Brick Beta M3: protect compound segmenter names

Files:
- `lib/claude/parse-meal-library-shortcut.ts`
- `scripts/test-segmented-library.ts`

Intent:
- Protect runtime saved_meal/product compound names containing `and` / `&` before segmenting transcripts.
- Example: saved meal `McDonald's Bacon Egg & Cheese Biscuit`; transcript says `Bacon Egg and Cheese Biscuit`.
- Prevent the segmenter from splitting inside that food name.

Implementation notes:
- Added runtime composite-name loading from `saved_meals` and `products`.
- Added normalized compound phrase generation around connector words.
- Preserved exact matched transcript text for `original` segments so LLM fallback still receives natural language.
- Avoided runtime library lookup for single-segment utterances.

Evidence:
- Added M3 replay cases:
  - `One Bacon Egg and Cheese Biscuit from McDonald's and one Sausage Burrito from McDonald's`
  - `McDonald's Bacon Egg and Cheese Biscuit and a coffee`
  - guardrail `3 eggs and a banana`
- Focused replay passed after iteration.

### `4b0cf27` — S28 Brick Beta M4: guard generic library overmatches

Files:
- `lib/claude/tools/search-user-library.ts`
- `scripts/test-segmented-library.ts`

Intent:
- Fix the screenshot-discovered bad behavior where generic `a coffee` resolved to `REBBL Hazelnut Coffee Elixir`.

Implementation notes:
- Added `guardedLibraryNameSimilarity`.
- For a small set of generic one-token queries (`coffee`, `tea`, `water`, `orange`, `lime`), cap score at `0.84` when the candidate name is longer/more specific.
- Exact/simple names still pass.

Evidence:
- `McDonald's Bacon Egg and Cheese Biscuit and a coffee` now partial-resolves:
  - biscuit resolved
  - `coffee` unresolved instead of REBBL

### `dea9051` — S28 Brick Beta M5: collapse plural name variants

Files:
- `lib/claude/tools/search-user-library.ts`
- `scripts/test-segmented-library.ts`

Intent:
- Fix `banana` / `Banana` / `Bananas` duplicate collision class.

Implementation notes:
- Added conservative `singularizeToken` / `normalizedNameKey`.
- Collapse exact simple singular/plural normalized name groups after prior source_ref/name cascades.
- Higher identity priority / score decides winner.

Evidence:
- `3 eggs and a banana` now full segmented resolves.
- Banana resolves to canonical product/saved entry instead of multiple equal-score candidates.

### `3881352` — S28 Brick Beta M6: prefer canonical library identities

Files:
- `lib/claude/tools/search-user-library.ts`
- `scripts/test-segmented-library.ts`

Intent:
- Fix a replay observation where `double espresso` resolved through an older USDA-backed hourly row instead of the saved meal identity.

Implementation notes:
- Added `identityPriorityFor`:
  1. favorited saved_meal
  2. saved_meal
  3. product
  4. hourly_go_to
- Added `betterIdentityCandidate`.
- Applied identity priority in source_ref dedup, exact-name canonical map, and normalized singular/plural collapse.

Evidence:
- Added source_ref prefix assertion in `scripts/test-segmented-library.ts`.
- `3 eggs and a double espresso` must resolve both foods with `lib:saved_meal:` refs.

### `1014a24` — S28 Brick Beta M7: normalize restaurant context matches

Files:
- `lib/claude/tools/search-user-library.ts`
- `lib/claude/parse-meal-library-shortcut.ts`
- `scripts/test-segmented-library.ts`

Intent:
- Fix safe replay case where:
  `One Bacon Egg and Cheese Biscuit from McDonald's and one Sausage Burrito from McDonald's`
  still went to the LLM path (~11s) instead of segmented library.

Implementation notes:
- Search normalization removes apostrophes before punctuation stripping, so `McDonald's` and `mcdonalds` align.
- Matching-side segment filler now strips:
  - `1`
  - `from`
- Original segment text remains preserved for LLM fallback.

Evidence:
- Focused harness now resolves the two McDonald's foods fully in ~386ms.
- Both source refs are `lib:saved_meal:` identities.

## Verification Commands Run

For M3-M7, Codex repeatedly ran:

```bash
npx tsx scripts/test-segmented-library.ts
npm run typecheck
npm run lint
npm run build
```

Final focused result after M7:

```text
scripts/test-segmented-library.ts
SUMMARY: 11 pass / 0 fail
```

Final build:

```text
npm run build
✓ Compiled successfully
✓ Generating static pages
```

## Safe Replay Measurement

User approved Yellow command:

```bash
npm run replay -- --no-clear-cache --limit=10
```

Important guardrails:
- `--no-clear-cache` used.
- `--limit=10` used.
- No cache clear.
- Still invokes parse route and external dependencies on misses, so keep as Yellow.

### Replay Before M7

Key result:

```text
Cases: 10 ok / 0 errored / 10 total
baseline median ms: 18599
replay median ms: 9404.5
library_shortcut_hit: 10.0%
library_segmented_full_hit: 0.0%
library_segmented_partial_hit: 30.0%
response_cache_hit: 10.0%
```

Notable tail:
- McDonald's two-item phrase still LLM path at ~11280ms.

### Replay After M7

Key result:

```text
Cases: 10 ok / 0 errored / 10 total
baseline median ms: 18599
replay median ms: 157
baseline p95 ms: 59586
replay p95 ms: 43040
library_shortcut_hit: 10.0%
library_segmented_full_hit: 10.0%
library_segmented_partial_hit: 20.0%
response_cache_hit: 60.0%
```

Notable wins:
- `Four ounces of chicken from H-E-B Fajitas Chicken Thighs and...` moved to segmented full hit at ~271ms.
- McDonald's two-item phrase was cache hit in replay at ~173ms and focused harness resolves it through segmented library.

Remaining tail:
- `Three shrimp fajitas with corn tortillas and guacamole, 20 chips with guacamole, 2 churros with chocolate sauce, three dos xx 16oz, two margaritas on the rocks`
- Replay latency ~43040ms.
- Partial resolve:
  - resolved: `Three shrimp fajitas with corn tortillas`, `guacamole`, `whipped cream`
  - unresolved: `20 chips with guacamole`, `2 churros with chocolate sauce`, `three dos xx 16oz`, `two margaritas on the rocks`

## Read-Only Matcher Probe On Remaining Tail

Codex ran a read-only probe of unresolved segments through `searchUserLibrary` with `min_score=0.5`.

Results:

```text
QUERY 20 chips with guacamole
[]

QUERY 2 churros with chocolate sauce
[
  Chocolate sauce
  source: hourly_go_to
  ref: usda:2710276
  score: 0.58
  kcal: 81
]

QUERY 3 dos xx 16oz
[]

QUERY 2 margaritas on rocks
[
  Margarita on the rocks
  source: hourly_go_to
  ref: usda:2710638
  score: 0.5
  kcal: 439
]

QUERY with half an ounce of half and half
[
  Half and half
  source: hourly_go_to
  ref: usda:2705594
  score: 0.533
  kcal: 19
]

QUERY stevia hazelnut liquid
[
  Stevia Select Premium Hazelnut Stevia
  source: product
  ref: lib:product:f9dfdaae-a540-41b1-a96f-2f4da8213fc2
  score: 0.567
  kcal: 0
]
```

Interpretation:
- The long party-meal tail is not mostly a same-canonical dedup problem anymore.
- It is a missing/weak library coverage and phrase-shape problem.
- Some pieces have weak hourly hits, but not enough for the 0.85 segmented shortcut gate.
- The next fix likely needs product/data decisions or a broader parsing strategy, not another tiny equality matcher rule.

## Open Yellow Decision Point

Remaining major tail:

```text
Three shrimp fajitas with corn tortillas and guacamole,
20 chips with guacamole,
2 churros with chocolate sauce,
three dos xx 16oz,
two margaritas on the rocks
```

Possible paths:

1. Data/pantry path:
   - Add canonical library/product entries for:
     - chips with guacamole / tortilla chips
     - churros with chocolate sauce
     - Dos Equis / Dos XX 16oz
     - margarita on the rocks
   - This likely involves production data writes, so Red unless Luke explicitly approves exact rows.

2. Matcher threshold path:
   - Lower segmented shortcut threshold for weak hourly_go_to food/drink phrases.
   - Risk: could increase false positives.
   - Yellow at least, maybe Red if it changes broad auto-commit semantics.

3. Phrase normalizer path:
   - Strip/normalize quantity and serving units better for segment matching:
     - `20 chips with guacamole` -> `chips guacamole`
     - `2 churros with chocolate sauce` -> `churros chocolate sauce`
     - `three dos xx 16oz` -> alias to `dos equis beer`
     - `two margaritas on the rocks` -> `margarita on the rocks`
   - Could be Green if limited to matching-side normalization + replay-backed.
   - But phrase-specific alcohol/restaurant assumptions may need Luke/product review.

4. Hybrid:
   - Add conservative matching-side cleanup for units/counts and `with`.
   - Defer alcohol aliases and pantry writes.

Codex recommendation before continuing:
- Start with phrase normalizer path for obviously generic filler/quantity/unit cleanup.
- Do NOT auto-add pantry rows or lower broad thresholds without Luke review.

## Files Most Relevant For Audit

- `lib/claude/tools/search-user-library.ts`
- `lib/claude/parse-meal-library-shortcut.ts`
- `scripts/test-segmented-library.ts`
- `scripts/replay-parse.ts`
- `lib/claude/parse-meal-pipeline.ts`

## Current Git State At Handoff Write

At handoff creation time, web repo was clean and synced before this doc was added:

```text
## main...origin/main
```

This handoff doc itself should be committed after creation.
