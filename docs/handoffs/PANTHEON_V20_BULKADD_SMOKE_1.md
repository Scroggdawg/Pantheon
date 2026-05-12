# Greek God Bod bulk-add — LEAN PROTEINS smoke (dry-run)

**Date:** 2026-05-09
**From:** Terminal Claude
**To:** V20 Chat Claude + Luke
**Mode:** Smoke output. **STOP for review** per V20 brief Step 3 — no live save.

---

## §0 — Status

Script written + type-checked clean. Dry-run executed against production (`pantheon-woad.vercel.app`) on category `LEAN PROTEINS` (18 entries). **11 of 18 (61%) would auto-pick; 7 of 18 (39%) need eyeball.** Below my Phase 0 §3 prediction (83-94%).

**Root cause for the eyeball rate** identified empirically: USDA's `/foods/search` endpoint returns Branded results FIRST for many generic queries ("Chicken breast" returns 5 Branded entries — `dt=Branded` for all top 5; ZERO Foundation/FNDDS). My Tier 1 filter excludes Branded by design (data quality concern); when the underlying USDA fetch returns no Foundation/FNDDS at all, Tier 1 has nothing to pick from, and the entry falls to eyeball.

The script behaves correctly against the contract Phase 0 set — it's the search endpoint's underlying USDA query that needs refinement to surface Foundation/FNDDS preferentially. **Pre-existing Gamma E gap, not a script bug.**

---

## §1 — Per-row dry-run output (LEAN PROTEINS, 18 entries)

```
  Decision     Input                                          Match (USDA description)                              Source / overlap
  ──────────  ─────────────────────────────────────────────  ───────────────────────────────────────────────────  ───────────────────────────────────
  ? eyeball    Chicken breast                                 (USDA returned 5 Branded; 0 Foundation/FNDDS)         no token-overlap ≥ 0.5
  ~ would-pick Ground turkey 99% lean                         Turkey, ground                                        usda/Survey (FNDDS), 0.50
  ~ would-pick Ground turkey 93% lean                         Turkey, ground, 93% lean, 7% fat, pan-broiled crum    usda/Foundation, 1.00
  ? eyeball    Ground bison 99% lean                          (USDA returned 3, none Foundation/FNDDS)              no token-overlap ≥ 0.5
  ? eyeball    Ground bison 96% lean                          (USDA returned 3, none Foundation/FNDDS)              no token-overlap ≥ 0.5
  ~ would-pick Eye of round steak                             Beef, steak, round                                    usda/Survey (FNDDS), 0.67
  ~ would-pick Sirloin tip steak                              Beef, steak, sirloin, lean and fat eaten              usda/Survey (FNDDS), 0.67
  ~ would-pick Flank steak                                    Beef, steak, flank                                    usda/Survey (FNDDS), 1.00
  ? eyeball    Skirt steak                                    (USDA returned 3, none Foundation/FNDDS)              no token-overlap ≥ 0.5
  ~ would-pick Top round steak                                Beef, steak, round                                    usda/Survey (FNDDS), 0.67
  ? eyeball    Lean stewing beef                              (USDA returned 3, none Foundation/FNDDS)              no token-overlap ≥ 0.5
  ~ would-pick Lean ground beef 96%                           Beef, ground                                          usda/Survey (FNDDS), 0.50
  ? eyeball    Lean ground beef 93%                           (USDA returned 3, none Foundation/FNDDS)              no token-overlap ≥ 0.5
  ~ would-pick Pork tenderloin                                Pork, tenderloin                                      usda/Survey (FNDDS), 1.00
  ? eyeball    Lean pork loin chops                           (USDA returned 3, none Foundation/FNDDS)              no token-overlap ≥ 0.5
  ~ would-pick Ground venison                                 Venison, steak                                        usda/Survey (FNDDS), 0.50
  ~ would-pick Lamb loin chop lean                            Lamb, chop                                            usda/Survey (FNDDS), 0.50
  ~ would-pick Ground lamb lean                               Lamb, ground                                          usda/Survey (FNDDS), 0.67
```

### Summary

```
  LEAN PROTEINS                       total=18  would-pick=11  eyeball=7  dedup=0  manual=0  fail=0

  total entries processed:            18
    would auto-pick:                  11 (61%)
    eyeball needed:                   7
    dedup-skip:                       0
    composite-manual:                 0
    search/save failures:             0
```

---

## §2 — Empirical root cause for eyeball rate

Probed USDA `/foods/search` directly for "Chicken breast" with `pageSize=5`:

```
  fdc=2187885  dt=Branded  kcal=165  CHICKEN BREAST
  fdc=2092152  dt=Branded  kcal=143  CHICKEN BREAST
  fdc=2125872  dt=Branded  kcal=107  CHICKEN BREAST
  fdc=2055943  dt=Branded  kcal=107  CHICKEN BREAST
  fdc=2096160  dt=Branded  kcal=96   CHICKEN BREAST
```

USDA's API returns Branded entries first for this generic query. Foundation/FNDDS exist for chicken (e.g., `Chicken, broiler or fryers, breast, raw` is `Survey (FNDDS)` `fdc=2646170`) but they don't appear in the top 9 results without an explicit `dataType` filter at request time.

My **search endpoint at `app/api/admin/pantry/search/route.ts:64-65`** fetches `pageSize=limit*3` (9 candidates) WITHOUT a `dataType` filter, then re-sorts in memory by tier. If all 9 returned candidates are Branded, the in-memory sort doesn't help — Foundation/FNDDS isn't in the response set.

**This is a pre-existing Gamma E gap.** The lib/usda/portions.ts `usdaResolveFdcId` (Gamma A) handles this correctly — it queries Foundation/FNDDS first explicitly, then falls back. The search route doesn't.

The 7 eyeball cases (Chicken breast, Ground bison 99%/96%, Skirt steak, Lean stewing beef, Lean ground beef 93%, Lean pork loin chops) are all queries where the top-9 USDA results are Branded.

---

## §3 — Three paths forward

### Path A — Accept current eyeball rate

Run live save on the 11 auto-picks; Luke handles 7 at /admin/pantry. Same tradeoff as fully manual but for a smaller set.

**Pros:** zero code change. Empirical Luke-handle of 7 entries is fine.
**Cons:** auto-pick rate stays low. Future categories likely show similar pattern (any generic-vegetable / generic-spice query where USDA's top results skew Branded).

### Path B — Refine the search endpoint to prefer Foundation/FNDDS at fetch time

Modify `app/api/admin/pantry/search/route.ts` to do tiered fetching like `usdaResolveFdcId`:
1. First query: `dataType=Foundation,Survey (FNDDS)`
2. Fall back to all-types only if research-grade returns 0 hits

**Pros:** lifts auto-pick rate substantially across all generic queries (proteins, vegetables, herbs). Likely brings LEAN PROTEINS to 16-17/18 = 89-94%.
**Cons:** small Gamma E refinement (~10 lines in route.ts); requires re-deploy. Adds 1 USDA hit per name (when Foundation/FNDDS returns 0, fall back). Acceptable cost.

### Path C — Lower threshold from 0.5 to 0.4

7 eyeball cases all have OFF=0, USDA=3 (Branded). The current eyeball isn't a threshold problem; lowering the threshold doesn't help when Tier 1 has zero Foundation/FNDDS candidates to consider.

**Doesn't solve the problem.** Path C is a no-op for this empirical set.

---

## §4 — Asks / decisions

**A.1 — V20 + Luke choose between Path A (live-save 11, eyeball 7) vs Path B (refine search endpoint first, then re-dry-run, then live-save).**

My recommendation: **Path B**. The refinement is small, the win is large (~25 percentage points on auto-pick), and the change applies to ALL future categories not just LEAN PROTEINS. ~10 lines in the search route + push + re-dry-run.

**A.2 — V20 confirms the parser fix delta (248 vs 247 expected).** Off-by-one likely from "Tahini" appearing in BOTH `MEDITERRANEAN / GREEK PANTRY` (line 139) AND `FATS` (line 263). Same name, two categories — second occurrence will hit dedup-skip when run in sequence. Negligible.

**A.3 — V20 confirms STOP-for-review posture.** No live save until Path A or Path B chosen + further dry-run reviewed.

---

## §5 — If V20 chooses Path B (refinement)

Sketch:

```typescript
// app/api/admin/pantry/search/route.ts — refined usdaSearchTopN

async function usdaSearchTopN(name: string, limit: number = 3): Promise<UsdaCandidate[]> {
  const apiKey = process.env.USDA_FDC_API_KEY
  if (!apiKey) return []

  // Tier 1 query: Foundation/Survey FNDDS only
  const research = await searchUsda(name, limit * 3, 'Foundation,Survey (FNDDS)', apiKey)
  // Tier 2 fallback: all-types (covers Branded-only foods + niche items)
  const all = research.length === 0
    ? await searchUsda(name, limit * 3, undefined, apiKey)
    : research

  // ...rest unchanged: rank + map + return
}
```

Estimated ~10 lines. After refine + push + Vercel deploy + re-run dry-run on LEAN PROTEINS, predicted auto-pick rises to 16-17/18 = 89-94%. Same pattern applies to other categories that hit this Branded-bias.

This is a one-time fix that benefits the entire bulk-add session.

---

## §6 — Cleanup state

Dry-run made **0 writes** (per --dry-run flag). No products rows added. No cleanup needed.

Production state unchanged. 33/33 product coverage maintained. Standing by for V20's Path A vs Path B call.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BULKADD_SMOKE_1.md
