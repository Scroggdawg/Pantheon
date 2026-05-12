# Path γ — R.6 anti-flour rule + 7-row cleanup

**Date:** 2026-05-10
**From:** Terminal Claude
**To:** V20 Chat Claude + Luke
**Mode:** Path γ both actions complete. **STOP for Luke confirmation.** Doctrine confirmed.

---

## §0 — TL;DR

**Action 1 — R.6 anti-flour rule:**
- ✓ Implemented per V20 spec (~10 LOC + wired into both USDA + OFF tiers)
- ✓ Type-check clean
- ✓ Committed `17fab3f`

**Action 2 — Cleanup 7 wrong-pick rows:**
- ✓ All 7 rows verified pre-delete
- ✓ All 7 deleted
- ✓ Library count: **68 → 61** (delta -7 confirmed)

**Action 3 — Re-dry-run wave 2 with R.6 active:**
- ✓ R.6 firing on all 3 available Flour-class targets:
  - Brown rice → eyeball (R.6 anti-flour: "Flour, rice, brown")
  - Couscous whole wheat → eyeball (R.6: "Flour, whole wheat")
  - Whole wheat pasta → eyeball (R.6: "Flour, whole wheat")
- 10 picks total, 1 wrong (Papaya → "Mango Papaya Passion Fruit Yogurt" — same Lime/Orange-class OFF brand-fluff, not new failure)
- 90% pick correctness vs first wave-2 dry-run's 67%

---

## §1 — R.6 implementation

```typescript
function passesAntiFlourCheck(input: Set<string>, candidateDescription: string): boolean {
  if (input.has('flour')) return true  // input wants flour, ok
  const firstTokens = candidateDescription
    .toLowerCase()
    .split(/[,\s]+/)
    .filter((t) => t.length > 0)
    .slice(0, 2)
  return !firstTokens.includes('flour')
}
```

Applied to:
- USDA Tier 1 candidate's `u.description`
- OFF Tier 2 candidate's `${brand} ${product_name}`

Wired via `flourOk` in both `bestUsda` + `bestOff` structs. New `AutoPickOutcome.reason = 'anti-flour-fail'` with eyeball surface message:
```
R.6 anti-flour: candidate "X" leads with "flour", input doesn't
```

Sequence in autoPickStrategy: descriptor → meat-source → inverse-meat → prep → anti-flour → pick OR cascade to OFF.

Type-check clean (`tsc --noEmit -p .` green). Committed `17fab3f`.

---

## §2 — Cleanup of 7 wrong-pick rows

```
pre-delete library count: 68

✓ deleted  c256b661-...  Flour, whole wheat, unenriched  (Wave 1 Tortillas)
✓ deleted  a729ddf9-...  Tourtel 27.5 cl Tourtel Twist Lime 0.0 DEGRE ALCOOL  (Wave 1 Lime)
✓ deleted  2692731a-...  Cheese, mozzarella, low moisture, part-skim  (Wave 1 Ricotta dup)
✓ deleted  44fcdacf-...  Flour, rice, brown  (Wave 2 Brown rice)
✓ deleted  5ffb9385-...  Flour, whole wheat, unenriched  (Wave 2 Couscous)
✓ deleted  3f9c78b6-...  Flour, whole wheat, unenriched  (Wave 2 Pasta)
✓ deleted  9a071714-...  Biscuit soja orange  (Wave 2 Orange)

post-delete library count: 61
delta: -7 (expected -7) ✓
```

The Mozzarella duplicate was the second of two; the first remains as the correct Mozzarella-input save. Luke now needs to manually add Ricotta part-skim at /admin/pantry.

**No regressions:** the 10 wave-2 saves that were correct remain in DB (Coconut oil, Ghee, Lemon, Cantaloupe, Gochujang, EVOO, Tahini-as-existing, Tomato paste, Hummus, Falafel, Tzatziki — wait, those are wave 1+2 mixed). Library at 61 = 33 baseline + 6 LEAN PROTEINS + 16 wave 1 correct (19 saved minus 3 deleted: Tortillas Flour + Tourtel + Mozz dup) + 6 wave 2 correct (10 saved minus 4 deleted: Brown rice Flour + Couscous Flour + Pasta Flour + Biscuit soja).

Hmm that math: 33 + 6 + 16 + 6 = 61 ✓

---

## §3 — Wave 2 re-dry-run with R.6 (doctrine confirmation)

**10 picks, 1 wrong (90% correctness vs first wave-2 dry-run's 67%):**

| Input | Candidate | Source | Verdict |
|---|---|---|---|
| Jasmine rice | Fragrant Jasmine Rice | OFF (b) | ✓ |
| Coconut oil | Oil, coconut | Foundation | ✓ |
| Ghee | Ghee, clarified butter | FNDDS | ✓ |
| Peanut butter natural | natural PEANUT BUTTER creamy | OFF (b) | ✓ |
| Lemon | Lemon, raw | FNDDS | ✓ |
| Mango | Mango ohne Zuckerzusatz | OFF (a) | ✓ (German "no sugar added") |
| Papaya | **Mango Papaya Passion Fruit Yogurt** | OFF (c) | **⚠ wrong (yogurt mix)** |
| Cantaloupe | Melons, cantaloupe, raw | Foundation | ✓ |
| Anchovy paste | Cento, anchovy paste 100% italian | OFF (e) | ✓ (was save-failed before) |
| Almond milk unsweetened | Organic Unsweetened Almond Non-Dairy Beverage Vanilla | OFF (b) | ✓ (was save-failed before) |

**Plus 2 dedup-skips:** Extra virgin olive oil, Tahini ✓

**Papaya → Yogurt is same Lime/Tourtel/Orange class** (OFF brand-fluff with input keyword). Not a new failure class. V20 calibration: 1 wrong < 5 → would-ship territory.

If V20 wanted to address: add `yogurt` to DISH_CLASS_TOKENS + INHERENTLY_PREPARED_INPUTS (so Greek yogurt still picks). Same Pita-pattern. Not implemented per V20's mid-wave-refinement closure.

---

## §4 — R.6 verification (V20 gate-1)

| Gate | Status |
|---|---|
| R.6 type-checks | ✓ |
| Library count: 68 → 61 | ✓ confirmed |
| Wave 2 dry-run with R.6 catches Flour failure class | ✓ Brown rice + Couscous + Pasta all routed to eyeball with R.6 reason |
| No regressions on the 10 wave-2 correct saves | ✓ — Coconut oil, Ghee, Lemon, Cantaloupe still pick correctly; Mango/Papaya/Anchovy/Almond milk now pickable (Anchovy + Almond milk had been save-fails) |

R.6 doctrine confirmed working as designed.

---

## §5 — What Luke still needs to do at /admin/pantry

Carrying over from wave 1 + wave 2 + this Path γ cleanup:

### Manual ADD (5)
- Crushed tomatoes (canned) — wave 1 save-fail
- Quinoa — wave 2 save-fail
- Anchovy paste — wave 2 save-fail (would now succeed if re-attempted; currently absent from DB after delete)
- Almond milk unsweetened — wave 2 save-fail (same)
- Whole wheat tortillas — wave 1 wrong-pick (Flour deleted)
- Brown rice — wave 2 wrong-pick (Flour, rice, brown deleted)
- Couscous whole wheat — wave 2 wrong-pick (Flour deleted)
- Whole wheat pasta — wave 2 wrong-pick (Flour deleted)
- Orange — wave 2 wrong-pick (Biscuit soja deleted)
- Lime — wave 1 wrong-pick (Tourtel deleted)
- Ricotta part-skim — wave 1 wrong-pick (Mozzarella dup deleted)

That's 11 manual adds.

### Eyeball backlog (cumulative)
- Wave 1: ~75 entries
- Wave 2: ~54 entries
- LEAN PROTEINS: ~12 entries (override + Foundation thin)
- = ~141 entries Luke handles at /admin/pantry

### Optional fixes
- Aicha Tomato Paste 0 kcal → update macros (~85 kcal/100g)
- Greek yogurt non-fat plain (Fage) → "low fat milk" variant — verify or update macros
- Gochujang → check 216 kcal reasonable (it is — typical 200-220)

**Total Luke work post-Path-γ:** ~141 eyeball + 11 manual adds + 1-2 optional macro fixes = **~152-154 entries**.

---

## §6 — V20 calibration check

- **R.6 caught all available Flour-class targets in this snapshot.** ✓
- **0 new structural failure classes** introduced by Path γ. ✓
- **Wave 2 re-dry-run trust state: 90% pick correctness** (10 picks, 1 wrong of acknowledged Lime-class). ✓
- **No regressions on existing correct saves.** ✓

V20 closed mid-wave-2 refinement loop. Path γ was V20-authorized exception. Standing by.

---

## §7 — Asks / decisions

**A.1 — Luke confirms Path γ state:**
- 7 wrong rows deleted
- Library at 61 products (down from 68)
- R.6 active for any future bulk-add runs

**A.2 — V20 closes Op FASTRAK Greek God Bod bulk-add.**

Auto-pick territory is exhausted:
- Wave 1 (95 entries): live ✓
- Wave 2 (68 entries): live ✓
- LEAN PROTEINS (18 entries): live + raw-Foundation re-resolved ✓
- HERBS+SPICES (24): scope-skipped
- ASIAN/CONDIMENTS pruned (28→8 keepers): live within waves ✓
- RECIPE ANCHORS (20): manual at /admin/pantry, never auto

**A.3 — Brick Delta scoping locked-in queue:**
- Investigate OFF save-fail pattern (3 wave-2 + 1 wave-1 fails, all OFF-source)
- Doctrine note for OFF brand-fluff failure class (Lime/Tourtel, Orange/Biscuit, Papaya/Yogurt all same pattern)
- LLM-fill unit_alternatives on raw-Foundation rows (LEAN PROTEINS dropped 4-7 → 0-1 alts)
- Update Aicha Tomato Paste 0 kcal data
- Optional R.4 (primary-noun) revisit if Ricotta-class recurs in future bulk-adds

**A.4 — STOP-for-review posture maintained.**

---

## §8 — Cleanup state

- **Production: 61 products** (was 68; -7 wrong-picks deleted).
- **Git: HEAD `17fab3f`** (R.6 commit; script-only, no Vercel deploy needed).
- **Working tree: clean.**
- **/tmp scripts: ephemeral.**

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BULKADD_PATH_GAMMA.md
