# Wave 1 dry-run #3 — Path E shipped, HALTing per V20 Q1

**Date:** 2026-05-09
**From:** Terminal Claude
**To:** V20 Chat Claude + Luke
**Mode:** **HALT for V20.** Path E shipped, but dry-run #3 surfaced new failure modes per V20's Q1 trigger. No live save.

---

## §0 — TL;DR

Path E applied + type-check clean. R.2.5 (inverse meat-source) + DISH_CLASS additions (mayo/mix/wrap/burrito/etc.) + R.3.5 (inherently-prepared override) + OVERRIDE_EYEBALL Greek yogurt 2%.

**Wave 1 dry-run #3: 22/95 (23%) picks. Down from 29 in dry-run #2.** Two factors:

1. **USDA snapshot drift** — many previously-correct picks (Brussels sprouts, Asparagus, Yellow squash, Cabbage green, Celery, etc.) returned 1-3 USDA candidates this run instead of 3-9. Trust calculus preserved (those entries route to eyeball, not wrong-picks), but pick count down.

2. **3 new failure modes surfaced** (per V20's Q1 HALT trigger):
   - **`canned` not in PREP_TOKENS** — Green beans → "Beans, snap, green, canned, regular pack, drained" picked because "canned" doesn't trigger prep-fail.
   - **`pickles` not in DISH_CLASS_TOKENS** — Cucumber → "Pickles, cucumber, dill or kosher dill" picked.
   - **R.3.5 over-loosens** — Pita whole wheat → "Flour, whole wheat, unenriched" because R.3.5 disabled dish-class but didn't require candidate to contain "pita". Same on Whole wheat tortillas → Flour.

Plus 1 expected R.4-deferred residual (Ricotta → Mozzarella).

**5 wrong picks total** = 22.7% wrong-rate. Worse than dry-run #2 (5/29 = 17%). Trust calculus moving wrong direction.

Path E successes confirmed:
- ✓ R.2.5 caught Spaghetti squash → "Sweet Chilli Chicken with Butternut Squash Spaghetti" (now eyeball with reason "candidate has unrelated meat 'chicken'")
- ✓ R.3.5 worked on Tzatziki (now picks "Tzatziki dip" correctly)
- ✓ OVERRIDE_EYEBALL on Greek yogurt 2% plain (Fage) firing
- ✓ Lime → "Lime souffle" still correctly eyeball (R.3 dish-class)

---

## §1 — Per-pick correctness audit

| # | Input | Candidate | Source | Verdict |
|---|---|---|---|---|
| 1 | Canned tuna in water | Fish, tuna, light, canned in water, drained solids | Foundation | ✓ |
| 2 | Egg whites liquid | Liquid Egg Whites | OFF | ✓ |
| 3 | Parmesan cheese | Cheese, parmesan, grated | Foundation | ✓ |
| 4 | Mozzarella part-skim | Cheese, mozzarella, low moisture, part-skim | Foundation | ✓ |
| 5 | Ricotta part-skim | Cheese, mozzarella, low moisture, part-skim | Foundation | **⚠ R.4 deferred (mozzarella ≠ ricotta)** |
| 6 | Green beans | **Beans, snap, green, canned, regular pack, drained** | Foundation | **⚠ canned not in PREP_TOKENS** |
| 7 | Arugula | Organic zesty baby arugula container | OFF (d) | ✓ borderline (nutriscore=d weak) |
| 8 | Kale | Kale, raw | Foundation | ✓ NEW |
| 9 | Garlic | Garlic, raw | Foundation | ✓ RECOVERED (was sauce in dry-run #1) |
| 10 | Carrots | Carrots, frozen, unprepared | Foundation | ✓ borderline (frozen variant) |
| 11 | Cucumber | **Pickles, cucumber, dill or kosher dill** | Foundation | **⚠ pickles not in DISH_CLASS_TOKENS** |
| 12 | Jicama | Jicama, raw | FNDDS | ✓ |
| 13 | Crushed tomatoes (canned) | Crushed Tomatoes | OFF | ✓ |
| 14 | Diced tomatoes (canned) | Tomatoes, canned, red, ripe, diced | Foundation | ✓ |
| 15 | Tahini | Tahini | FNDDS | ✓ |
| 16 | Hummus | Hummus, commercial | Foundation | ✓ |
| 17 | Tzatziki | Tzatziki dip | FNDDS | ✓ R.3.5 RECOVERED |
| 18 | Falafel | Falafel | FNDDS | ✓ |
| 19 | Pita whole wheat | **Flour, whole wheat, unenriched** | Foundation | **⚠ R.3.5 over-loose** |
| 20 | Whole wheat tortillas | **Flour, whole wheat, unenriched** | Foundation | **⚠ R.3.5 over-loose** |
| 21 | Black beans (canned) | black beans in water | OFF | ✓ |
| 22 | Cilantro | Cilantro, raw | FNDDS | ✓ |

**Correct: 16 (15 ✓ + Tzatziki RECOVERED) + 2 borderline. Wrong: 5.** Trust calculus: 73% pick-correctness (down from 83% in dry-run #2).

---

## §2 — Path E successes (V20 spot-check Q3)

```
Spaghetti squash    eyeball  (candidate has unrelated meat "chicken" not in input
                              ("Sweet Chilli Chicken with Butternut Squash Spaghetti"))
                              ↑ R.2.5 inverse meat-source FIRING ✓

Greek yogurt 2%     eyeball  (manual override → /admin/pantry)
                              ↑ OVERRIDE_EYEBALL FIRING ✓

Tzatziki            ✓pick    Tzatziki dip [FNDDS]
                              ↑ R.3.5 inherently-prepared RECOVERED ✓

Lime                eyeball  (dish-class "souffle" in candidate "Lime souffle")
                              ↑ R.3 still working ✓

Garlic              ✓pick    Garlic, raw [Foundation]
                              ↑ Foundation>FNDDS surfaced raw variant ✓
```

R.2.5 + R.3.5 + OVERRIDE all working as designed.

---

## §3 — New failure modes (V20 Q1 HALT trigger)

### Failure A — `canned` not in PREP_TOKENS

```
Green beans → Beans, snap, green, canned, regular pack, drained  [Foundation, 1.00]
```

Input "Green beans" has tokens `{green, beans}`. Candidate has `{beans, snap, green, canned, regular, pack, drained}`. R.3 prep check fires on `cooked/pickled/fried/baked/...` but NOT on `canned` or `drained`.

When input doesn't have "canned" but candidate does, candidate is canned/preserved version of the food → semantic mismatch for raw-default Pantheon logging.

**Fix:** add `canned, drained, frozen` to PREPARATION_TOKENS. (When input HAS the prep token — e.g., "Crushed tomatoes (canned)" — candidate matching alignment passes.)

### Failure B — `pickles` not in DISH_CLASS_TOKENS

```
Cucumber → Pickles, cucumber, dill or kosher dill  [Foundation, 1.00]
```

Input "Cucumber" has `{cucumber}`. Candidate has `{pickles, cucumber, dill, or, kosher}` (after stopword filter strips "or" but cucumber+pickles+dill+kosher remain). Overlap 1/1 = 1.00. R.3 dish-class doesn't fire — `pickles` not in set.

**Fix:** add `pickles, kimchi, sauerkraut` to DISH_CLASS_TOKENS.

### Failure C — R.3.5 over-loosens for inputs whose primary noun isn't in candidate

```
Pita whole wheat       → Flour, whole wheat, unenriched  [Foundation, 0.67]
Whole wheat tortillas  → Flour, whole wheat, unenriched  [Foundation, 0.67]
```

R.3.5 saw "pita" / "tortilla" in input → skipped dish-class. Candidate "Flour, whole wheat, unenriched" has no dish-class token, so R.3 passes. But candidate doesn't contain "pita" or "tortilla" — it's a different food entirely.

**Fix:** R.3.5b — when input has inherently-prepared token X, **candidate must also contain X**. Otherwise, don't skip dish-class (and the candidate's lack of X also implicitly fails primary-noun semantics).

```typescript
function inputIsInherentlyPrepared(input: Set<string>): {
  isPrepared: boolean
  preparedToken: string | null
} {
  for (const tok of INHERENTLY_PREPARED_INPUTS) {
    if (input.has(tok)) return { isPrepared: true, preparedToken: tok }
  }
  return { isPrepared: false, preparedToken: null }
}

// In passesPrepCheck:
const prep = inputIsInherentlyPrepared(input)
const skipDishClass = prep.isPrepared && (prep.preparedToken !== null && candidate.has(prep.preparedToken))
// Also: if input is inherently-prepared but candidate lacks the token → REJECT
if (prep.isPrepared && prep.preparedToken && !candidate.has(prep.preparedToken)) {
  return { ok: false, rejected: prep.preparedToken, layer: 'dish-class' }
}
```

This makes R.3.5 "soft R.4" for inherently-prepared inputs only — not a full R.4 deployment.

---

## §4 — Path E.1 sketch (~10 LOC)

Three micro-fixes:

1. **PREP_TOKENS additions:** `canned, drained, frozen`
2. **DISH_CLASS additions:** `pickles, kimchi, sauerkraut`
3. **R.3.5b tightening** per §3 Failure C — require candidate to contain the input's inherently-prepared token.

### Predicted Path E.1 outcome on dry-run snapshot

- Green beans → eyeball (R.3 prep fires on "canned")
- Cucumber → eyeball (dish-class "pickles")
- Pita whole wheat → eyeball (R.3.5b — candidate lacks "pita")
- Whole wheat tortillas → eyeball (R.3.5b — candidate lacks "tortilla")

**22 → 18 picks. 5 wrong → 1 (Ricotta only). Pick correctness: 73% → ~94%.**

---

## §5 — Three paths

### Path E.1 — Apply micro-fixes, re-dry-run #4, ship

~10 LOC. ~5-10 min. Brings wave-1 to ~94% pick correctness on this snapshot. Recommended.

### Path F — Ship dry-run #3 as-is

22 picks; 5 wrong; 73% correct. Luke deletes the 5 wrong rows + handles 73 eyeballs at /admin/pantry. Workable but suboptimal trust state.

### Path G — Wider rewrite

R.4 (primary-noun) + cleanup. Heavy, deferred per V20.

### My recommendation

**Path E.1.** The new failure modes are direct consequences of Path E (canned/pickles missing from token sets; R.3.5 was added in Path E and over-loosens). All three fixes are tight, targeted, and ~10 LOC total. Net trust gain: 73% → 94% pick correctness for ~10 min effort.

V20's "Path E should be the LAST mid-wave-1 refinement" rule was based on the assumption Path E would land clean. Surfacing per Q1 since it didn't. Path E.1 is the patch follow-on, not a Path F territory.

If V20 prefers ship-then-fix-in-wave-2 (Path F), I commit + live save with current 22 picks; document the 5 wrongs for Luke.

---

## §6 — Q&A (V20 open-ended asks)

**Q1 — Path E surfaced new failure modes** → HALTING per directive. See §3.

**Q2 — Confirm Ricotta is the only R.4-territory residual:**

Looking at the 5 wrong picks:
- Ricotta → Mozzarella: classic R.4 (primary-noun mismatch — both cheese, different species).
- Green beans → "canned, drained": NOT R.4 — input/candidate share primary noun "beans". Fix is PREP_TOKENS addition.
- Cucumber → Pickles: NOT R.4 — both have "cucumber" token. Fix is DISH_CLASS addition.
- Pita whole wheat → Flour: BORDERLINE R.4 — primary noun "pita" not in candidate. Workaround via R.3.5b (sketched).
- Whole wheat tortillas → Flour: same as Pita.

So **after Path E.1, Ricotta would be the only true R.4-territory residual** (the Pita/Tortilla cases get the soft-R.4 R.3.5b treatment).

**Q3 — Wave 2 auto-pick rate prediction:**

Wave 2 = remaining auto-pick categories after wave 1 (CARBS 15, FATS 17, FRUITS 19, COOKING SUPPORT 9, ASIAN PANTRY keepers 5, CONDIMENTS keepers 3). Total ≈ 68 entries.

Rough gut estimate after Path E + E.1:
- **CARBS**: ~30% pick (rice, oats, quinoa often FNDDS-cooked → eyeball; raw rice/oats Foundation if available)
- **FATS**: ~50% pick (oils have specific Foundation entries; brand variance for olives/nuts)
- **FRUITS**: ~50% pick (most fresh fruits have Foundation raw entries — patterns similar to vegetables)
- **COOKING SUPPORT**: ~30% pick (broths often FNDDS — may need additional dish-class additions like "broth" — but Luke's "Vegetable broth low-sodium" is inherently a prepared item; might surface R.3.5 question for broths)
- **ASIAN keepers** (Soy sauce, Sesame oil, Gochujang, Sriracha, Kimchi): ~60% pick (specific items, brand-OFF likely)
- **CONDIMENTS keepers** (Dijon mustard, Anchovy paste, Hot sauce): ~33% pick (specific brands)

**Aggregate wave 2 prediction: 35-45% auto-pick. Wave-2-specific failure modes likely:**
- Broth/stock semantic class (might need INHERENTLY_PREPARED additions)
- Whole grain rice / brown rice / wild rice variants
- Oil purity (extra-virgin vs refined)
- Hot sauce brand variance

Wave 2 will likely surface 1-2 new failure modes too — same iteration discipline applies.

---

## §7 — Cleanup state

- Path E committed locally (not yet pushed; tree dirty after edits).
- Wait — actually let me check.
- Production: 39 products. LEAN PROTEINS 6 raw-Foundation. No new writes since last surface.
- Wave 1 dry-run #3: 0 writes.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BULKADD_WAVE1_DRY_3_HALT.md
