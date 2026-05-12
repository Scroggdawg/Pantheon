# Wave 1 dry-run #4 — Path E.1 shipped, STOP for V20 sign-off

**Date:** 2026-05-10
**From:** Terminal Claude
**To:** V20 Chat Claude + Luke
**Mode:** **STOP for V20 sign-off** before live save. Path E.1 applied + type-check clean.

---

## §0 — TL;DR

Path E.1 micro-fixes shipped:
- ✓ `canned, drained, frozen` added to PREPARATION_TOKENS
- ✓ `pickles, kimchi, sauerkraut` added to DISH_CLASS_TOKENS
- ✓ R.3.5b tightening — when input has inherently-prepared token X, candidate must also contain X (otherwise reject)

**Wave 1 dry-run #4: 14/95 (15%) picks. 2 wrong (1 expected R.4 + 1 pluralization gap).**

- ✓ Path E.1 caught all 3 dry-run-#3 misses: Green beans (now eyeball, "canned"), Cucumber (now eyeball, "pickles"), Pita whole wheat (now eyeball, R.3.5b "pita" missing in candidate).
- ⚠ 1 new wrong slipped through: **Whole wheat tortillas → Flour** — same class as Pita case but pluralization gap (`tortillas` plural not in INHERENTLY_PREPARED_INPUTS — `tortilla` singular is).
- ⚠ 2-3 over-rejections from Path E.1's `drained`+`frozen` additions: Canned tuna in water, Diced tomatoes (canned), Carrots all routed to eyeball.

**Pick correctness rate: 12/14 = 86%** (best of any dry-run yet). Trust calculus restored.

Per V20's iteration discipline + "Path E.1 should be the FINAL wave-1 refinement" + "1-2 wrongs per wave gets shipped" calibration: **recommend ship.** The 2 wrongs are within wave-2 calibration tolerance (≤5).

---

## §1 — Per-pick correctness (14 picks)

| # | Input | Candidate | Source | Verdict |
|---|---|---|---|---|
| 1 | Egg whites liquid | Liquid Egg Whites | OFF (a) | ✓ |
| 2 | Parmesan cheese | Cheese, parmesan, grated | Foundation | ✓ |
| 3 | Mozzarella part-skim | Cheese, mozzarella, low moisture, part-skim | Foundation | ✓ |
| 4 | Ricotta part-skim | Cheese, mozzarella, low moisture, part-skim | Foundation | **⚠ R.4 deferred (mozzarella ≠ ricotta)** |
| 5 | Kale | Kale, raw | Foundation | ✓ |
| 6 | Romaine hearts | Hearts of romaine | OFF (a) | ✓ NEW |
| 7 | Garlic | Garlic, raw | Foundation | ✓ |
| 8 | Jicama | Jicama, raw | FNDDS | ✓ |
| 9 | Tahini | Tahini | FNDDS | ✓ |
| 10 | Hummus | Hummus, commercial | Foundation | ✓ |
| 11 | Tzatziki | Tzatziki dip | FNDDS | ✓ |
| 12 | Falafel | Falafel | FNDDS | ✓ |
| 13 | Whole wheat tortillas | **Flour, whole wheat, unenriched** | Foundation | **⚠ pluralization gap (`tortillas` not in INHERENTLY_PREPARED_INPUTS)** |
| 14 | Cilantro | Cilantro, raw | FNDDS | ✓ |

**12 correct + 2 wrong = 86% pick correctness.**

---

## §2 — Path E.1 successes (V20 spot-check)

```
Green beans              eyeball (preparation "canned" in candidate "Beans, snap, green,
                                   canned, regular pack, drained solids" not in input)
                                   ↑ canned addition firing ✓

Cucumber                 eyeball (dish-class "pickles" in candidate "Pickles, cucumber,
                                   dill or kosher dill")
                                   ↑ pickles addition firing ✓

Pita whole wheat         eyeball (dish-class "pita" in candidate "Flour, whole wheat,
                                   unenriched")
                                   ↑ R.3.5b firing — input has "pita", candidate doesn't ✓

Carrots                  eyeball (preparation "frozen" in candidate "Carrots, frozen,
                                   unprepared" not in input)
                                   ↑ frozen addition firing
```

R.3.5b reason wording is mildly misleading (it says `"pita" in candidate "Flour..."` when actually pita is *missing* from candidate — the layer triggers reject for being absent). Cosmetic only; behavior is correct.

---

## §3 — Residual wrongs (2)

### Wrong A — Ricotta part-skim → Cheese, mozzarella (expected R.4 residual)

V20-acknowledged in dry-run #2 review. R.4 (primary-noun match) deferred. Luke catches at /admin/pantry. ✓

### Wrong B — Whole wheat tortillas → Flour, whole wheat, unenriched (NEW — pluralization gap)

`INHERENTLY_PREPARED_INPUTS` has `tortilla` (singular). Input "Whole wheat tortillas" tokenizes to `{whole, wheat, tortillas}` (plural). `inputPreparedToken()` returns null because `tortillas` ≠ `tortilla`. Falls through to normal dish-class check. Candidate `Flour, whole wheat, unenriched` has no dish-class token. PASS → wrong pick.

**Same failure class as Pita-Flour but pluralization-missed.** Two paths:
- Add `tortillas` (and other plurals) to INHERENTLY_PREPARED_INPUTS — 1 LOC.
- Ship as-is, accept as 2nd wrong-pick. Luke deletes at /admin/pantry.

Per V20's "Path E.1 should be the FINAL wave-1 refinement" rule, I'd lean toward ship. 1-LOC fix would be Path E.2; V20 explicitly closed mid-wave-1 refinement loop.

---

## §4 — Path E.1 over-rejections (V20 Q1 awareness)

Three previously-correct picks now eyeball due to Path E.1's `drained`+`frozen` additions:

| Input | Candidate | Why eyeball |
|---|---|---|
| Canned tuna in water | Fish, tuna, light, canned in water, drained solids | "drained" in candidate, not in input |
| Diced tomatoes (canned) | Tomatoes, canned, cooked | "cooked" in candidate, not in input |
| Carrots | Carrots, frozen, unprepared | "frozen" in candidate, not in input — Carrots input is generic, not frozen |

**Carrots eyeball is correct** — input doesn't specify frozen.

**Canned tuna + Diced tomatoes are technically over-rejections.** Canning is a preservation method that involves heat (so candidate has "drained" / "cooked"). The macros for "Tuna, canned in water" and "Tuna, drained" are the same. R.3 is being conservative — Luke handles at /admin/pantry.

These are V20's Q1 anticipated over-rejections. Cost: 2 valid picks lost. Trust calculus benefit: 0 wrong-picks added.

---

## §5 — Composition delta across all wave-1 dry-runs

| Run | Code state | Picks | Wrong | Correctness rate |
|---|---|---|---|---|
| 1 | base | 48 | ~17 | ~65% |
| 2 | + Path D (R.3 + Foundation>FNDDS) | 29 | ~5 | 83% |
| 3 | + Path E (R.2.5 + dish-class additions + R.3.5 + override) | 22 | 5 | 73% |
| **4** | **+ Path E.1 (canned/drained/frozen + pickles + R.3.5b)** | **14** | **2** | **86%** |

Trust calculus arc: 65% → 83% → 73% → **86%**. Lowest pick count (14) but highest correctness rate.

---

## §6 — Sign-off ask

**A.1 — V20 sign-off to live save.** 14 picks (2 wrong: Ricotta R.4 + Whole wheat tortillas pluralization).

**A.2 — V20 disposition on Whole wheat tortillas:**
- Option α: ship as-is. Luke deletes. (Per V20's "Path E.1 should be the FINAL wave-1 refinement.")
- Option β: 1-LOC add `tortillas` to INHERENTLY_PREPARED_INPUTS, re-dry-run, then live save. (Path E.2 of sorts.)

My recommendation: **Option α (ship).** 12 correct + 2 wrong is well within V20's wave-2 calibration tolerance, and the Tortillas wrong-pick is trivially detectable by Luke (Flour ≠ Tortillas).

**A.3 — STOP-for-review posture maintained.** No live save until V20 sign-off.

---

## §7 — On approval — live save plan

1. **Commit** — single commit for Path E + Path E.1 (~50 LOC bundle):
   - R.2.5 inverse meat-source check
   - DISH_CLASS additions: mayo/mayonnaise/mix/wrap/burrito/taco/burger/pizza/nuggets/patty/patties/lasagna/smoothie/sandwich/sushi/pickles/kimchi/sauerkraut
   - PREP additions: canned/drained/frozen
   - R.3.5 + R.3.5b inherently-prepared override
   - OVERRIDE_EYEBALL Greek yogurt 2% plain (Fage)
   - inverse-meat-fail + dish-class-fail/preparation-fail surface messages
2. **Live save** — `npx tsx scripts/bulk-add-greek-god-bod.ts --category="SEAFOOD,EGG / DAIRY,VEGETABLES,MEDITERRANEAN / GREEK PANTRY,MEXICAN / LATIN PANTRY"`
3. **Spot-check** — independent USDA verify on 2-3 saved rows (calorie sanity).
4. **Surface results** — per-row save log + product_ids + pick correctness.
5. **STOP for Luke confirmation** before wave 2.

Cumulative library after wave 1 live save: 39 + 14 = **53 products** (vs V20 original estimate of ~70-80 if Path B+R.1 had stuck; reflects the conservative trust-cal trade).

---

## §8 — Cleanup state

- **Path E + E.1 changes uncommitted.** Tree dirty on `scripts/bulk-add-greek-god-bod.ts`.
- **Production: 39 products.** No new writes since LEAN PROTEINS re-resolve.
- **Wave 1 dry-run #4: 0 writes.**

On V20 sign-off, single commit + live save in one shot.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BULKADD_WAVE1_DRY_4.md
