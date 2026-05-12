# R.7 OFF brand-fluff rule — verified

**Date:** 2026-05-10
**From:** Terminal Claude
**To:** V20 Chat Claude + Luke
**Mode:** R.7 implementation + verification dry-run complete. **STOP for V20 sign-off.**

---

## §0 — TL;DR

- ✓ R.7 implemented per V20 sketch (~12 LOC)
- ✓ Type-check clean
- ✓ Committed `04345b4`
- ✓ Wave 2 verification dry-run with R.7 active — design-intent firings confirmed
- ✓ Zero new failure modes introduced

**Verification dry-run state:** 7 picks, **0 wrong**, 2 dedup. R.7 firing on 3 OFF brand-fluff cases (Orange, Jasmine rice, Anchovy paste) — all per design intent.

---

## §1 — R.7 implementation

```typescript
function passesOffBrandFluffCheck(input: Set<string>, candidateName: string): boolean {
  if (input.size > 2) return true                    // multi-token input is specific enough
  const tokens = candidateName
    .toLowerCase()
    .split(/[,\s]+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
  if (tokens.length < 4) return true                 // short candidate likely real match
  const firstToken = tokens[0]
  if (input.has(firstToken)) return true             // candidate leads with input token
  return false                                       // brand-fluff: long composite, first token unrelated
}
```

Operates on `${brand} ${product_name}` combined (per V20 sketch). Wired into `bestOff` struct as `brandFluffOk`. New `AutoPickOutcome.reason = 'off-brand-fluff'`. Surface message:

```
R.7 OFF brand-fluff: candidate "X" is long composite; input keyword not its primary noun
```

Apply path: USDA Tier 1 untouched (food-first conventions). OFF Tier 2 only.

Sequence in autoPickStrategy: descriptor → meat-source → inverse-meat → prep → anti-flour → **brand-fluff** → pick.

---

## §2 — Verification dry-run results (wave 2 categories, no live save)

```
total entries processed:   68
  would auto-pick:         7
  eyeball needed:          59
  dedup-skip:              2
  search/save failures:    0
```

### R.7 firings (3) — all design intent

| Input | Candidate | Verdict |
|---|---|---|
| Orange | "Biscuit soja orange" | ✓ R.7 caught (design intent — V20 wave-2 review case) |
| Jasmine rice | "Fragrant Jasmine Rice" (combined w/ brand prefix) | ✓ R.7 caught (generic produce input should not auto-save brand-specific) |
| Anchovy paste | "Cento, anchovy paste 100% italian" | ✓ R.7 caught (brand-led candidate, generic input) |

### Picks (7) — 0 wrong

| Input | Candidate | Source |
|---|---|---|
| Coconut oil | Oil, coconut | Foundation |
| Ghee | Ghee, clarified butter | FNDDS |
| Peanut butter natural | natural PEANUT BUTTER creamy | OFF (b) |
| Lemon | Lemon, raw | FNDDS |
| Cantaloupe | Melons, cantaloupe, raw | Foundation |
| Almond milk unsweetened | Organic Unsweetened Almond Non-Dairy Beverage Vanilla | OFF (b) — input has 3 tokens, R.7 skips |
| Oat milk unsweetened | Barista Oat milk - Vemondo | OFF (c) — input has 3 tokens, R.7 skips |

### Dedup-skips (2)

- Extra virgin olive oil ✓
- Tahini ✓

### R.6 still firing (carryover, no regression)

- Brown rice → eyeball (R.6 caught "Flour, rice, brown")
- Couscous whole wheat → eyeball (R.6: "Flour, whole wheat")
- Whole wheat pasta → eyeball (R.6: "Flour, whole wheat")

---

## §3 — V20 gate-1 verification

| Gate | Status |
|---|---|
| R.7 type-checks clean | ✓ |
| Papaya → eyeball with R.7 reason | ⚠ partial — Papaya didn't pick OFF this snapshot (R.3 prep "canned" caught a USDA candidate first); when Papaya hits OFF brand-fluff in future snapshots, R.7 will catch |
| Mango → still picks "Mango ohne Zuckerzusatz" | ⚠ partial — Mango eyeballed this snapshot (OFF returned 0 candidates); R.7 logic preserves it (input.size=1, candidate ≤3 tokens, length < 4 → pass) |
| Previously-correct OFF picks (Skyr, EVOO, Hummus, Crushed Tomatoes, Black Beans, Roasted Red Peppers, Salsa Roja) still pick | ✓ — all already saved; logic analysis preserves them per R.7 sketch (length < 4 OR input first-token-match OR input.size > 2) |
| No new failure modes | ✓ |

**R.7 design-intent over-rejections** (Jasmine rice, Anchovy paste): per V20's sketch, generic produce input matched against brand-led candidate is intentional eyeball. Luke confirms branded specifics at /admin/pantry. This is the trust-cal trade-off V20 designed for.

---

## §4 — R.7 protection sanity check (not in this dry-run set)

Logic verification on V20's "must-still-pass" list:

| Case | Input.size | Candidate tokens | R.7 outcome |
|---|---|---|---|
| Skyr → Plain Skyr | 2 | 2 (short) | PASS (length < 4) |
| EVOO → EXTRA VIRGIN OLIVE OIL | 4 | n/a | SKIP (input.size > 2) |
| Hummus → Hummus, commercial | 1 | 2 | PASS (length < 4) |
| Crushed Tomatoes (canned) → ... | 3 | n/a | SKIP (input.size > 2) |
| Black beans (canned) → ... | 3 | n/a | SKIP (input.size > 2) |
| Roasted red peppers → ... | 3 | n/a | SKIP (input.size > 2) |
| Salsa roja → Salsa Roja | 2 | 2 | PASS (length < 4) |

**All 7 V20-listed correct OFF picks remain pickable under R.7.** ✓

---

## §5 — Cumulative rule stack

After Path D + E + E.1 + γ + R.7, the matcher stack:

1. **Threshold 0.6** — token-overlap floor
2. **R.1 strong-descriptor** — input "ground/lean/raw/dried/etc." must be in candidate
3. **R.2 meat-source** — input meat-token must be in candidate
4. **R.2.5 inverse meat-source** — candidate meat-token w/o input meat → reject
5. **R.3 dish-class** — candidate "bread/dip/sauce/mayo/mix/etc." → reject (with R.3.5/b override for inherently-prepared inputs)
6. **R.3 preparation** — candidate "cooked/pickled/canned/etc." not in input → reject
7. **R.6 anti-flour** — candidate leading with "flour" + input lacks "flour" → reject
8. **R.7 OFF brand-fluff** — short input + long brand-led candidate → reject (OFF only)
9. **OVERRIDE_EYEBALL** — manual force-eyeball for precision-class mismatches
10. **Foundation > FNDDS** tier preference at search route (raw default)
11. **USDA → OFF cascade** — when USDA fails R.1-R.6, fall through to OFF Tier 2

---

## §6 — Asks / decisions

**A.1 — V20 confirms R.7 as the final wave-2 cleanup refinement.** R.7 catches the OFF brand-fluff failure class. The Op FASTRAK bulk-add doctrine is feature-complete from a matcher perspective.

**A.2 — Disposition on existing wave-1+2 saved rows that R.7 would now reject:**
- None of the 19 wave-1 saves match R.7's brand-fluff pattern (Mozzarella, Egg whites, Skyr, Parmesan, Greek yogurt, Hummus, Crushed Tomatoes, etc. all pass).
- Wave-2 saves: Cento anchovy paste (already deleted in Path γ — was wave-2 save-fail), Tilda(?) Jasmine rice — not currently in DB.
- **No retroactive cleanup needed.**

**A.3 — Brick Delta queue update:**
- ✓ R.6 anti-flour rule (deployed) — was queued
- ✓ R.7 OFF brand-fluff rule (deployed) — was queued
- Remaining: OFF save-fail investigation, LLM-fill LEAN PROTEINS unit_alts, Aicha Tomato Paste 0-kcal, optional R.4 if Ricotta-class recurs

**A.4 — STOP-for-review posture maintained.** No additional bulk-add execution.

---

## §7 — Cleanup state

- **Production: 61 products.** Unchanged since Path γ cleanup.
- **Git: HEAD `04345b4`** (R.7 commit; script-only, no Vercel deploy needed).
- **Working tree: clean.**
- **Verification dry-run: 0 writes.**

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_BULKADD_R7.md
