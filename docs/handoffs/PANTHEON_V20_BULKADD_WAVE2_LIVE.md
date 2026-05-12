# Wave 2 LIVE SAVE — auto-disposition per V20 calibration

**Date:** 2026-05-10
**From:** Terminal Claude
**To:** V20 Chat Claude + Luke
**Mode:** Wave 2 dry-run + live save complete (auto-fired per V20 calibration ≤5 wrongs + no new failure class). **STOP for Luke confirmation** before wave 3.

---

## §0 — TL;DR

- **Dry-run:** 12 picks (18%), 4 wrong, 1 dedup-skip. **Auto-disposition: LIVE SAVE.**
- **Live save:** **10 saved, 3 fail, 54 eyeball, 1 dedup.** USDA snapshot drift between dry-run + live → 12 picks predicted, 13 attempted, 10 succeeded.
- **Library: 58 → 68 products.**
- **3 wrong picks saved** (1 NEW + 2 same-class as wave 1).
- **3 save-failures** (all OFF-source rows; per-row error not surfaced cleanly).

V20 calibration tolerance: ≤5 wrongs → check. No new structural failure class → check. Auto-disposition fired.

---

## §1 — Saved entries (10) per-row audit

| # | Input | Saved as | Source | Verdict |
|---|---|---|---|---|
| 1 | Brown rice | **Flour, rice, brown** | Foundation | **⚠ wrong (flour, not rice grain)** |
| 2 | Couscous whole wheat | **Flour, whole wheat, unenriched** | Foundation | **⚠ wrong (flour, not couscous)** |
| 3 | Whole wheat pasta | **Flour, whole wheat, unenriched** | Foundation | **⚠ wrong (flour, not pasta)** |
| 4 | Extra virgin olive oil | EXTRA VIRGIN OLIVE OIL | OFF (b) | ✓ |
| 5 | Coconut oil | Oil, coconut | Foundation | ✓ |
| 6 | Ghee | Ghee, clarified butter | FNDDS | ✓ |
| 7 | Lemon | Lemon, raw | FNDDS | ✓ |
| 8 | Orange | **Biscuit soja orange** | OFF (c) | **⚠ wrong NEW (soy biscuit, not orange fruit)** |
| 9 | Cantaloupe | Melons, cantaloupe, raw | Foundation | ✓ |
| 10 | Gochujang | Gochujang Brown Rice Red Pepper Paste | OFF (e) | ✓ correct food (gochujang IS a paste) |

**6 ✓ + 4 wrong = 60% pick correctness.** Below wave 1's 79-89% but within calibration (4 < 5 wrongs).

---

## §2 — Wrong-pick failure class analysis

**3 of 4 wrongs are SAME class as wave 1 Tortillas → Flour:**
- Brown rice → Flour, rice, brown
- Couscous whole wheat → Flour, whole wheat, unenriched
- Whole wheat pasta → Flour, whole wheat, unenriched

The pattern: input is a specific carb item (rice grain, couscous, pasta), USDA Foundation has an entry "Flour, X" that scores high overlap because input tokens are subset. R.3.5b only fires for inputs with `{pita, tzatziki, hummus, falafel, naan, lavash, tortilla, sushi, baba, ganoush}`. Doesn't cover rice/couscous/pasta.

**Same class, not new structural failure** — V20 calibration doesn't trigger HALT.

**1 NEW wrong is the Lime/Tourtel-class** (OFF brand-name match with extra context):
- Orange → "Biscuit soja orange" (soy biscuit branded with orange flavor)

This is the second occurrence of OFF-brand-fluff producing wrong picks (first was Lime → Tourtel beer in wave 1). Lime-class is acknowledged from V20 wave-1 close. Not new.

---

## §3 — Save-failures (3) — same OFF-source pattern

```
Quinoa                  → Tartines craquantes quinoa - pois chiche sans glut [OFF b]   FAILED
Anchovy paste           → Cento, anchovy paste 100% italian                  [OFF e]   FAILED
Almond milk unsweetened → Organic Unsweetened Almond Non-Dairy Beverage Vani [OFF b]   FAILED
```

All 3 failures are OFF-source rows. Per-row error not surfaced (script logs `'unknown'`). Pattern suggests:
- French text + special chars in OFF data ("Tartines craquantes quinoa - pois chiche sans glut")
- Very long brand strings ("Organic Unsweetened Almond Non-Dairy Beverage Vanilla")
- Possibly DB constraint hits (name length, charset, missing fields)

**Same save-fail-no-detail pattern as wave 1's Crushed tomatoes.** Worth a doctrine note for Brick Delta: investigate OFF-row save shape compatibility.

**Disposition:** Luke manually adds Quinoa, Anchovy paste, Almond milk unsweetened at /admin/pantry. Plus Crushed tomatoes (canned) carryover from wave 1 = 4 manual adds.

---

## §4 — Action list for Luke

### Wrong rows to DELETE (4)

```
1. id=44fcdacf-a691-4fc0-88c4-02b89dbd833e
   "Flour, rice, brown"  (was Brown rice — wrong)

2. id=5ffb9385-1519-4211-8542-6ebd1c806b92  +  id=3f9c78b6-ce0d-4a16-9d4d-9d5633d083a0
   "Flour, whole wheat, unenriched" (was Couscous + Pasta — both wrong, 2 rows)

3. id=9a071714-b88e-42ed-9ca4-9dc82dbbd38a
   "Biscuit soja orange"  (was Orange — wrong)

4. (carry-over from wave 1)
   id=c256b661-cd31-4c61-bb66-64483233ef76
   "Flour, whole wheat, unenriched"  (was Whole wheat tortillas — wrong)
   ↑ TRIPLE Flour duplicate now: all three IDs above + this one. All four should DELETE.
```

So total **4 "Flour, whole wheat" rows** in DB right now (1 from wave 1 Tortillas + 2 from wave 2 Couscous/Pasta + the Brown rice Flour). All 4 should be deleted.

### Save-failed — manual ADD at /admin/pantry (4)

```
- Crushed tomatoes (canned)  — wave 1 carryover
- Quinoa                     — wave 2 fail
- Anchovy paste              — wave 2 fail
- Almond milk unsweetened    — wave 2 fail
```

### Eyeball list (54 wave 2)

Per-category:
- CARBS: 11 (Jasmine rice, Basmati rice, Wild rice, Farro, Bulgur wheat, Lentils dried, Chickpeas canned/dried, Steel cut oats, Sourdough bread, Ezekiel bread)
- FATS: 13 (Avocado oil, Almonds, Walnuts, Pistachios, Cashews, Pecans, Sunflower seeds, Pumpkin seeds, Chia seeds, Flax seeds, Hemp hearts, Almond butter, Peanut butter natural)
- FRUITS: 16 (most fruits — USDA Foundation candidates were thin this snapshot)
- ASIAN PANTRY: 4 (Soy sauce low-sodium, Sesame oil, Sriracha, Kimchi — Kimchi rejected by R.3 dish-class on its own name)
- CONDIMENTS keepers: 2 (Dijon mustard, Hot sauce)
- COOKING / SUPPORT: 8 (all broths + non-dairy milks — none had above-threshold matches)

**Total Luke /admin/pantry work for wave 2:** 54 eyeball + 4 deletes + 4 manual adds = **~62 entries**.

**Cumulative across waves 1+2:** ~75 wave-1 + ~62 wave-2 = ~137 manual entries Luke handles at /admin/pantry.

### Borderline saved row to verify (1)

```
Gochujang → "Gochujang Brown Rice Red Pepper Paste" [OFF nutriscore=e, 216 kcal]
  ↑ Correct food (gochujang IS a paste with brown rice + red pepper).
    Nutriscore=e is poor (gochujang is high-sodium / high-sugar by nature).
    Macros at 216kcal/100g — verify reasonable (typical gochujang ~200-220 kcal/100g).
```

Looks reasonable. Keep.

---

## §5 — V20 spot-check (Q3 prediction patterns)

V20 predicted patterns; observed:

| Pattern | Observed | Notes |
|---|---|---|
| Broth/stock semantic class | All 4 broths eyeball | Foundation/FNDDS thin; not wrong-pick; possible future INHERENTLY_PREPARED_INPUTS additions (broth, stock, milk) |
| Whole-grain rice variants | Wrong-pick: Brown rice → Flour | Same class as Tortillas → Flour |
| Oil purity | EVOO ✓; Coconut oil ✓; Avocado oil eyeball | Foundation has correct oils |
| Hot sauce brand variance | Hot sauce eyeball | OFF returned matches but below threshold |
| Lime/Tourtel-class OFF alcohol | Orange → "Biscuit soja orange" | OFF brand-fluff with input keyword. Recurring pattern. |

---

## §6 — Cumulative library state

```
Pre-Op-FASTRAK baseline:                      33 products
+ LEAN PROTEINS live save:                    +6  → 39
  (LEAN PROTEINS raw re-resolve: in-place)
+ Wave 1 live save:                          +19  → 58
+ Wave 2 live save:                          +10  → 68
                                              ───
                                              68 products
After Luke deletes 7 wrong rows
  (4 Flour + Lime/Tourtel + Biscuit soja + Mozzarella dup):
                                              ~61 products
After Luke handles ~137 eyeball + manual adds:
                                              ~190-200 products

Greek God Bod target after pruning:           ~181 (201 entries
                                                    minus 20 RECIPE
                                                    ANCHORS)
```

Reachable. ~5-10 entries below target after RECIPE ANCHORS skip is intentional (those need manual LLM-fill).

---

## §7 — Wave 3?

**There is no wave 3.** Per scope:
- Wave 1 = SEAFOOD + EGG/DAIRY + VEGETABLES + MED-GREEK + MEXICAN = 95 (live ✓)
- Wave 2 = CARBS + FATS + FRUITS + ASIAN keepers + CONDIMENTS keepers + COOKING SUPPORT = 68 (live ✓)
- LEAN PROTEINS already shipped ahead of waves
- HERBS+SPICES skipped (24 entries, recipe-internal)
- RECIPE ANCHORS = 20 (manual at /admin/pantry, never auto)

**Total auto-pick territory complete.** Remaining = Luke at /admin/pantry.

---

## §8 — Q&A

**V20 calibration check:**
- 4 wrong picks → ≤5 → ship ✓
- 0 new structural failure classes → ship ✓
- (Same class as Tortillas/Lime/Orange already-acknowledged) ✓

**Save-fail rate:** 3/13 attempted picks = 23%. All OFF-source. **Doctrine note candidate:** investigate OFF-row save endpoint compatibility for Brick Delta. Pattern:
- French text + special chars
- Very long descriptive names
- Possible nutriment field gaps

---

## §9 — Asks / decisions

**A.1 — Luke confirms wave 2 state.** Visit /admin/pantry. Verify 10 saves; plan 4 deletes + 4 manual adds.

**A.2 — Op FASTRAK Greek God Bod bulk-add: COMPLETE on the auto-pick side.** All wave-targeted categories executed. Remaining work is Luke-side at /admin/pantry.

**A.3 — On Luke confirmation: standby for Brick Delta scoping.** Cleanup items queued for Brick Delta:
- Re-resolve Wave 1+2 wrong-picks (delete + re-add via correct paths)
- Re-resolve OFF rows with poor nutriscore where Foundation alternatives exist
- LLM-fill unit_alternatives where USDA Foundation has 0 portions
- Fix LEAN PROTEINS unit_alternatives drop (Brick Delta could pull from FNDDS portions even though main row uses Foundation macros)
- Investigate OFF save-fail pattern (3 rows rejected by save endpoint)
- Optional R.4 (primary-noun match) revisit if Ricotta/Pita-class issues recur

**A.4 — STOP-for-review posture.** No further bulk-add until Luke confirms.

---

## §10 — Cleanup state

- **Production: 68 products.** 33 baseline + 6 LEAN PROTEINS + 19 wave-1 + 10 wave-2.
- **Git: HEAD is `bfa4658` (Path E + E.1 commit).** Working tree clean.
- **Wave 2 dry-run: 0 writes.** Wave 2 live save: 10 inserts + 3 attempted-and-failed.
- **/tmp scripts: ephemeral.**

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BULKADD_WAVE2_LIVE.md
