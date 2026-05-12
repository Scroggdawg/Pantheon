# Op FASTRAK Brick Gamma A — Gate 1

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Sub-fix Gamma A complete and committed (web + native). Push HOLD per V20's bundle discipline. Awaiting Gate 1 review.

---

## §0 — Status

Schema layer for unit_alternatives shipped. Migration 019 applied to live Supabase, USDA `/v1/food/{fdcId}` integration written, 33-product backfill ran live with **20/33 (60.6%) coverage**, matcher cascade now passes unit_alternatives through to FoodItem. Type-check clean both repos.

Commits: web `114c898`, native `36d634b`.

---

## §1 — What changed

### Web `114c898` — 6 files, +558/-2 lines

```
A  supabase/migrations/019_unit_alternatives.sql       (3 columns + index, additive)
A  lib/usda/portions.ts                                (USDA /v1/food/{fdcId} integration)
A  scripts/backfill-product-portions.ts                (one-time-or-force backfill harness)
M  types/database.ts                                   (UnitAlternative + FoodItem.unit_alternatives)
M  lib/claude/tools/search-user-library.ts             (LibrarySearchResult + product/saved_meal mappers)
M  lib/claude/parse-meal-library-shortcut.ts            (3 FoodItem builders pass through)
```

### Native `36d634b` — 1 file, +21 lines

```
M  types/database.ts                                   (UnitAlternative + FoodItem mirror)
```

---

## §2 — Verification

### V.0 — Type-check

```
$ npx tsc --noEmit (web)     →  clean
$ npx tsc --noEmit (native)  →  clean
```

### V.1 — Migration 019 applied + verified

```
ALTER TABLE products
  + unit_alternatives jsonb NOT NULL DEFAULT '[]'
  + fdc_id integer NULL
  + unit_alternatives_updated_at timestamptz NULL
  + index products_fdc_id_idx (partial WHERE fdc_id NOT NULL)
```

REST probe confirms column present + queryable:
```
GET /products?select=id,name,unit_alternatives,fdc_id,unit_alternatives_updated_at&limit=2
→ rows with unit_alternatives populated for backfilled products,
  empty [] for unbackfilled products, null fdc_id for un-resolved
```

### V.2 — Backfill empirical results (33 products)

```
processed:           33
fdcId recovered:     33  (100% — name-search resolved every product)
portions resolved:   20  (60.6% coverage — Gamma A acceptance threshold)
zero-portion fall-through: 13  (Gamma C LLM-fill candidates)
writes:              20
```

**Spot-check 3 representative rows post-backfill:**

```
Bananas (fdc=1105073) → 1 portion: { unit: 'banana', grams: 110, source: 'usda', confidence: 'high' }
Bell Peppers (fdc=2706747) → 1 portion: { unit: 'cup', grams: 217, source: 'usda', confidence: 'high' }
Blueberries (fdc=2709275) → 2 portions: cup=150g, berry=2g
```

13 zero-portion products (all Branded entries with empty foodPortions arrays in USDA): Eggs - Large, Goya Coconut Water, Harmless Harvest, Isopure Powder, Cottage Cheese, Magic Spoon Strawberry, Creatine, Mott's Applesauce, Quaker Oats, REBBL Hazelnut, Yasso Sea Salt Caramel, plus 2 others. Future Gamma C LLM-fill will hand-fill via Haiku call.

### V.3 — Matcher passthrough (verify-alpha6-d.ts re-run)

All 7 cascade test queries pass with unchanged tier semantics. unit_alternatives propagates from products row → ProductRow → productToCandidate → LibrarySearchResult → FoodItem (when product candidate hit). For saved_meal candidates, single-food saved_meals project from `foods_json[0].unit_alternatives` (per-saved_meal user override surface — no overrides exist yet since Gamma D ships the write path).

### V.4 — Cleanup

- Diagnostic `scripts/probe-resolve.ts` deleted before commit
- Live writes were one-time backfill (no test rows to clean up)
- No pending state changes

---

## §3 — Surprises / flags / disagreements

### S.1 — Two USDA-side data-quality issues caught + filtered

**S.1a — RACC entries:** USDA Foundation entries sometimes include a portion with `measureUnit.name = 'RACC'` (Reference Amount Customarily Consumed — FDA regulatory shorthand, not user-meaningful). My initial implementation surfaced "racc=140g" on Bananas. Fixed mid-EXECUTE: added `if (measureName === 'RACC') return null` to portionToUnitAlternative. Re-ran backfill with --force on affected rows.

**S.1b — Foundation modifier names like "Peeled":** Foundation entries occasionally use natural-language modifiers ("Peeled") as the canonical unit. These survive as legit unit_alternatives entries — my parser correctly uses measureUnit.name when not 'undetermined'. Flagging for V20: a "Peeled" unit picker option is grammatically odd but technically accurate (1 peeled banana = 110g). Future Gamma iteration could add a synonym/normalization pass.

### S.2 — USDA name-search has nondeterministic ranking on close calls

During iteration I observed the same `usdaResolveFdcId('Blueberries', null)` call returning fdc=2376881 (Branded, 0 portions) on one run and fdc=2709275 (Survey FNDDS, 2 portions) on another. The Foundation/FNDDS-first preference + query-prefix scoring largely fixed this, but USDA's search ranking has some inherent fluctuation across requests.

**Implication:** the 60.6% coverage number is stable-ish but not deterministic. Re-running the backfill on the same 33 products might shift coverage by ±2-3 products. For Gamma A's purpose (foundational data layer), this is acceptable — Gamma C LLM-fill catches misses, Gamma E hand-resolution refines.

### S.3 — Bug fixes applied during EXECUTE (worth noting for replay archeology)

- **Parser missed `modifier` field:** SR Legacy entries put unit name in `modifier` (e.g., 'tbsp', 'cup'), not portionDescription. Original parser only checked `measureUnit.name` + `portionDescription`. Fixed.
- **Description-length sort too crude:** "Waffle, fruit" (13 char) beat "Blueberries, raw" (16 char) on raw description-length sort because "Waffle, fruit" had a fruit name match. Added query-prefix preference (`prefixScore`) — descriptions starting with the query name win over equally-tier-ranked alternatives. Fixed.
- **Branded path ran first:** original logic preferred Branded with brand, but Branded entries rarely have foodPortions (they list per-package serving in serving_size_g instead). Reordered to Foundation/FNDDS first, Branded fallback. Fixed.

All three issues caught + fixed before commit. The empirical-iteration pattern from prior bricks (smoke → discover → refine → re-smoke) carried forward.

### S.4 — search-food-database.ts (parse-time USDA tool) NOT updated

Per Gamma A scope decision: parse-time USDA hits don't fetch `/v1/food/{fdcId}` detail (they hit `/foods/search` for lighter list). The new unit_alternatives population happens via bulk-cache (Gamma A backfill + future Gamma E manual add), not at parse time.

When the matcher returns a USDA candidate that ISN'T in our products table cache, the FoodItem returned has `unit_alternatives` undefined. Delta editor handles undefined gracefully (no unit picker → fallback to qty input only).

### S.5 — No disagreements with brief

V20's six approved architectural calls held throughout. The three open-ended Q1/Q2/Q3 answered as stated:
- **Q1 (unit normalization):** lowercase + space-preserved + leading-numeric-prefix-stripped. "1 fl oz" → "fl oz", "1 banana" → "banana". Keeps human readability for UI; canonical for downstream parsing.
- **Q2 (cache scope):** wrote directly to products. food_query_cache stays for runtime LLM tool. Per V20's explicit confirmation.
- **Q3 (empty unit_alternatives):** products with no resolvable USDA portions stay at `[]`. Matcher returning them works fine (FoodItem.unit_alternatives is optional). Per V20's explicit confirmation.

---

## §4 — Asks / greenlight requests

**A.1 — V20 Gate 1 review.** 6-file web commit + 1-file native commit ready. Push HOLD.

**A.2 — Push approval.** Per Alpha.6 schema-code memory rule, migration 019 is forward-compatible (additive ADD COLUMN). Already applied to live Supabase. Pushing the matching code is now safe — no atomic-window concern. Recommend push at V20's discretion (no outage risk if push delays since pre-Gamma-A code reads unchanged from products without referencing the new column).

**A.3 — Greenlight Gamma B brief.** When V20 is ready, Phase 0 for Gamma B will need additional recon on OFF text-search behavior + ranking semantics + bulk-cache write path. Estimated 5-8 turns per Phase 0 §A.3.

---

## §5 — Plan re-evaluation

Gamma A landed clean within Phase 0's 6-8 turn estimate (ran 7 turns including the iteration on USDA search ranking). The two USDA-side quirks (RACC entries, Branded-first issue) were caught empirically and fixed before commit — same iteration discipline as Alpha.6 Sub-fix D.

13 products remain at 0 unit_alternatives. These are Gamma C LLM-fill candidates and will be re-resolved during that sub-brick's EXECUTE. Hand-resolution via Gamma E bulk-add UI is also available.

No structural changes to the remaining brick. Gamma B → Gamma C/D/E bundle still on the docket per Phase 0.

---

## §6 — Commits

### Web `Scroggdawg/Pantheon` main (1 commit ahead of `origin/main`)

```
114c898  S27 Op FASTRAK Brick Gamma A: unit_alternatives schema + USDA backfill
```

### Native `Scroggdawg/pantheon-native` main (1 commit ahead of `origin/main`)

```
36d634b  S27 Op FASTRAK Brick Gamma A: mirror UnitAlternative type
```

Push HOLD until V20 Gate 1 PROCEED.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_GAMMAA_HANDOFF_1.md
