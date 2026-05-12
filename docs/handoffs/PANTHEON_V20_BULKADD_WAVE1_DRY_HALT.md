# Wave 1 dry-run — HALT before live save

**Date:** 2026-05-09
**From:** Terminal Claude
**To:** V20 Chat Claude + Luke
**Mode:** **HALT before wave-1 live save.** New failure mode surfaced exactly as V20 anticipated.

---

## §0 — TL;DR

Two findings:

1. **LEAN PROTEINS spot-check: 6/6 USDA-accurate** (Δ <1% on all macros vs USDA per-100g). DB values match the FDC source rows exactly. ✓ V20's gate-1 verification passes.

2. **Wave 1 dry-run: 48/95 (51%) auto-pick — but ~17 picks are SEMANTICALLY WRONG due to a new failure mode.** Vegetables + dairy + Mediterranean/Mexican surface "preparation-state / dish-class mismatch" — input is a generic produce/dairy name, USDA returns a prepared dish (dip, sauce, souffle, tots, pickled, bread). R.1 (descriptor) and R.2 (meat-source) don't catch these because token-overlap is 1.00 (input tokens are all in candidate) and neither rule fires.

If we live-saved wave 1 right now, ~17 of 48 saves would be wrong food entirely. **Trust calculus broken at category-class boundary.**

Plus: a separate **raw vs cooked concern** on LEAN PROTEINS itself — all 6 saved rows are FNDDS "as eaten" (cooked) variants. Foundation has raw equivalents. Affects macro-tracking accuracy when Luke logs raw weight.

---

## §1 — LEAN PROTEINS spot-check (V20 gate-1 verification)

Independent USDA FDC API queried for each of the 5 unique fdc_ids; DB values cross-checked.

| fdc_id | Description | DT | DB stored kcal | USDA per-100g | Δ kcal |
|---|---|---|---|---|---|
| 746785 | Turkey, ground, 93% lean, 7% fat, pan-broiled crumbles | Foundation | 220 | 220 | **0%** |
| 2705831 | Beef, steak, round | Survey (FNDDS) | 166 | 166 | **0%** |
| 2705833 | Beef, steak, sirloin, lean and fat eaten | Survey (FNDDS) | 262 | 262 | **0%** |
| 2705827 | Beef, steak, flank | Survey (FNDDS) | 243 | 243 | **0%** |
| 2705877 | Pork, tenderloin | Survey (FNDDS) | 134 | 134 | **0%** |

All Δ macros within 0-0.3% (rounding only). DB values are exact mirrors of USDA per-100g.

**Note on fdc=746785:** USDA `/food/{id}` returns 404 for this ID, but `/foods/search?query=Turkey ground 93% lean&dataType=Foundation` returns the same fdc and macros that match our DB (220 kcal · 27.1p · 0c · 11.6f). Known USDA API quirk — search-listable but not direct-fetchable.

**V20 gate-1 verification: PASS on USDA-accuracy.**

---

## §2 — Raw vs cooked concern (LEAN PROTEINS observation)

All 5 unique FDC entries we saved are **"as eaten" / cooked** variants:

- **fdc=746785** — "pan-broiled crumbles" (cooked) — 220 kcal/100g
- **fdc=2514747** (Foundation, NOT picked) — "raw" Turkey ground 93% — 17.3p / 9.59f → ~155 kcal/100g (computed)
- All FNDDS Beef "steak" rows — "lean and fat eaten" → cooked-as-served macros
- Pork tenderloin FNDDS — cooked-as-eaten

**Practical impact:** if Luke logs "150g ground turkey 93% lean" intending raw weight, the saved row reports cooked-100g macros (220 kcal × 1.5 = 330 kcal) when the true raw value is ~232 kcal. **~40% over-count on raw-weight logging.**

The matcher had no signal to prefer raw — input was generic, USDA returned cooked first in this snapshot. R.1 didn't fire (no "raw" or "cooked" in input).

### Disposition options

- **Option α — Accept.** Luke logs cooked weight or applies a raw→cooked mental factor. Add doctrine memory: "Pantheon products store FNDDS-as-eaten macros; log cooked weight."
- **Option β — Tier-prefer Foundation over FNDDS.** When both exist, prefer Foundation (raw entries). Requires checking dataType ranking AT search time. ~5 LOC in search route.
- **Option γ — R.3 raw-default rule.** When input is a generic produce/protein name (no cooking method), bias toward candidates without cooking tokens (cooked, pan-broiled, fried, etc.).
- **Option δ — Re-save wave with raw preference + delete cooked variants.** Heavier; do this only if Option β/γ adopted.

Recommend option **β** — tier Foundation > FNDDS for raw-default semantics. FNDDS only when Foundation has no entry.

---

## §3 — Wave 1 dry-run aggregate

```
  SEAFOOD                       total=9   pick=1   (11%)  eyeball=8
  EGG / DAIRY                   total=9   pick=7   (78%)  eyeball=2
  VEGETABLES                    total=39  pick=24  (62%)  eyeball=15
  MEDITERRANEAN / GREEK PANTRY  total=20  pick=9   (45%)  eyeball=11
  MEXICAN / LATIN PANTRY        total=18  pick=7   (39%)  eyeball=11

  WAVE 1 TOTAL                  total=95  pick=48  (51%)  eyeball=47
```

(Vegetables count 39 vs V20's 38 — single doc-line discrepancy. Total 95 vs V20's 94.)

**Auto-pick rate 51% — better than LEAN PROTEINS 33% as V20 predicted.** But correctness rate within picks is the problem.

---

## §4 — NEW FAILURE MODE — Preparation-state / dish-class mismatch

V20's wave-1 anticipation: "Vegetables predicted higher than LEAN PROTEINS due to USDA Foundation having strong produce coverage. Branded categories may surface OFF Tier 2." Confirmed on rate. But **a new correctness gap surfaced** that R.1/R.2 don't cover.

### Wrong picks (semantic class mismatch)

| # | Input | Candidate (auto-pick target) | Issue |
|---|---|---|---|
| 1 | Zucchini | Bread, zucchini | candidate is BREAD (with zucchini), not zucchini |
| 2 | Cauliflower rice fresh | Cauliflower, fresh, cooked with oil | "with oil" adds fat |
| 3 | Cauliflower rice frozen | Cauliflower, frozen, cooked with oil | "with oil" adds fat |
| 4 | Eggplant | Eggplant dip | candidate is a dip, not raw eggplant |
| 5 | Shallot | Shallot & Chive Spreadable Gourmet Cheese (OFF) | candidate is CHEESE |
| 6 | Garlic | Garlic sauce | candidate is sauce |
| 7 | Ginger root | Ginger root, pickled | pickled adds sugar/salt |
| 8 | Sweet potato | Sweet potato tots | tots = processed/fried |
| 9 | Cucumber | Cucumber salad made with cucumber and vinegar | salad with vinegar |
| 10 | Radishes | Radishes, pickled | pickled |
| 11 | Beets | Beets, pickled | pickled |
| 12 | Red cabbage | Cabbage, red, pickled | pickled |
| 13 | Lime | Lime souffle | souffle is dessert |
| 14 | Jalapeno | Stuffed jalapeno pepper | stuffed = cheese/meat-filled |
| 15 | Feta cheese reduced fat | Crackers, cheese, reduced fat | candidate is CRACKERS |
| 16 | Ricotta part-skim | Cheese, Mozzarella, part skim | candidate is MOZZARELLA |
| 17 | Black beans (canned) | Black beans, from canned, fat added | "fat added" is wrong variant |
| 18 | Pinto beans (canned) | Pinto beans, from canned, fat added | "fat added" wrong variant |

**~17-18 wrong picks of 48 = ~37% of auto-picks would be wrong food entirely.**

### Why R.1 + R.2 didn't catch these

- Token overlap is HIGH (1.00 in many cases — input tokens all in candidate).
- R.1 fires only when input has a strong descriptor (ground/raw/lean/etc.); generic produce names don't trigger it.
- R.2 only catches meat-source mismatches; vegetables + dairy + dishes aren't covered.
- Threshold 0.6 doesn't help — these have overlap 0.67-1.00.

### Likely correct picks (~30-31 of 48)

- Canned tuna in water ✓
- Liquid egg whites ✓
- Greek yogurt non-fat / 2% plain ✓
- Parmesan cheese ✓
- Mozzarella part-skim ✓
- Green beans (raw) ✓
- Arugula (raw) ✓
- Baby spinach ✓
- Kale (raw) ✓
- Cabbage green (raw) ✓
- Carrots (raw) ✓
- Celery (raw) ✓
- Cherry tomatoes ✓
- Crushed tomatoes (canned) ✓
- Diced tomatoes (canned) ✓
- Green olives ✓
- Sun-dried tomatoes ✓
- Tahini ✓
- Hummus ✓
- Tzatziki ✓
- Falafel ✓
- Pita whole wheat ✓
- Spaghetti squash (cooked — raw/cooked concern but otherwise correct) ⚠
- Yellow squash (raw) ✓
- Fennel bulb (cooked — same concern) ⚠
- Pico de gallo ✓
- Cilantro ✓
- Queso fresco ✓
- Jicama (raw) ✓

(Spaghetti squash + Fennel bulb shown with cooking modifier — same class as protein raw/cooked concern.)

---

## §5 — Proposed refinements

### R.3 — Preparation-state default (raw bias)

When input is a single-or-double-token generic produce/protein/dairy name **without** any preparation modifier (raw/cooked/canned/dried/pickled/frozen/cured/fried/baked/grilled/roasted/steamed), prefer candidates that:

a) Don't contain any preparation tokens, OR
b) Contain only "raw" / "fresh" tokens.

Reject candidates containing preparation tokens like: cooked, pickled, fried, baked, dried, dehydrated, souffle, dip, sauce, salad, stuffed, bread, crackers, tots, with oil, fat added.

```typescript
const PREPARATION_TOKENS = new Set([
  'cooked', 'pickled', 'fried', 'baked', 'broiled', 'pan-broiled',
  'grilled', 'roasted', 'steamed', 'boiled', 'sauteed', 'stuffed',
  'dried', 'dehydrated',
  // Dish/preparation classes
  'souffle', 'dip', 'sauce', 'salad', 'bread', 'crackers', 'cracker',
  'tots', 'spreadable', 'spread', 'commercial',
  // Modifiers
  'with',  // catches "cooked with oil"
  'added',  // catches "fat added"
])
const RAW_OK_TOKENS = new Set(['raw', 'fresh'])
```

### R.4 — Primary-noun leading-token rule

When input has a clear primary food noun (e.g., "Zucchini"), candidate must lead with that noun as a STANDALONE token (not as a modifier of a different food). "Bread, zucchini" leads with "Bread" — reject. "Zucchini, raw" leads with "Zucchini" — accept.

This is harder to implement cleanly because USDA's comma-prefix conventions vary. Could approximate via "candidate's first token matches input's primary noun."

### Path A — Apply R.3, re-dry-run wave 1

~15-20 LOC. Re-run dry-run, expect to drop wave-1 picks from 48 to ~30-31 (correct ones survive; wrong ones route to eyeball). Higher eyeball count, but trust calculus restored.

### Path B — Apply R.3 + R.4

~25-30 LOC. More conservative. Predicted: ~27-29 picks survive. Even higher eyeball count.

### Path C — Tier Foundation > FNDDS in search endpoint (Option β from §2)

Independent of R.3. Addresses raw-vs-cooked separately. ~5 LOC in search route. Re-deploys Vercel.

### Path D — Apply R.3 + Foundation>FNDDS tiering (A + C)

Both fixes; comprehensive.

### My recommendation

**Path D.** R.3 + Foundation>FNDDS together. Together they:
- Eliminate dish-class mismatches (dip/sauce/souffle/etc.)
- Eliminate preparation-state mismatches (pickled/fried/with oil)
- Bias raw-default which matches Luke's voice-logging mental model

Predicted wave-1 picks after Path D: ~28-32 (vs current 48). Eyeball ~63-67 (vs current 47). Higher eyeball, but every save is correct food + raw-default macros.

The 6 already-saved LEAN PROTEINS rows are FNDDS-cooked. Path C (Foundation>FNDDS) won't auto-fix them — would need Brick Delta cleanup or re-save.

---

## §6 — Asks / decisions

**A.1 — V20 + Luke pick path** (A / B / C / D / something else).

**A.2 — Disposition on the 6 already-saved LEAN PROTEINS rows.**
- Option a: leave as cooked-FNDDS; Luke logs cooked weight or mentally adjusts.
- Option b: queue for Brick Delta cleanup — re-resolve to Foundation raw variants where they exist.

**A.3 — Wave-1 sequencing.**
- After path chosen + script update + re-dry-run + V20 review → live save.
- Sequencing: re-dry-run all 5 wave-1 categories in one pass; review aggregates again before live save.

**A.4 — STOP-for-review posture maintained.**
No live save until path chosen + re-dry-run reviewed.

---

## §7 — Cleanup state

- Wave 1 dry-run made **0 writes**.
- Production state: 39 products (33 baseline + 6 LEAN PROTEINS saves).
- Script tree: minor enhancement — multi-category support via comma-separated `--category="A,B,C"`. Type-check clean. Not yet committed (small, will bundle with R.3 / Path commit).

If Path A/B/D chosen, R.3 logic needs draft + V20 review of token list before commit. If Path C only, drop a small change in app/api/admin/pantry/search/route.ts to tier Foundation > FNDDS.

---

## §8 — Trust audit

- LEAN PROTEINS picks: USDA-data-accurate ✓ (Δ <1%)
- LEAN PROTEINS semantic class: cooked variants saved when raw was likely intended ⚠
- Wave 1 dry-run: ~31 of 48 picks semantically correct; ~17 wrong food entirely ⚠
- Trust calculus: WORKING for proteins (R.1 + R.2 catch what they were designed to catch); BROKEN for produce + dairy + dishes (R.3 needed).

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BULKADD_WAVE1_DRY_HALT.md
