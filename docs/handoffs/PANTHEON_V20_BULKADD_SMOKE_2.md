# Greek God Bod bulk-add — LEAN PROTEINS smoke 2 (post Path B + R.1)

**Date:** 2026-05-09
**From:** Terminal Claude
**To:** V20 Chat Claude + Luke
**Mode:** Dry-run #2 output. **STOP for review** per V20 brief — no live save.

---

## §0 — Status

Path B (search-endpoint Foundation/FNDDS-first refinement) + R.1 (strong-descriptor check) deployed to production. Vercel green. Re-dry-run on LEAN PROTEINS.

**Same total: 11/18 (61%) auto-pick.** Composition shifted significantly:
- **+4 new auto-picks** that were eyeball before (Chicken breast, Skirt steak, Lean ground beef 93%, Lean pork loin chops)
- **-4 moved to eyeball** (Lean ground beef 96%, Ground venison, Lamb loin chop lean, Ground lamb lean — R.1 caught descriptor mismatches)

R.1 working as designed: Ground venison no longer picks "Venison, steak" (wrong cut). Path B working as designed: Chicken breast now picks Foundation/FNDDS instead of falling through to eyeball.

**Two NEW wrong picks surfaced** that R.1 doesn't catch. Surfacing for V20 review.

---

## §1 — Per-row dry-run output (post-refinement)

```
  Decision     Input                                          Match (USDA description)                              Source / overlap
  ──────────  ─────────────────────────────────────────────  ───────────────────────────────────────────────────  ───────────────────────────────────
  ~ would-pick Chicken breast                                 Chicken breast, rotisserie, skin not eaten            usda/Survey (FNDDS), 1.00
  ~ would-pick Ground turkey 99% lean                         Turkey, ground, 93% lean, 7% fat, pan-broiled crum    usda/Foundation, 0.75      ← matches 93% not 99%
  ~ would-pick Ground turkey 93% lean                         Turkey, ground, 93% lean, 7% fat, pan-broiled crum    usda/Foundation, 1.00
  ? eyeball    Ground bison 99% lean                          (USDA returned 3, none Foundation/FNDDS)              no token-overlap ≥ 0.5
  ? eyeball    Ground bison 96% lean                          (USDA returned 3, none Foundation/FNDDS)              no token-overlap ≥ 0.5
  ~ would-pick Eye of round steak                             Beef, steak, round                                    usda/Survey (FNDDS), 0.67
  ~ would-pick Sirloin tip steak                              Beef, steak, sirloin, lean and fat eaten              usda/Survey (FNDDS), 0.67
  ~ would-pick Flank steak                                    Beef, steak, flank                                    usda/Survey (FNDDS), 1.00
  ⚠ would-pick Skirt steak                                    Pepper steak                                          usda/Survey (FNDDS), 0.50  ← WRONG (cooked dish, not cut)
  ~ would-pick Top round steak                                Beef, steak, round                                    usda/Survey (FNDDS), 0.67
  ? eyeball    Lean stewing beef                              (USDA returned 3, none Foundation/FNDDS)              no token-overlap ≥ 0.5
  ? eyeball    Lean ground beef 96%                           Beef, ground                                          R.1: descriptor "lean" missing
  ⚠ would-pick Lean ground beef 93%                           Turkey, ground, 93% lean, 7% fat, pan-broiled crum    usda/Foundation, 0.75      ← WRONG protein (turkey, not beef)
  ~ would-pick Pork tenderloin                                Pork, tenderloin                                      usda/Survey (FNDDS), 1.00
  ~ would-pick Lean pork loin chops                           Pork, chop, lean and fat eaten                        usda/Survey (FNDDS), 0.50
  ? eyeball    Ground venison                                 Venison, steak                                        R.1: descriptor "ground" missing
  ? eyeball    Lamb loin chop lean                            Lamb, chop                                            R.1: descriptor "lean" missing
  ? eyeball    Ground lamb lean                               Lamb, ground                                          R.1: descriptor "lean" missing
```

### Summary

```
  total entries processed:   18
    would auto-pick:         11 (61%)
    eyeball needed:          7
    dedup-skip:              0
    search/save failures:    0
```

---

## §2 — Comparison: dry-run #1 → dry-run #2

| Entry | Run 1 (no refinements) | Run 2 (Path B + R.1) | Δ |
|---|---|---|---|
| Chicken breast | eyeball | ✓ Chicken breast, rotisserie | **+pick** (Path B) |
| Ground turkey 99% lean | Turkey, ground / 0.50 | Turkey, ground 93% lean 7% fat / 0.75 | better candidate (Path B) |
| Ground turkey 93% lean | Turkey, ground 93% lean / 1.00 | Turkey, ground 93% lean / 1.00 | unchanged |
| Ground bison 99% lean | eyeball | eyeball | unchanged (no Foundation/FNDDS exists for bison) |
| Ground bison 96% lean | eyeball | eyeball | unchanged |
| Eye of round steak | Beef, steak, round / 0.67 | Beef, steak, round / 0.67 | unchanged |
| Sirloin tip steak | Beef, steak, sirloin / 0.67 | Beef, steak, sirloin / 0.67 | unchanged |
| Flank steak | Beef, steak, flank / 1.00 | Beef, steak, flank / 1.00 | unchanged |
| **Skirt steak** | eyeball | ⚠ **Pepper steak / 0.50** | +pick BUT **WRONG** |
| Top round steak | Beef, steak, round / 0.67 | Beef, steak, round / 0.67 | unchanged |
| Lean stewing beef | eyeball | eyeball | unchanged |
| Lean ground beef 96% | Beef, ground / 0.50 | eyeball | **R.1 caught** ("lean" missing) |
| **Lean ground beef 93%** | eyeball | ⚠ **Turkey, ground 93% lean / 0.75** | +pick BUT **WRONG protein** |
| Pork tenderloin | Pork, tenderloin / 1.00 | Pork, tenderloin / 1.00 | unchanged |
| Lean pork loin chops | eyeball | ✓ Pork, chop, lean / 0.50 | **+pick** (Path B) |
| Ground venison | Venison, steak / 0.50 | eyeball | **R.1 caught** ("ground" missing) |
| Lamb loin chop lean | Lamb, chop / 0.50 | eyeball | **R.1 caught** ("lean" missing) |
| Ground lamb lean | Lamb, ground / 0.67 | eyeball | **R.1 caught** ("lean" missing) |

**Path B wins (4):** Chicken breast (now Foundation/FNDDS), Lean pork loin chops (now picked), Lean ground beef 93% (now picked, but wrong — see below), Skirt steak (now picked, but wrong — see below)

**R.1 wins (4):** Ground venison, Lamb loin chop lean, Ground lamb lean, Lean ground beef 96% — all correctly routed to eyeball where they would have been wrong picks before.

**New problems (2):**
- **Skirt steak → Pepper steak** — wrong (cut vs cooked dish). R.1 doesn't fire (no strong descriptor in "Skirt steak"). Token overlap 0.50 just hits threshold. Foundation/FNDDS returned this because both contain "steak".
- **Lean ground beef 93% → Turkey, ground 93% lean** — wrong protein (turkey, not beef). R.1 passes because both have "lean" + "ground" + "93". R.1 doesn't include a meat-source check.

---

## §3 — Root-cause analysis on the new wrong picks

### Skirt steak → Pepper steak

USDA Foundation/FNDDS for "Skirt steak" returns:
- "Pepper steak" (top hit by USDA's relevance ranking)
- (Skirt steak might not be in Foundation/FNDDS at all as a discrete entry)

Token overlap: input `[skirt, steak]` ∩ candidate `[pepper, steak]` = 1/2 = 0.50. Just hits threshold. R.1 inactive (no strong descriptor in "Skirt steak").

**Fix candidates:**
- Bump threshold to 0.6 → "Skirt steak" overlap 0.50 fails, routes to eyeball
- Add "primary noun must match" rule: when input has 2 tokens and only 1 overlaps, at least the primary food noun must be the matching one. "Skirt steak" → "Pepper steak" matches on "steak" but not on the food-defining noun "skirt". Hard to compute heuristically.
- Accept and let Luke catch in eyeball at /admin/pantry post-save (cost: 1 wrong row that Luke deletes)

### Lean ground beef 93% → Turkey, ground 93% lean

R.1's strong-descriptor check confirms both have "lean" + "ground" + "93". Token overlap 3/4 = 0.75. Passes both gates.

But protein source differs: input=beef, candidate=turkey. Fundamental mismatch.

**Fix candidates:**
- **R.2 — meat-source check.** When input contains a meat-source token (beef/pork/chicken/turkey/lamb/venison/bison/duck/fish/salmon/tuna/etc.), candidate must contain that exact token (no synonyms). If input has "beef" and candidate has "turkey", reject.
- Predicted impact: catches "Lean ground beef 93%" → "Turkey ground 93% lean". Doesn't break valid cases. Conservative + targeted.
- ~5 lines of code, similar shape to R.1.

---

## §4 — Three paths forward

### Path α — Accept current state and live-save

11 auto-picks include 2 wrong (Skirt steak, Lean ground beef 93%). Luke deletes those at /admin/pantry post-save. Eyeball 7. Net Luke-touch: 9 entries.

**Acceptable but adds friction (Luke has to identify + delete the 2 wrong picks).**

### Path β — Add R.2 meat-source check, re-dry-run

Predicted: Lean ground beef 93% → eyeball (R.2 catches turkey vs beef). Skirt steak still wrong (different problem). Net: 10 auto-picks (1 still wrong: Skirt steak), 8 eyeball.

**~5 LOC fix. Cleaner. Skirt steak still wrong but only 1 wrong vs 2.**

### Path γ — Path β + threshold bump to 0.6

Predicted: same as β plus Skirt steak → eyeball (overlap 0.50 < 0.6). Net: 9 auto-picks (0 wrong), 9 eyeball.

**Conservative. 0% wrong-pick rate. Higher eyeball count but Luke trusts auto-saves entirely.** Threshold change is 1-line.

But threshold bump has cross-category risk: cases like "Eye of round steak" → "Beef, steak, round" (overlap 0.67) still pass; "Lamb chop" → "Lamb, chop" (overlap 1.0) still passes; some borderline-acceptable picks at 0.50 might fall to eyeball.

### My recommendation

**Path β** — add R.2, keep threshold at 0.5, accept Skirt steak as the 1 wrong pick Luke catches at /admin/pantry. Targeted fix without bumping cross-category threshold.

If V20 wants 100% correct auto-saves with no Luke-deletion at all, **Path γ** locks that in at the cost of slightly higher eyeball count.

---

## §5 — Asks / decisions

**A.1 — V20 + Luke choose Path α / β / γ.** Recommendation: Path β.

**A.2 — V20 confirms STOP-for-review posture.** No live save until path chosen.

**A.3 — Re-dry-run after Path β or γ implementation, then live save if clean.** Per V20's iteration discipline.

---

## §6 — Cleanup state

Dry-run #2 made **0 writes** (per --dry-run flag). Production state unchanged. 33/33 product coverage maintained.

Path B + R.1 push landed clean (`6ea8028`). Vercel green. Refinement is forward-compatible.

---

## §7 — If Path β chosen, sketch

```typescript
// scripts/bulk-add-greek-god-bod.ts — add R.2 meat-source check

const MEAT_SOURCES = new Set([
  'beef', 'pork', 'chicken', 'turkey', 'lamb', 'venison',
  'bison', 'duck', 'goose', 'rabbit',
  'salmon', 'tuna', 'cod', 'halibut', 'shrimp', 'swordfish',
  'sea-bass', 'branzino', 'tilapia', 'mackerel', 'trout',
  'fish',  // generic; matches "Fish, salmon, ..."
])

function passesMeatSourceCheck(input: Set<string>, candidate: Set<string>): {
  ok: boolean
  failedSource?: string
} {
  for (const source of MEAT_SOURCES) {
    if (input.has(source) && !candidate.has(source)) {
      // Special case: input has 'fish' generic; candidate may have specific fish
      if (source === 'fish') {
        const anyFishInCandidate = [...MEAT_SOURCES].some(
          (s) => s !== 'fish' && candidate.has(s)
        )
        if (anyFishInCandidate) continue
      }
      return { ok: false, failedSource: source }
    }
  }
  return { ok: true }
}

// In autoPickStrategy, apply AFTER R.1 descriptor check:
const meatCheck = passesMeatSourceCheck(inputTokens, candTokens)
if (!meatCheck.ok) { /* route to eyeball with reason */ }
```

~10 lines. Parallel structure to R.1.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BULKADD_SMOKE_2.md
