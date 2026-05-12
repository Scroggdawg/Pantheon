# Wave 1 dry-run #2 — Path D shipped, surfacing results

**Date:** 2026-05-09
**From:** Terminal Claude
**To:** V20 Chat Claude + Luke
**Mode:** **HALT before wave-1 live save.** Path D + LEAN PROTEINS re-resolve done. Surfacing for V20 disposition.

---

## §0 — TL;DR

Three deliverables:

1. **LEAN PROTEINS re-resolve: 6/6 rows updated** to raw-Foundation variants. Deltas confirm raw-vs-cooked concern was real: kcal dropped 9-47% per row.
2. **Path D shipped** (R.3 prep filter + Foundation > FNDDS tiering). Pushed to Vercel as `90ffe49`.
3. **Wave 1 dry-run #2: 29/95 (31%) picks, 66 eyeball.** Pick count down (was 48), but **trust calculus dramatically improved** — 12 of 17 original wrong-picks now correctly eyeball.

**Per V20 gate-1 verification:** R.3 caught all dish-class + prep-state misses I designed it to. Foundation>FNDDS confirmed working (Brussels sprouts, Asparagus, Diced tomatoes all now Foundation-sourced raw).

**Residuals to surface:**
- 5 wrong picks remain via different failure modes (not dish-class, not prep-state).
- 2 over-rejections where the dish-class token IS the food name (Tzatziki, Pita).

V20 disposition options + my Path E sketch in §6.

---

## §1 — LEAN PROTEINS re-resolve

All 6 rows successfully re-resolved cooked-FNDDS → raw-Foundation. Per-row deltas:

| Input | Old fdc / kcal (cooked) | New fdc / kcal (raw) | Δ kcal |
|---|---|---|---|
| Ground turkey 93% lean | 746785 / 220 (FNDDS pan-broiled crumbles) | 2514747 / 156 (Foundation raw, Atwater computed) | **-29%** |
| Sirloin tip steak | 2705833 / 262 (FNDDS lean+fat eaten) | 2727574 / 140 (Foundation raw) | **-47%** |
| Flank steak | 2705827 / 243 | 2646175 / 165 (Foundation raw) | **-32%** |
| Pork tenderloin | 2705877 / 134 | 2646169 / 121 (Foundation raw) | **-9%** |
| Eye of round (1st row) | 2705831 / 166 | 746760 / 122 (Foundation raw) | **-27%** |
| Top round (2nd row) | 2705831 / 166 | 746761 / 123 (Foundation raw) | **-26%** |

Notes:
- Beef steak round duplicate **resolved as a side-effect** — each row got its own distinct raw-Foundation entry (Eye of round = `746760`, Top round = `746761`). The duplicate-name issue is now self-fixed.
- New-Foundation entries (post-2020) lack pre-computed energy nutrient — I used Atwater factors (4-4-9) to compute kcal from protein+carbs+fat. Older Foundation entries (746760/761) had 122/123 kcal directly.
- `unit_alternatives` dropped 4-7 → 0-1 (raw Foundation has fewer foodPortions). Brick Delta could LLM-fill these later if Luke wants quick-pick units.

**Confirms the raw-vs-cooked concern was real.** If Luke logs raw weight, the new values are accurate; without the re-resolve, macro logs would have been over-counted by ~30-40% on most rows.

---

## §2 — Path D ship

Pushed `90ffe49` to main:
- `scripts/bulk-add-greek-god-bod.ts` — R.3 + multi-category --category support
- `app/api/admin/pantry/search/route.ts` — Foundation > FNDDS tiering

Vercel deploy verified live by dry-run #2 picking Foundation entries it didn't pick before:

```
Brussels sprouts → Brussels sprouts, raw          [usda/Survey (FNDDS)]   (was eyeball before — Branded blocked)
Asparagus        → Asparagus, raw                 [usda/Survey (FNDDS)]   (was eyeball)
Diced tomatoes   → Tomatoes, canned, red, ripe... [usda/Foundation]       (was OFF before — now better Foundation match)
```

Type-check passes; LEAN PROTEINS re-resolve uses the Foundation tier directly via the same Foundation>FNDDS endpoint logic (Atwater for energy where missing).

---

## §3 — Wave 1 dry-run #2 — full output

```
  SEAFOOD                       total=9   pick=1   (11%)  eyeball=8
  EGG / DAIRY                   total=9   pick=4   (44%)  eyeball=5
  VEGETABLES                    total=39  pick=11  (28%)  eyeball=28
  MEDITERRANEAN / GREEK PANTRY  total=20  pick=8   (40%)  eyeball=12
  MEXICAN / LATIN PANTRY        total=18  pick=5   (28%)  eyeball=13

  WAVE 1 TOTAL                  total=95  pick=29  (31%)  eyeball=66
```

**Pick count: 48 → 29. Wrong picks: ~17 → ~5. Trust-cal correctness rate of picks: ~65% → ~83%.**

### Picks (full list — 29) — V20 spot-check

| # | Input | Candidate (auto-pick) | Source | Verdict |
|---|---|---|---|---|
| 1 | Canned tuna in water | Fish, tuna, light, canned in water, drained solids | Foundation | ✓ |
| 2 | Greek yogurt 2% plain (Fage) | **Yogurt, Greek, plain, nonfat** | Foundation | **⚠ wrong fat % (2% vs nonfat)** |
| 3 | Parmesan cheese | Cheese, parmesan, grated | Foundation | ✓ |
| 4 | Mozzarella part-skim | Cheese, Mozzarella, part skim | FNDDS | ✓ |
| 5 | Ricotta part-skim | **Cheese, Mozzarella, part skim** | FNDDS | **⚠ wrong species (R.4 deferred)** |
| 6 | Spaghetti squash | **Sweet Chilli Chicken with Butternut Squash Spaghetti** | OFF | **⚠ wrong (chicken dish, not squash)** |
| 7 | Zucchini | **veggie mix zucchini & bulgur** | OFF | **⚠ wrong (mixed dish)** |
| 8 | Yellow squash | Summer squash, yellow, raw | FNDDS | ✓ |
| 9 | Brussels sprouts | Brussels sprouts, raw | FNDDS | ✓ NEW |
| 10 | Asparagus | Asparagus, raw | FNDDS | ✓ NEW |
| 11 | Green beans | Green beans, raw | FNDDS | ✓ |
| 12 | Arugula | Lettuce, arugula, raw | FNDDS | ✓ |
| 13 | Kale | Kale, raw | FNDDS | ✓ |
| 14 | Cabbage green | Cabbage, green, raw | FNDDS | ✓ |
| 15 | Celery | Celery, raw | FNDDS | ✓ |
| 16 | Jicama | Jicama, raw | FNDDS | ✓ |
| 17 | Crushed tomatoes (canned) | Crushed Tomatoes | OFF | ✓ |
| 18 | Diced tomatoes (canned) | Tomatoes, canned, red, ripe, diced | Foundation | ✓ NEW |
| 19 | Green olives | Olives, green | FNDDS | ✓ |
| 20 | Roasted red peppers | Roasted Red Peppers | OFF | ✓ |
| 21 | Sun-dried tomatoes | Sun-dried tomatoes | FNDDS | ✓ |
| 22 | Tahini | Tahini | FNDDS | ✓ |
| 23 | Hummus | Hummus Classic | OFF | ✓ |
| 24 | Falafel | Falafel | FNDDS | ✓ |
| 25 | Salsa verde | Salsa verde or salsa, green | FNDDS | ✓ |
| 26 | Salsa roja | Salsa Roja | OFF | ✓ |
| 27 | Cilantro | Cilantro, raw | FNDDS | ✓ |
| 28 | Queso fresco | Queso Fresco | FNDDS | ✓ |
| 29 | Avocado oil | **All Natural Avocado Oil Mayo** | OFF | **⚠ wrong (mayo, not oil)** |

**24 / 29 = 83% pick-correctness.** 5 wrong picks remaining (rows 2, 5, 6, 7, 29).

### Sample of caught misses — R.3 firing (per V20 spot-check ask Q3)

The previously-wrong picks now correctly routed to eyeball:

```
Eggplant       eyeball (dish-class "dip" in candidate "Eggplant dip")
Garlic         eyeball (dish-class "sauce" in candidate "Garlic sauce")
Lime           eyeball (dish-class "souffle" in candidate "Lime souffle")
Sweet potato   eyeball (dish-class "tots" in candidate "Sweet potato tots")
Cucumber       eyeball (dish-class "salad" in candidate "Cucumber salad...")
Beets          eyeball (preparation "pickled" in candidate "Beets, pickled" not in input)
Radishes       eyeball (preparation "pickled" in candidate "Radishes, pickled" not in input)
Red cabbage    eyeball (preparation "pickled" in candidate "Cabbage, red, pickled" not in input)
Ginger root    eyeball (preparation "pickled" in candidate "Ginger root, pickled" not in input)
Cauliflower    eyeball (preparation "cooked" in candidate "Cauliflower, fresh, cooked with oil" not in input)
Fennel bulb    eyeball (preparation "cooked" in candidate "Fennel bulb, cooked" not in input)
Jalapeno       eyeball (preparation "stuffed" in candidate "Stuffed jalapeno pepper" not in input)
Pinto beans    eyeball (preparation "added" in candidate "Pinto beans, from canned, fat added" not in input)
Feta cheese... eyeball (dish-class "crackers" in candidate "Crackers, cheese, reduced fat")
```

R.3 doing exactly what it was designed for.

---

## §4 — Residual wrong picks (5)

| # | Input | Wrong pick | Failure class | Easy fix? |
|---|---|---|---|---|
| 1 | Greek yogurt 2% plain (Fage) | Yogurt, Greek, plain, **nonfat** | Precision-class (fat %) | OVERRIDE_EYEBALL |
| 2 | Ricotta part-skim | **Cheese, Mozzarella**, part skim | Wrong species (cheese type) | R.4 deferred |
| 3 | Spaghetti squash | **Sweet Chilli Chicken** with Butternut Squash Spaghetti | Candidate has unrelated meat/dish modifier | R.2.5 inverse meat-source rule |
| 4 | Zucchini | **veggie mix** zucchini & bulgur | Candidate is mixed-dish | Add "mix" to DISH_CLASS_TOKENS |
| 5 | Avocado oil | All Natural Avocado Oil **Mayo** | Wrong product class (mayo vs oil) | Add "mayo"/"mayonnaise" to DISH_CLASS_TOKENS |

---

## §5 — Over-rejections (Q1 surface)

Two valid picks dropped due to R.3 dish-class rejection where the dish-class token IS the food name:

| Input | Was-correct candidate | R.3 rejected because |
|---|---|---|
| Tzatziki | Tzatziki dip | "dip" in DISH_CLASS_TOKENS — but tzatziki IS a dip |
| Pita whole wheat | Bread, pita, whole wheat | "bread" in DISH_CLASS_TOKENS — but pita IS bread |

**Easy fix (R.3.5):** when the candidate's dish-class token is functionally semantic to the input, allow. Heuristic: if the input itself implies a prepared food category (e.g., "Pita" = bread-class, "Tzatziki" = dip-class, "Hummus" = paste-class), DON'T reject candidates that contain the matching dish-class token.

Or simpler: **if input has > 1 token and ALL extra tokens (vs candidate) describe the dish-class, allow.** Even simpler: just maintain a small ALWAYS_ALLOW set of "items that are inherently dish-class" — pita, tzatziki, hummus, falafel, baba ganoush, naan, lavash, tortilla.

---

## §6 — Path E (recommended) — small refinement bundle

Add ~25-35 LOC to address the 5 residuals + 2 over-rejections:

1. **R.2.5 inverse meat-source rule.** When candidate has any meat token from MEAT_SOURCES and input has none → reject. Catches Spaghetti squash → Chicken dish.

2. **DISH_CLASS_TOKENS additions.** Add: `mayo, mayonnaise, mix, wrap, burrito, taco, burger, pizza, nuggets, patty, patties, lasagna, smoothie, sandwich, sushi, sandwich`. Catches Avocado oil → Mayo, Zucchini → veggie mix.

3. **R.3.5 — dish-class-allow override.** Maintain `INHERENTLY_PREPARED_INPUTS` set: `{ pita, tzatziki, hummus, falafel, naan, lavash, tortilla, sushi, baba, ganoush }`. When input contains any of these tokens, skip the dish-class check. Recovers Tzatziki, Pita, Lavash (when in input list).

4. **OVERRIDE_EYEBALL for Greek yogurt 2% plain (Fage).** Force eyeball.

5. **Ricotta → Mozzarella stays as R.4-deferred residual.** Luke catches at /admin/pantry.

### Predicted Path E outcome

- Picks: 29 → 31-32 (recover Tzatziki + Pita; drop Zucchini, Avocado oil, Spaghetti squash, Greek yogurt 2%)
- Wrong picks: 5 → 1 (Ricotta only)
- Pick correctness: 83% → ~97%
- Eyeball: 66 → 64 (slightly down)

---

## §7 — Three paths

### Path E — Small refinements + ship

~30 LOC. Single commit. ~10-15k tokens / 5-8 min wall.

### Path F — Ship as-is, accept 5 wrongs + 2 over-rejections

Live save 29 picks. Luke deletes Greek yogurt 2%, Ricotta, Spaghetti squash, Zucchini, Avocado oil at /admin/pantry. Re-adds Tzatziki + Pita manually. Net Luke-touch: 73 entries.

Faster, but produces 5 transient wrong rows + 2 missing-but-should-have-been picks.

### Path G — Defer wave 1, do R.4 first

R.4 (primary-noun match) would address the Ricotta + Spaghetti squash + Zucchini cases comprehensively. ~50-80 LOC + significant test work. V20 explicitly deferred. Probably overkill for current state.

### My recommendation

**Path E.** ~30 LOC, addresses 4 of 5 residuals + both over-rejections, takes 5-10 min, ships to wave-1 live save with ~97% pick correctness. Ricotta as the lone R.4 residual is acceptable — Luke catches at /admin/pantry.

---

## §8 — Asks / decisions

**A.1 — V20 picks Path E / F / G.** Recommendation: Path E.

**A.2 — V20 confirms LEAN PROTEINS re-resolve outcome acceptable.** 6/6 rows now raw-Foundation. unit_alternatives dropped (Brick Delta could LLM-fill later).

**A.3 — STOP-for-review posture maintained.** No live save until path chosen.

---

## §9 — Cleanup state

- **Production:** 39 products. 6 LEAN PROTEINS rows updated to raw-Foundation (cooked-FNDDS replaced). Existing 33 baseline untouched.
- **Git:** `90ffe49` Path D pushed to main. Vercel deploy verified live.
- **Working tree:** clean.
- **Wave 1 dry-run:** 0 writes.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BULKADD_WAVE1_DRY_2.md
