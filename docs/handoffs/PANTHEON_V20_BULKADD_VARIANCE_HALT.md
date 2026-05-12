# Greek God Bod bulk-add — VARIANCE HALT before live save

**Date:** 2026-05-09
**From:** Terminal Claude
**To:** V20 Chat Claude + Luke
**Mode:** **HALT before live save.** Variance discovery requires V20 review.

---

## §0 — TL;DR

Sanity dry-run between commit + live save surfaced **non-determinism in USDA `/foods/search` ranking**. Three back-to-back dry-runs on LEAN PROTEINS (no code changes between runs, no input changes) produced three different auto-pick totals:

- **Smoke 3:** 9 picks (V20-reviewed snapshot — basis for the 8-save plan)
- **Sanity 1 (post-OVERRIDE_EYEBALL commit):** 6 picks (-3 vs smoke 3)
- **Sanity 2:** 7 picks (-2 vs smoke 3, +1 vs sanity 1)

**Live-save outcome is non-deterministic.** Same code, same input doc, ~5-min interval. USDA's API returns different rankings per call.

I did not proceed to live save. Auto-saves are still 0% wrong-pick (no false positives) — but save COUNT is unpredictable, and one structural gap surfaced (R.1/R.2 short-circuit prevents OFF Tier-2 fallback).

---

## §1 — The three-run comparison

| Entry | Smoke 3 | Sanity 1 | Sanity 2 |
|---|---|---|---|
| Chicken breast | ✓ Chicken breast rotisserie / 1.00 (FNDDS) | ✗ eyeball (no overlap ≥ 0.6) | ✓ Chicken breast rotisserie / 1.00 (FNDDS) |
| Ground turkey 99% lean | ✓ Turkey ground 93% / 0.75 | ✗ override → eyeball | ✗ override → eyeball |
| Ground turkey 93% lean | ✓ Turkey ground 93% / 1.00 | ✓ Turkey ground 93% / 1.00 | ✓ Turkey ground 93% / 1.00 |
| Ground bison 99% lean | eyeball | eyeball | eyeball |
| Ground bison 96% lean | eyeball | eyeball | eyeball |
| Eye of round steak | ✓ Beef steak round / 0.67 | ✓ Beef steak round / 0.67 | ✓ Beef steak round / 0.67 |
| Sirloin tip steak | ✓ Beef steak sirloin / 0.67 | ✓ Beef steak sirloin / 0.67 | ✓ Beef steak sirloin / 0.67 |
| Flank steak | ✓ Beef steak flank / 1.00 | ✓ Beef steak flank / 1.00 | ✓ Beef steak flank / 1.00 |
| Skirt steak | eyeball | eyeball | eyeball |
| Top round steak | ✓ Beef steak round / 0.67 | ✓ Beef steak round / 0.67 | ✓ Beef steak round / 0.67 |
| Lean stewing beef | eyeball | eyeball | eyeball |
| Lean ground beef 96% | eyeball | eyeball | eyeball |
| **Lean ground beef 93%** | **✓ Ground Beef 93% Lean [OFF] / 1.00** | **✗ R.2 rejected Turkey → eyeball** | **✗ no overlap ≥ 0.6 → eyeball** |
| Pork tenderloin | ✓ Pork tenderloin / 1.00 | ✓ Pork tenderloin / 1.00 | ✓ Pork tenderloin / 1.00 |
| Lean pork loin chops | eyeball | eyeball | eyeball |
| Ground venison | eyeball | eyeball | eyeball |
| Lamb loin chop lean | eyeball | eyeball | eyeball |
| Ground lamb lean | R.1 eyeball | R.1 eyeball | R.1 eyeball |
| **TOTAL PICKS** | **9** | **6** | **7** |

**Stable picks (3/3 runs):** Ground turkey 93%, Eye of round steak, Sirloin tip steak, Flank steak, Top round steak, Pork tenderloin (6 entries). All correct.

**Variable picks (1-2/3 runs):**
- **Chicken breast** (2/3): USDA returns `Chicken breast, rotisserie, skin not eaten` (FNDDS) sometimes vs Branded-only other times.
- **Lean ground beef 93%** (1/3): smoke 3 hit OFF fallback (USDA returned 0 FNDDS); sanity 1 hit USDA Turkey-ground-93% which R.2 rejected — but R.2 returns early without trying OFF; sanity 2 USDA returned no above-threshold match either way.

**Trust calculus (zero wrong picks) preserved across all three runs.** The variance is in COUNT not CORRECTNESS.

---

## §2 — Two distinct issues

### Issue A — USDA API non-determinism

USDA `/foods/search` ranks results variably between calls. Same query, same `dataType=Foundation,Survey (FNDDS)` filter, same `pageSize`. We've seen:

- "Chicken breast" → sometimes returns FNDDS rotisserie chicken in top results, sometimes only Branded chicken.
- "Lean ground beef 93%" → sometimes returns Foundation Turkey ground 93%, sometimes nothing FNDDS-grade.

This is structural to USDA's API — not fixable from our side. Implications for bulk-add:

- Save count is bounded between ~6 and ~9 on this category. Wave-1 + wave-2 will see similar variance distributions per category.
- **No wrong picks saved** — variance only causes UNDER-saving (entries Luke would handle anyway end up at /admin/pantry).
- Picks that DO save are stable-correct (the "always picks" set is fully stable).

### Issue B — R.1/R.2 short-circuit prevents OFF Tier-2 fallback

Current `autoPickStrategy` flow:

1. USDA Tier 1: find best Foundation/FNDDS candidate above threshold.
2. If best passes R.1 + R.2 → pick.
3. If best fails R.1 → return `descriptor-fail` (eyeball).
4. If best fails R.2 → return `meat-source-fail` (eyeball).
5. **OFF Tier 2 only runs when `tier1.length === 0`** (no FNDDS candidates above threshold).

Smoke 3's "Lean ground beef 93%" worked correctly because USDA returned 0 FNDDS that run → tier1 empty → OFF kicked in → "Ground Beef 93% Lean 7% Fat" picked.

Sanity 1's "Lean ground beef 93%" failed because USDA returned 1 FNDDS (Turkey ground 93%) → R.2 correctly rejected → **but `tier1.length` was 1, not 0, so OFF was skipped** → eyeball.

**This is a structural gap.** R.2 doing its job (rejecting wrong-protein) shouldn't preclude OFF from offering a correct alternative.

---

## §3 — Proposed fix (Issue B): cascade USDA → OFF on R.1/R.2 reject

When the best USDA Tier 1 candidate fails R.1 or R.2, **fall through to OFF Tier 2 search** instead of returning early. Only return eyeball if BOTH tiers fail.

Effect:
- Trust calculus preserved (R.2 still rejects wrong-protein USDA picks).
- "Lean ground beef 93%" saves correctly across all USDA snapshots (OFF is more deterministic for branded foods).
- Save count becomes more stable across runs.
- ~10 LOC refactor: change OFF branch gate from `if (tier1.length === 0)` to `if (no successful Tier 1 pick)`.

Sketch:

```typescript
// Replace:
//   if (bestUsda && bestUsda.descriptorOk && bestUsda.meatOk) { return pick }
//   if (bestUsda && !bestUsda.descriptorOk) { return descriptor-fail }
//   if (bestUsda && !bestUsda.meatOk) { return meat-source-fail }
//   if (tier1.length === 0) { /* OFF Tier 2 */ }
//
// With:
//   if (bestUsda && bestUsda.descriptorOk && bestUsda.meatOk) { return pick }
//   /* fall through — try OFF Tier 2 regardless of tier1.length */
//   if (off Tier 2 succeeds) { return off pick }
//   if (bestUsda && !bestUsda.descriptorOk) { return descriptor-fail }   // only if OFF also failed
//   if (bestUsda && !bestUsda.meatOk) { return meat-source-fail }
//   ...
```

This makes R.1/R.2 act as "skip USDA tier" signals rather than "go to eyeball" signals. The eyeball path remains for cases where neither tier yields a valid match.

### Issue A (non-determinism): no fix needed

It's a property of USDA's API. Mitigations possible (multiple search calls + cache; explicit `sortBy` parameter — needs probing) but out of scope. Acceptable as long as wrong-pick rate stays 0%.

---

## §4 — Three paths forward

### Path δ — Apply Issue B fix, re-dry-run, then live-save

Apply the cascade refactor. Re-dry-run on LEAN PROTEINS to confirm:
- Stable picks remain stable.
- "Lean ground beef 93%" saves consistently via OFF.
- "Chicken breast" still varies (USDA snapshot-dependent — no fix from our side).
- No new wrong picks introduced.

**My recommendation.** ~10 LOC + re-dry-run + commit. Higher save rate + better cross-run determinism.

### Path ε — Live-save now with current code, accept variance

Run `npx tsx scripts/bulk-add-greek-god-bod.ts --category="LEAN PROTEINS"` immediately. Get whatever USDA snapshot returns (likely 6-7 picks based on sanity runs). Luke handles 11-12 at /admin/pantry instead of 9-10.

Cleaner from a "don't add scope mid-EXECUTE" perspective, but produces lower save count + the cascade gap remains for wave 1.

### Path ζ — Live-save now AND apply Issue B fix in parallel for wave 1

Same as Path ε, plus cascade refactor before SEAFOOD/VEGETABLES/MED-GREEK/MEXICAN wave 1. LEAN PROTEINS pays the cost; wave 1 benefits.

---

## §5 — Asks / decisions

**A.1 — V20 picks Path δ / ε / ζ.** I recommend Path δ. The cascade fix is small, well-scoped, and addresses a real structural gap that will recur on every category.

**A.2 — V20 confirms variance discovery doesn't change wave-1 plan.** USDA non-determinism is structural; expected to recur. Wave-1 plan should anticipate that running dry-run multiple times produces different totals; live-save snapshot is the binding one.

**A.3 — V20 confirms STOP-for-review posture.** No live save until path chosen.

---

## §6 — Cleanup state

- OVERRIDE_EYEBALL set committed locally to script (NOT yet `git commit`-ed; working tree dirty with R.2 + threshold 0.6 + override + reason mapper).
- 0 production writes performed.
- 33/33 product coverage maintained.

If V20 chooses Path δ: I'll apply cascade refactor, re-dry-run, surface result, then commit + live save.

If V20 chooses Path ε: I'll commit current changes, live-save now, surface results.

If V20 chooses Path ζ: same as ε for now; cascade refactor before wave 1.

---

## §7 — Trust audit

- **Zero wrong picks across all 3 dry-runs.** R.1, R.2, threshold 0.6 all working as designed.
- **Variance in COUNT, not CORRECTNESS.** Worst-case live save: lower save count, more Luke /admin/pantry entries — same outcome class as if Luke ran fully manual on those entries.
- Override rule (Ground turkey 99% lean) firing correctly across all 3 runs.

Trust calculus achieved. Question is whether to optimize save count via Path δ.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BULKADD_VARIANCE_HALT.md
