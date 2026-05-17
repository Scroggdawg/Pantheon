# Pantry Lightning 100-Food Sprint Plan

Date: 2026-05-17
Status: Proposed execution plan for a 5-hour Hive work block
Scope: Pantheon web pantry builder, parser identity coverage, unit intelligence, review/referee guardrails

## ELI5

The goal is not to dump 1,000 random foods into Pantheon.

The goal is to add the next 100 foods Luke is actually likely to say into the native app, with enough aliases and units that "six strawberries", "15 grams oats", "a cup of cottage cheese", "two eggs", and rambling voice-style meal descriptions resolve into boring, correct pantry identities.

If we can add 100 meaningful foods safely, we can repeat that ten times. The flywheel is:

1. Pick a high-value food lane.
2. Dry-run the pack.
3. Reject bad matches into memory.
4. Add/fix guards for new bad-match classes.
5. Apply only clean USDA basics under cap.
6. Probe whether Luke-style speech now resolves better.
7. Write a handoff before moving to the next lane.

## North Star

Pantheon should understand Luke's real speech. Luke often speaks in loose, conversational chunks: corrections, filler words, vague portions, brand shorthand, and multiple foods in one sentence. The pantry must therefore support both clean search phrases and messy utterance fragments.

Examples the system should eventually handle:

- "I had three eggs and some cottage cheese with berries."
- "Breakfast was steel cut oats, a scoop of whey, and a handful of raspberries."
- "Chicken burrito bowl with rice, beans, fajita veggies, guac."
- "Six strawberries and like 150 grams Greek yogurt."
- "Two Dos Equis and chips with guacamole."
- "Turkey bolognese over pasta, probably a cup and a half."

Accuracy is speed. A fast wrong answer is not fast if Luke has to redo it.

## Binding Guardrails

These rules stay binding for the sprint:

- Dry-run before every apply.
- Inspect generated Markdown before every apply.
- `--max-insert=25` remains the live product cap.
- Do not apply artifacts generated before the current risk engine.
- Stop on any novel auto-approved bad-match class.
- Convert novel bad-match classes into tests or referee/rejection memory before continuing.
- Do not write branded/OFF/restaurant/alcohol/supplement/recipe/composite/LLM-estimated products without explicit Luke approval.
- Do not run migrations, destructive git, production Vercel changes, native EAS/build/update/submit, or secret workarounds.

## Success Definition For The First 100

The sprint succeeds if it produces some combination of:

- 50-100 new safe pantry products.
- 25-75 new rejection-memory rows for obvious bad matches.
- 25-75 aliases to already-covered products.
- New tests for every discovered bad-match class.
- Parser probe evidence that common Luke-style utterances have fewer fallbacks and fewer wrong-confident matches.

The sprint does not need exactly 100 product inserts. A sprint that adds 40 clean products, 40 aliases, and 40 rejections may be more valuable than 100 fragile products.

## Approval Request Up Front

To work for five hours without interruption, Codex should ask Luke for these standing approvals before beginning:

### Green: approved without further interruption

- Edit pantry docs, pack files, tests, risk/referee logic, and read-only scripts.
- Run read-only Supabase/reporting commands.
- Run dry-runs for pantry packs.
- Generate local `scripts/output/` artifacts.
- Export review packets and summarize them.
- Run typecheck, lint, pantry tests, matcher tests, and resolver tests.
- Commit and push green code/doc/test changes after checks pass.

### Yellow: approved if the planner/report is boring

- Apply safe USDA `auto_approved` rows under `--max-insert=25` after Markdown inspection.
- Apply rejection-memory writes when a dry-run/planner proves there are no product inserts.
- Apply already-covered aliases when the planner proves a single unambiguous existing product target and the cap is at or below 25 aliases.

### Red: always stop and ask Luke

- Any branded/OFF/restaurant/alcohol/supplement/recipe/composite/LLM-estimated product write.
- Any cap raise above 25.
- Any schema/data migration.
- Any deletion of production rows.
- Any Vercel production deploy/promote/rollback/settings action.
- Any native EAS build/update/submit/rollback or Apple credential flow.
- Any secret printing, credential workaround, or destructive git command.
- Any auto-approved row that "feels weird" after inspection.

## The Five-Hour Work Block

### Hour 0: Re-sync And Baseline

Commands:

```bash
git pull --ff-only
npx tsx scripts/verify-pantry-governance.ts
npx tsx scripts/report-pantry-lightning-status.ts
npm run typecheck
npm run lint
npx tsx scripts/test-pantry-packs.ts
npx tsx scripts/test-pantry-builder.ts
npx tsx scripts/test-matcher-invariants.ts
npx tsx scripts/test-search-first-resolver.ts
npx tsx scripts/test-segmented-library.ts
```

Expected:

- Repo clean or only Codex-owned planned changes.
- Governance passes.
- Live pantry counts recorded.
- Existing test suite green before new pantry writes.

### Hour 1: Finish Breakfast Dairy Offset 0 Correctly

Current state:

- Guard for `with vegetables` cottage cheese mismatch is shipped.
- Fresh dry-run after the guard produced two clean auto-approved rows:
  - `steel cut oats -> Oats, whole grain, steel cut`
  - `oat bran cereal -> Cereal, oat bran, ready-to-eat`

Actions:

1. Rerun Breakfast Dairy v2 offset 0 after pulling latest.
2. Inspect Markdown.
3. If auto-approved rows are still boring USDA basics, apply them under `--max-insert=25`.
4. Rerun pantry status and focused tests.
5. Record a short handoff note if rows were applied or if the candidate set changed meaningfully.

Stop if:

- Cottage cheese, flavored yogurt, branded cereal, protein powder, protein bar, granola bar, or fused "with" food appears as auto-approved.

### Hour 2: Breakfast Dairy Offset 25

Goal:

Cover Luke's breakfast/dairy/protein-adjacent staples without crossing into brand/product-call territory.

Likely safe lane:

- plain cereals
- oats
- plain dairy basics
- plain fruit add-ons
- simple eggs
- generic milk/yogurt only when exact

Review lane:

- Magic Spoon, Kashi, Cracklin', Yasso, Silk, protein powders, protein shakes, flavored Greek yogurt, bars, "bowl" composites

Actions:

1. Dry-run `breakfast-dairy-v2.json --limit=25 --offset=25`.
2. Inspect auto-approved rows first.
3. Add guards/tests for any new bad-match class.
4. Apply only clean USDA basics under cap.
5. Export/summarize review-required rows if they reveal good Luke-facing product decisions.

### Hour 3: Sauces Condiments v2 Offset 0

Goal:

Improve the common "small calorie but frequent speech" layer: oils, sauces, sweeteners, salsa, condiments.

Why this matters:

Small condiments are easy for the parser to mangle and easy for humans to forget. They strongly affect calories over time.

Likely safe lane:

- olive oil
- butter
- honey/maple only when exact
- vinegar
- plain salsa if exact enough
- mustard/mayo only when not a green/tofu/weird variant

Review lane:

- barbecue sauce brands
- curry paste
- chili sauces with ambiguous sugar/oil
- sauces with meat
- restaurant sauces
- "with sauce" prepared foods

Special guard attention:

- `mustard` must not become mustard greens.
- `maple syrup` must not become corn syrup.
- `cinnamon` must not become sugar cinnamon.
- `salsa` must not become branded dip unless target says brand.
- `sauce` names are high-risk unless identity tokens are strong.

### Hour 4: Produce Grains / Cuisine Staples Gap Pass

Goal:

Fill boring gaps that have high speech value and strong unit value.

Preferred targets:

- countable fruits and vegetables
- cooked/plain rice and grains
- pasta basics
- beans
- tortillas only when exact
- common Mexican primitives before Chipotle composites

Voice-style probe examples:

- "six strawberries"
- "a cup of rice"
- "two corn tortillas"
- "half a cup black beans"
- "some pineapple"
- "150 grams cooked jasmine rice"

Actions:

1. Run the next conservative v2 pack window with the highest likely safe yield.
2. Add count-unit probes where imported foods have countable units.
3. Apply only exact USDA basics.

### Hour 5: Probe, Summarize, Commit

Actions:

1. Run parser/matcher focused probes for the foods added this session.
2. Run final checks:

```bash
npx tsx scripts/report-pantry-lightning-status.ts
npx tsx scripts/test-pantry-packs.ts
npx tsx scripts/test-pantry-builder.ts
npx tsx scripts/test-matcher-invariants.ts
npx tsx scripts/test-search-first-resolver.ts
npx tsx scripts/test-segmented-library.ts
npm run typecheck
npm run lint
```

3. Commit code/docs/tests/pack changes.
4. Do not commit raw `scripts/output/` artifacts unless a meaningful artifact is copied into `docs/handoffs/`.
5. Write a short handoff with:
   - product count delta
   - pantry-imported delta
   - applied run IDs
   - new rejection/alias counts
   - new bad-match classes guarded
   - next pack/window

## Ten Bricks Toward 1,000

These are the next ten repeatable bricks. Each brick can produce products, aliases, rejections, or tests.

### Brick 1: Breakfast Dairy Safe Core

Finish Breakfast Dairy v2 offsets 0 and 25.

Targets:

- oats, oat bran, plain cereal basics
- plain cottage cheese variants only when exact
- plain yogurt/milk basics only when exact
- berries and dried fruit only if not duplicates

Stop on:

- flavored yogurt mismatch
- protein powder
- brand cereal
- "with vegetables" or bowl composites

### Brick 2: Breakfast Dairy Review Compiler

Turn review-required breakfast rows into a smaller approval packet.

Buckets:

- obvious rejection memory
- already-covered aliases
- true Luke product calls
- future recipe/composite rows

Output:

- A Markdown review packet Luke can skim in minutes.
- Machine-readable rejection/alias candidates where possible.

### Brick 3: Sauces Condiments Safe Core

Add safe generic condiments/oils/sweeteners.

Targets:

- olive oil, avocado oil, butter, vinegar, soy sauce, hot sauce, ketchup, mustard, mayo, honey, maple syrup

Special requirement:

Every sauce row needs identity-token scrutiny because sauce names drift into prepared dishes.

### Brick 4: Mexican Ingredient Primitives

Add ingredients before restaurant composites.

Targets:

- corn tortillas, flour tortillas, black beans, pinto beans, cooked rice, cilantro, lime, jalapeno, salsa, guacamole only if source is acceptable

Review-only:

- Chipotle menu items, burrito bowls, queso, fajita vegetables if ambiguous, margaritas, Dos Equis

### Brick 5: Protein Cuts Round 2

Extend simple proteins.

Targets:

- chicken breast/thigh raw/cooked, turkey, lean ground beef, steak cuts, salmon, shrimp, pork chops

Hard rules:

- raw/cooked must be preserved.
- lean percentage must be preserved.
- additive/imported/choice/prime/select/blade/stuffed/flavor variants go review unless target says them.

### Brick 6: Produce Count Units

Focus on foods Luke might say by count or handful.

Targets:

- strawberries, blueberries, raspberries, banana, apple, orange, avocado, potatoes, carrots, cucumber, bell pepper, grapes

Success means:

- Unit alternatives include grams/oz plus useful count/cup units where USDA supports them.
- Speech probes like "six strawberries" and "one banana" resolve cleanly.

### Brick 7: Grains, Pasta, Beans

Add carb primitives with cooked/raw state protection.

Targets:

- cooked rice variants, oats, quinoa, pasta, rice noodles, beans, lentils, potatoes, tortillas

Stop on:

- rice flour for rice
- chips for tortillas
- noodles with cheese/meat for pasta
- raw when cooked requested

### Brick 8: Beverages And Alcohol Review Split

Separate safe beverages from protected alcohol/brand calls.

Safe-ish:

- water, black coffee, brewed tea, milk, plain coconut water if exact

Review-only:

- REBBL, coconut water brands, Dos Equis, margaritas, cocktails, energy drinks, protein drinks

### Brick 9: Brand Exact-Product Queue

Do not auto-write. Build a precise approval queue.

Targets:

- Magic Spoon flavors
- Kashi / Cracklin' Oat Bran
- Chocolate Silk
- Yasso bars
- REBBL flavors
- Harmless Harvest / Taste Nirvana / Goya coconut waters
- known protein powders

Needed evidence:

- exact product name
- flavor
- serving size
- macros
- barcode or source URL when possible

### Brick 10: Recipe And Composite Seeds

Do not force recipes into products.

Targets:

- cottage cheese bowl
- turkey bolognese
- protein shake with dextrose
- chips with guacamole
- burrito bowl
- BBQ plate
- pho / banh mi / pad thai

Output:

- recipe/saved-meal proposal docs or future schema notes, not random product rows.

## Voice-Style Test Harness

Each applied batch should get a small utterance probe list. The probe list should include:

- clean typed phrase: `steel cut oats`
- natural portion: `a cup of steel cut oats`
- metric portion: `150 grams steel cut oats`
- count portion when relevant: `six strawberries`
- multi-food utterance: `three eggs and steel cut oats`
- rambling utterance: `I had like three eggs, some oats, and a little honey`
- negative guard: phrase that should not overmatch a brand/composite

The first version can be a script or doc-backed manual probe. The future version should become a repeatable `scripts/test-pantry-utterance-probes.ts` suite.

## Unit Intelligence Checklist

Every product apply should be inspected for:

- `g`, `kg`, `lb`, `oz` standard units.
- Count units when meaningful: egg, berry, banana, tortilla, slice.
- Volume units when common: cup, tbsp, tsp, fl oz.
- Serving units only when source grams are clear.
- No weird unit label that would confuse voice parsing.

If a useful unit is missing but the food is otherwise safe, prefer adding a unit-improvement task over blocking all pantry progress.

## Review Strategy For Luke

Luke should not review giant USDA dumps.

Luke should see only:

- exact brand/flavor choices,
- restaurant defaults,
- alcohol variants,
- recipe/composite semantics,
- and truly ambiguous personal defaults.

Codex should handle:

- obvious mismatches,
- already-covered duplicates,
- simple USDA basics,
- unit sanity,
- and regression tests.

If Luke needs to review something, the packet should ask plain-English identity questions:

> If you say this phrase, should Pantheon understand it as this food?

Macros come second. If the identity is wrong, the macros are useless.

## Expected First 100 Composition

A realistic first 100 meaningful additions may look like:

- 20 breakfast/dairy/oat/cereal basics
- 20 produce/count-unit foods
- 20 protein cuts
- 15 sauces/condiments/oils
- 15 grains/beans/pasta/tortillas
- 10 beverages/simple staples

Alongside:

- 50+ rejection memory rows
- 25+ already-covered aliases
- 5-10 new risk tests

## Questions For Luke Or Peer Codex Before A Long Run

1. Is Luke granting the Yellow approval lane for safe USDA applies under 25 after Markdown inspection?
2. Is Luke granting the Yellow approval lane for rejection-memory applies when planner proves zero product inserts?
3. Is Luke granting the Yellow approval lane for already-covered alias writes under 25 when one existing product target is unambiguous?
4. Should Codex prioritize maximum safe product count or maximum parser improvement per hour if those diverge?
5. Does Luke want quick utterance samples collected before each cuisine pack, or should Codex infer from existing speech and logs until blocked?

## Immediate Next Move

Assuming the Yellow lanes are approved:

1. Pull latest.
2. Verify governance/status/tests.
3. Rerun Breakfast Dairy v2 offset 0.
4. Inspect Markdown.
5. Apply only clean auto-approved USDA basics under `--max-insert=25`.
6. Run status/tests.
7. Continue Breakfast Dairy v2 offset 25.

If Yellow lanes are not approved, continue dry-runs, guard fixes, and review/referee packet generation only.
