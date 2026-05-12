# Op FASTRAK Brick Gamma — Closed

**Date:** 2026-05-09
**From:** Terminal Claude
**To:** V20 Chat Claude
**Status:** Brick Gamma closes here.

---

## §0 — Final state

Op FASTRAK Brick Gamma data layer is complete. Every Pantheon product carries unit-conversion data sourced from at least one of {USDA Foundation/FNDDS, OFF, llm_estimated}. The bulk-add UI at `/admin/pantry` lets Luke grow library aggressively going forward. Brick Beta + Brick Delta + post-FASTRAK Brick K all consume this data layer.

| Surface | State |
|---|---|
| Web `pantheon.guru` / `pantheon-woad.vercel.app` | LIVE on commit `41773b1` (Gamma E head) |
| Live Supabase products table | 33 rows, **33/33 = 100% coverage** with unit_alternatives populated |
| Schema migrations applied (Gamma) | 1 (migration 019 — unit_alternatives + fdc_id + unit_alternatives_updated_at) |
| Web origin/main commits past pre-FASTRAK (`179a19b`) | 14 cumulative (8 from Alpha.6 + 1 from Brick I native sync only + 1 from Sub-fix G + 1 from emergency push order + 3 from Gamma A/B/C + 1 from Gamma E) |
| Native origin/main commits past pre-Brick-I (`cd148db`) | 3 (Brick I native I.3, Alpha.6 E, Gamma A type mirror) |
| OTA group | `23149dfe-…` (Alpha.6 production OTA, runtime `1949eb33…`) — still serves Build 21 fleet |
| Memory rules captured during Gamma arc | 1 (`feedback_module_lazy_init.md` from Gamma C F.1) |

**Verification empirically validated:** 33/33 products carry unit_alternatives; matcher cascade integrity holds (verify-alpha6-d.ts 7/7 cascade tests pass post-each-Gamma-sub-brick); Gamma E auth gating works on production (HTTP 307 without cookie, 200 with); search endpoint serves under prod load.

---

## §1 — Final commits on `Scroggdawg/Pantheon` main (Gamma arc)

```
41773b1  S27 Op FASTRAK Brick Gamma E: bulk-add UI at /admin/pantry
6d9eb50  S27 Op FASTRAK Brick Gamma C: LLM-fill backfill (33/33 = 100% coverage)
c18aed8  S27 Op FASTRAK Brick Gamma B: OFF text search + bulk-cache backfill
8e2b693  S27 Op FASTRAK Brick Gamma A.2: hourly_go_to backfills unit_alternatives via source_ref
0873aaa  S27 Op FASTRAK Brick Gamma A.1: foodFromLibraryHit unit_alternatives passthrough
114c898  S27 Op FASTRAK Brick Gamma A: unit_alternatives schema + USDA backfill
```

6 commits across the Gamma arc. Each Gate 1 reviewed individually + pushed individually (per locked push-scope memory rule + Alpha.6 schema-code atomic memory rule).

### Native (Gamma A type mirror only)

```
36d634b  S27 Op FASTRAK Brick Gamma A: mirror UnitAlternative type
```

1 native commit. No OTA needed — Gamma's UI surface is web-only (Delta consumes data layer in iPhone UI later).

---

## §2 — Cumulative cost ledger (Brick Gamma only)

| Resource | Spend |
|---|---|
| Schema migrations applied to live | 1 (019_unit_alternatives.sql — additive 3 columns + index) |
| Forward-incompatible migrations | 0 (all Gamma migrations forward-compatible per Alpha.6 schema-code atomic rule) |
| New API endpoints | 2 (`/api/admin/pantry/search`, `/api/admin/pantry/save`) |
| New library modules | 3 (`lib/usda/portions.ts`, `lib/off/search.ts` + types, `lib/llm-fill/portions.ts`) |
| Backfill scripts | 3 (`backfill-product-portions.ts` USDA, `backfill-products-off.ts` OFF, `backfill-products-llm.ts` LLM-fill) |
| Eval harness scripts | 1 (`eval-llm-fill.ts` for Gamma C prompt validation) |
| Page routes | 1 (`/admin/pantry`) |
| New components | 1 (`components/admin/PantryRow.tsx` extracted per A.7) |
| Web file additions | ~10 |
| Web file modifications | ~6 (search-user-library.ts cascade extension, parse-meal-library-shortcut.ts FoodItem builders, types/database.ts, classifier.ts foodFromLibraryHit, search-user-library altsForRef enrichment) |
| Lines added (web) | ~3000 net |
| Native file modifications | 1 (types/database.ts — UnitAlternative type mirror) |
| EAS production iOS builds | 0 (Gamma is web-only) |
| EAS Update publishes | 0 |
| Local commits (Gamma arc) | 7 (web 6 + native 1) |
| Pushes to GitHub | 6 (Gamma A + A.1 + A.2 + B + C + E; native A.0 mirror separately) |
| Vercel deploys | 6 (one per push) |
| Conversation turns (Gamma arc) | ~40 (Gamma A 7 + A.1 1 + A.2 1 + B 6 + C 4 + E 1 + handoffs) |
| Memory rules captured | 1 (lazy-init API clients per Gamma C F.1) |
| Doctrine bugs caught + fixed | 3 (Gamma A USDA search ranking; Gamma C Anthropic SDK lazy-init; Gamma A.1+A.2 matcher passthrough — found via post-deploy verification) |

**Total wall-clock cost** : ~6-8 hours across multi-day session arc (estimated; not measured precisely). No Apple processing time (web-only). No outages caused by Gamma (in contrast to Alpha.6's schema-code drift outage which produced the new memory rule).

---

## §3 — Cumulative payback projection

### Coverage achieved

| Stage | Products with unit_alternatives | Δ from prior |
|---|---|---|
| Pre-Brick-Gamma | 0 of 33 (0%) — column didn't exist | — |
| Post-Gamma-A | 20 of 33 (60.6%) | +20 (USDA Foundation/FNDDS portions) |
| Post-Gamma-B | 27 of 33 (81.8%) | +7 net (OFF text-search; minus Eggs - Large revert) |
| Post-Gamma-C | 33 of 33 (**100%**) | +6 (LLM-fill on remaining stragglers) |
| Post-Gamma-E | 33 of 33 (100%) maintained + new infrastructure | operational tool for future growth |

### What this enables

**Brick Delta (PLATE portion editor)** — consumes `products.unit_alternatives` (canonical) and `saved_meals.foods_json[i].unit_alternatives` (per-saved_meal user overrides) at edit time. Delta UI lets Luke pick units from this array, scale qty, see grams. The data is now there for every product Luke encounters via the matcher cascade.

**Brick Beta (matcher upgrade)** — gates on having library data to differentiate matcher quality. Pre-Gamma, the matcher had ~33 products as differential surface; post-Gamma-E, Luke can grow the library to 200+ in a single bulk-add session. Beta's variant-merge / compound-name segmenter / Tier 1 promotion improvements compound when there's more data to operate on.

**Post-FASTRAK Brick K (barcode scanner)** — reuses the OFF + USDA candidate-picker pattern from Gamma E. The /admin/pantry inline structure transfers to native barcode-paste workflow when K scopes.

### Operational moat

Pre-Gamma-E, every new product Luke encountered required either:
- Logging it via voice + accepting whatever the LLM cascade produced (variable quality)
- Manually creating via SaveMealModal (requires per-food data entry)

Post-Gamma-E, Luke can paste 30 food names from his pantry in one session, click "Search", review OFF + USDA candidates, click "Save all" — and the products table grows by 30. Each product carries full unit_alternatives + macros + brand + barcode (when from OFF) + fdc_id (when from USDA).

**Empirical payoff:** Luke's first bulk-add session is the empirical surface. Matcher hit rate change (currently ~10% library_shortcut_hit) should jump as library grows; that's the post-session metric to track at Brick Beta scoping.

---

## §4 — Memory rule captured during this brick

**`feedback_module_lazy_init.md`** indexed in `MEMORY.md`:

> Modules instantiating API clients at top-level (`const client = new SDK()`) work in Vercel runtime but break when imported from scripts using `loadEnvLocal` at script-top-level. Lazy-init via factory is portable.

Empirically validated during Gamma C: the eval harness `scripts/eval-llm-fill.ts` returned all 13 ground-truth eval cases as failures (0-14ms latencies) on first run because the static `import { llmFillPortions } from '../lib/llm-fill/portions'` hoisted ABOVE `loadEnvLocal()`, leaving the Anthropic client constructed without an API key. Fixed by lazy-init `getClient()` factory pattern. Future Brick Delta + Brick K should use lazy-init when those scripts touch `lib/claude/*`.

---

## §5 — Five flags for V20 + Luke before Brick Beta scoping

Ordered by load-bearing-ness for Beta's Phase 0:

### F.1 — Variant-ambiguity gap-gate (Alpha.6 closeout F.1) — STILL the biggest Beta input

Foods that exist as both saved_meals AND hourly_go_tos with different `source_ref` values trigger gap-gate failures in the segmented shortcut. Empirically: parsing "3 eggs and a double espresso" returns partial 1/2 instead of full resolve, even though both are unambiguous saved_meals at the matcher level — because hourly_go_tos surfaces both at score=1.0 with mismatched source_refs, killing the gap-gate.

**Two paths Beta can take:**
- (a) Heart-endpoint backfills the parent food_log_entries.foods_json[i].source_ref to point at the new saved_meal on heart-INSERT
- (b) Cascade dedup logic treats `lib:saved_meal:X` and entries whose source_ref points back at saved_meal X as equivalent

Beta's call. Gamma A.2's altsForRef helper hints at the data-flow direction; Beta extends.

### F.2 — Compound-name segmenter (Alpha.6 closeout F.3)

"One Bacon Egg and Cheese Biscuit from McDonald's and one Sausage Burrito from McDonald's" segments into 3 chunks because the segmenter splits on " and " naively, even when "and" appears inside compound product names ("Bacon Egg and Cheese Biscuit"). COMPOSITE_ALLOWLIST in `parse-meal-library-shortcut.ts` covers a few canonical compound terms (half and half, salt and pepper, mac and cheese) but NOT McDonald's-style names.

**Beta path:** detect when a segment is INSIDE a hearted/saved_meal name; don't split. Or extend COMPOSITE_ALLOWLIST aggressively. Or move from string-rule segmentation to LLM-assisted segmentation for compound-name cases.

### F.3 — McDonald's Tier 1 verification (Alpha.6 closeout F.4)

Luke's V.6 verification hearted 2 McDonald's items; never empirically verified that re-logging "McDonald's Bacon Egg & Cheese Biscuit" hits Tier 1 favorited via the matcher. Production replay sample is bounded by Luke's logged-meals dataset; could be tested via a targeted parse-meal call against the live API.

**Beta scope:** include this verification in the "matcher upgrade" smoke battery.

### F.4 — USDA Experimental dataType pollution (Gamma E F.1)

Search endpoint top-N USDA results occasionally include `dataType: "Experimental"` rows (research paper titles with kcal=null). Save endpoint correctly rejects via per_serving.kcal-null check; UI displays them harmlessly. Future polish — filter `Experimental` at search-endpoint level.

**Not Beta scope strictly** — more a Gamma maintenance polish — but worth surfacing.

### F.5 — Doctrine learning capture across the Gamma arc

Three doctrine bugs caught + fixed during Gamma EXECUTE:
1. **Gamma A USDA search ranking** — query-prefix preference + Foundation/FNDDS-first + RACC filter were all empirical iterations from initial-pass failures. Net learning: USDA's `/foods/search` endpoint requires careful tier-and-prefix ranking; `pageSize=1` is brittle; `Experimental` rows are pollution.
2. **Gamma C Anthropic SDK lazy-init** — captured as memory rule.
3. **Gamma A.1+A.2 matcher passthrough** — post-deploy verification surfaced that LLM-direct-output path bypassed `foodFromLibraryHit`; `LibrarySearchResult.unit_alternatives` was missing on hourly_go_to-sourced LibrarySearchResults. Caught by hitting the deployed parse-meal API and inspecting FoodItem shape. Empirical post-deploy verification > pre-deploy assumption.

**Pattern across all three:** the iteration-discipline pattern from Alpha.6 Sub-fix D (smoke → discover → refine → re-smoke) carried forward to Gamma arc. Worth folding into a future Tale of Two Claudes amendment. V20-side.

---

## §6 — Brick Beta inputs queued

Per V20's Phase 0 §F.5 framing, Beta scoping should include these:

| Input | Source | Severity for Beta |
|---|---|---|
| F.1 Variant-ambiguity gap-gate | Alpha.6 closeout F.1 | LOAD-BEARING (segmented hit rate impact) |
| F.2 Compound-name segmenter | Alpha.6 closeout F.3 | medium (McDonald's-style names; expanding category) |
| F.3 McDonald's Tier 1 verification | Alpha.6 closeout F.4 | low (existing data, just unverified) |
| F.4 USDA Experimental filter | Gamma E F.1 | polish (not a matcher concern) |
| F.5 Bell Peppers cup discrepancy | Gamma C eval | low (LLM gave chopped, USDA gives whole rings; both correct in their context) |

**Plus** Gamma D (user-correction write path) which V20 explicitly deferred to Brick Delta's Phase 0. Beta doesn't consume Gamma D directly, but Beta's confidence ranking matters more once Gamma D ships (user_corrected entries override). Worth flagging as a downstream interaction.

---

## §7 — Brick Gamma closes

Op FASTRAK Brick Gamma is closed. The data acquisition pipeline is complete. The bulk-add UI gives Luke the operational tool to grow library aggressively. Brick Beta + Brick Delta now have the foundation they need to deliver matcher quality + portion-edit UX.

**Cost paid:**
- 1 forward-compatible schema migration (additive)
- 0 outages (in contrast to Alpha.6's schema-code drift outage)
- 3 doctrine bugs caught + fixed empirically
- 1 memory rule captured
- ~40 conversation turns across the Gamma arc

**Value captured:**
- 33/33 products with unit_alternatives populated (0% → 100% coverage)
- 2 new API endpoints (`/api/admin/pantry/search` + `/save`)
- 3 new library modules (`lib/usda`, `lib/off`, `lib/llm-fill`) reusable for future bricks
- Operational moat tool at `/admin/pantry` for unbounded library growth
- Cascade integrity preserved (verify-alpha6-d 7/7 throughout)

**Ready to pivot to Brick Beta (matcher upgrade).** V20 fires the brief whenever ready. Beta's load-bearing input is the variant-ambiguity gap-gate (F.1); other inputs are smaller and parallelizable.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_GAMMA_COMPLETION_1.md
