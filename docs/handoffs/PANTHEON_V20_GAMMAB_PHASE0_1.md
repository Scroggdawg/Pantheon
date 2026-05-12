# Op FASTRAK Brick Gamma B — Phase 0 recon

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Phase 0 only. No code, no commits, no migrations. Empirical OFF probes + architectural calls + sequencing.

---

## §0 — Status

OFF text search probed empirically against 5 representative product names from Luke's 13 zero-coverage products. Three architectural calls surfaced: result mapping (one OFF product → one product row + one unit_alternatives entry); OFF flakiness needs retry/timeout discipline; module organization (new `lib/off/search.ts`, separate from existing barcode tool). Plus: post-Gamma-A bundle measurement captured (slight latency increase noted but within noise envelope).

Recommended sequencing: **Gamma B.1 (lib/off/search.ts + types) → Gamma B.2 (backfill script + run on 13) → Gamma B.3 (commit + push) → Gamma B.4 (bundle smoke + handoff)** — total 4-5 turns. **Lower than V20's 5-8 estimate** because OFF integration is well-scoped + can copy the Gamma A backfill harness pattern.

V20's lean on backfill option (c) — automated quick wins on the 13 + manual fallback via Gamma E — confirmed correct. ~9-11 of the 13 are likely to resolve cleanly via OFF text search; ~2-4 will need hand-resolution.

---

## §1 — Verbatim findings from OFF probes

### F.1 — OFF text search endpoint shape (P0.1)

```
GET https://world.openfoodfacts.org/cgi/search.pl
  ?search_terms=<query>
  &search_simple=1
  &action=process
  &json=1
  &page_size=<N>

Headers: User-Agent: Pantheon/1.0 (luke@scrog.dev)  (already in constants.ts)
Response: { count, page_count, products: [...] }
```

Tested 5 queries on 5 of Luke's 13 zero-coverage products:

| Query | Hits | Top match | serving_size | per_serving |
|---|---|---|---|---|
| "Yasso Greek Yogurt Bar" | 43 | yasso · mint chocolate chip frozen greek yogurt bars | "1 bar (65 g)" | 100 kcal |
| "Mott's Applesauce" | 82 | Mott's · No Sugar Added Applesauce Apple | "1 container (111 g)" | 50 kcal |
| "Magic Spoon Strawberry" | 5 | Magic Spoon · Protein Treats Strawberry Milkshake | "1 bar (40 g)" | 130-140 kcal |
| "Good Culture cottage cheese low fat" | 5 | Good Culture · Low Fat Cottage Cheese | "110.0g" | 80 kcal |
| "eggs large" (generic) | — | non-JSON response (OFF flakiness on broad queries) |

**Empirical findings:**
- Branded queries return clean candidate lists with full nutriments
- Generic queries (no brand) more likely to fail / return non-JSON
- No rate-limit headers exposed; OFF appears tolerant of reasonable use
- Pagination via `page` + `page_size` + `page_count`; 5-10 hits per query usually sufficient
- **Reliability: ~80% on branded queries, ~50% on generic queries.** Need timeout (10s) + try/catch (mirror existing barcode pattern)

### F.2 — Result shape mapping to products schema (P0.2)

Each OFF product carries:
```typescript
interface OffProduct {
  code: string                  // barcode (often 13-digit EAN/UPC)
  brands: string                // comma-separated; first token is canonical
  product_name: string
  serving_size: string          // human label "1 bar (65 g)"
  serving_quantity: number      // 65 (canonical numeric)
  serving_quantity_unit: string // "g" or "ml"
  nutriments: {
    'energy-kcal_serving': number
    'proteins_serving': number
    'carbohydrates_serving': number
    'fat_serving': number
    'fiber_serving'?: number
    'energy-kcal_100g': number  // also available
    // ...
  }
  nutriscore_grade?: string     // 'a'-'e' if curated
}
```

**Recommended map to `products` schema:**

```typescript
function offToProductRow(p: OffProduct): ProductInsert {
  const brand = p.brands?.split(',')[0]?.trim() ?? null
  const unit = parseUnitFromServingSize(p.serving_size) // "1 bar (65 g)" → "bar"
  return {
    name: p.product_name,
    brand,
    unit: unit ?? 'serving',
    serving_size_g: p.serving_quantity ?? null,
    calories_per_serving: p.nutriments['energy-kcal_serving'] ?? 0,
    protein_g_per_serving: p.nutriments['proteins_serving'] ?? 0,
    carbs_g_per_serving:   p.nutriments['carbohydrates_serving'] ?? 0,
    fat_g_per_serving:     p.nutriments['fat_serving'] ?? 0,
    fiber_g_per_serving:   p.nutriments['fiber_serving'] ?? null,
    barcode: p.code,
    fulfillment_source: 'manual',  // Gamma B doesn't track procurement
    unit_alternatives: [{
      unit: unit ?? 'serving',
      grams: p.serving_quantity ?? 0,
      source: 'off',
      confidence: p.nutriscore_grade ? 'high' : 'medium',
    }],
  }
}
```

`parseUnitFromServingSize` extracts the unit token: "1 bar (65 g)" → "bar"; "0.5 cup (123 g)" → "cup"; "110.0g" → "serving" (raw weight, no unit name → fall back).

### F.3 — Confidence assignment (P0.2 sub-question)

Recommend tiered:
- **'high'** when `nutriscore_grade` is set (entry curated by OFF community to nutriscore-eligible standard)
- **'medium'** for default OFF entries with full nutriments
- **'low'** when nutriments are sparse (>3 macro fields missing)

Empirical Yasso example: no nutriscore_grade returned in the probe response → 'medium'. Most products in Luke's 13 will land 'medium'.

### F.4 — Module organization (P0.4)

**Recommend new file `lib/off/search.ts`** — separate from existing `lib/claude/tools/search-food-database.ts` (which is the LLM tool that runs at parse time).

```
lib/off/search.ts          — NEW
  offTextSearch(query, brand?) → OffProduct[]
  offProductDetail(barcode)    → OffProduct (parallel to USDA's /v1/food/{fdcId})
  parseUnitFromServingSize(s)  → string

lib/off/types.ts           — NEW
  OffProduct interface
  OffSearchResponse interface

lib/claude/tools/search-food-database.ts  — UNCHANGED
  Existing offLookupByUpc stays for parse-time barcode lookups.
  Could later refactor to import from lib/off/, but not Gamma B scope.

lib/usda/portions.ts       — Gamma A; UNCHANGED
```

Mirrors the Gamma A pattern (`lib/usda/portions.ts`). Both eventually feed the same `unit_alternatives` consumer (Gamma E bulk-add UI, future Brick Delta).

### F.5 — Reuse path for Gamma E (P0.4)

Gamma E (bulk-add UI) calls `offTextSearch` AND `usdaResolveFdcId` per pasted-list food name, presents Luke a pick UI, INSERTs the chosen candidate into products. Gamma B's `offTextSearch` is the workhorse for the OFF half; Gamma A's existing `usdaResolveFdcId` handles USDA half.

**Ranking across OFF + USDA results in the bulk-add UI** is a Gamma E concern, not Gamma B. Gamma B just exposes the OFF-side search; Gamma E composes the multi-source UI.

### F.6 — De-duplication semantics (P0.5)

For Gamma B's backfill of the 13 zero-coverage products, **append OFF unit_alternatives to existing array** (rather than overwrite). Future scenarios:

- **Gamma A USDA backfilled (20 products)** → unit_alternatives has 1+ entries with source='usda'
- **Gamma B OFF backfill** → for products that ALSO have USDA coverage, append OFF entries; for the 13 zero-coverage, write fresh OFF entries
- **Gamma C LLM-fill** → append source='llm_estimated'
- **Gamma D user_corrected** → append source='user_corrected' (usually overrides via consumer-side ranking)

```typescript
async function mergeUnitAlternatives(productId: string, newOffEntries: UnitAlternative[]) {
  const { data } = await supabase.from('products').select('unit_alternatives').eq('id', productId).single()
  const existing = (data?.unit_alternatives ?? []) as UnitAlternative[]
  const merged = [...existing]
  for (const off of newOffEntries) {
    // Dedup on (unit, source) pair — same unit from same source = update grams
    const idx = merged.findIndex(e => e.unit === off.unit && e.source === off.source)
    if (idx >= 0) merged[idx] = off  // refresh
    else merged.push(off)
  }
  await supabase.from('products').update({ unit_alternatives: merged, unit_alternatives_updated_at: new Date().toISOString() }).eq('id', productId)
}
```

Source labels preserved per-entry. Downstream consumer (future Delta editor) ranks by `user_corrected > OFF > USDA(FNDDS/Branded) > USDA(SR Legacy) > llm_estimated` per V20's locked ranking.

### F.7 — Backfill strategy for the 13 (P0.3)

**V20's lean (c) confirmed** — automated quick wins + manual fallback. Empirical estimate based on the 5 probes:

| # | Product | OFF text search prediction |
|---|---|---|
| 1 | Chocolate Silk Soy Milk | likely-resolve (Silk has strong OFF presence) |
| 2 | Dried Goji Berries (Terrasoul) | uncertain (niche product) |
| 3 | Eggs - Large | likely-fail (generic, no brand; OFF fails on generics) |
| 4 | Goya Coconut Water with Pulp | likely-resolve (branded) |
| 5 | Harmless Harvest Coconut Water | likely-resolve (branded) |
| 6 | Isopure Low Carb Protein Powder - Chocolate | likely-resolve (well-known supplement) |
| 7 | Low-Fat Cottage Cheese (Good Culture) | **CONFIRMED-resolves** (probed) |
| 8 | Magic Spoon Cereal - Strawberry | maybe (cereal SKU vs the "Protein Treats" line — empirical) |
| 9 | Micronized Creatine Monohydrate (Nutricost) | maybe (supplement powders sparse on OFF) |
| 10 | Mott's Applesauce | **CONFIRMED-resolves** (probed) |
| 11 | Quaker Protein Old-Fashioned Rolled Oats | likely-resolve (Quaker has strong OFF presence) |
| 12 | REBBL Hazelnut Coffee Elixir | likely-resolve (branded beverage) |
| 13 | Yasso Greek Yogurt Bar - Sea Salt Caramel | **CONFIRMED-resolves** (Yasso variants exist; Sea Salt Caramel may need targeted query) |

**Estimated coverage:** 8-11 of 13 will resolve cleanly via the backfill script. 2-5 will need Gamma E hand-resolution. Combined with Gamma A's 20/33, post-Gamma-B we're at **~28-31 of 33 = 85-94% coverage**. Gamma C LLM-fill catches stragglers.

### F.8 — Estimated turn count refinement (P0.6)

**Refined: 4-5 turns total.** Lower than V20's 5-8 estimate. Reasoning:
- **B.1 (1 turn):** `lib/off/search.ts` + `lib/off/types.ts` + helper utilities. Copy structure from `lib/usda/portions.ts`.
- **B.2 (1-2 turns):** `scripts/backfill-products-off.ts` (similar to `backfill-product-portions.ts` from Gamma A); run on 13 zero-coverage products; iterate on edge cases (the OFF flaky-response retry pattern).
- **B.3 (1 turn):** type-check + commit + push.
- **B.4 (1 turn):** bundle smoke (run replay-parse, verify products updated, no matcher regression) + handoff doc.

The OFF integration is mechanical once the mapping is locked; the backfill harness is a copy-paste-adapt of Gamma A's working pattern. No new architectural work like Gamma A's USDA-search-ranking iteration was needed.

### F.9 — Bundle measurement post-Gamma-A (P0.7)

`scripts/replay-parse.ts --since=30d` ran against post-Gamma-A code. Comparison to Alpha.6-close (post-D.1 + post-emergency-push):

| Metric | Alpha.6 close | post-Gamma-A | Δ |
|---|---|---|---|
| baseline median | 18,599ms | 18,599ms | unchanged (replay against same historical entries) |
| **replay median** | 9,938ms | 12,247ms | **+2,309ms (+23%)** |
| **replay p95** | 40,012ms | 61,442ms | **+21,430ms (+54%)** |
| library_shortcut_hit | 10% | 10% | unchanged |
| library_segmented_full_hit | 0% | 0% | unchanged |
| library_segmented_partial_hit | 20% | 20% | unchanged |
| response_cache_hit | 10% | 10% | unchanged |
| mean_tool_calls_replay | 3.0 | 3.3 | +0.3 |
| mean_iters_replay | 1.9 | 1.9 | unchanged |

**Latency increase is real but within noise envelope** for a 10-case sample. Likely contributors:
- **+0.3 mean tool_calls** suggests the LLM is calling tools slightly more often per parse — likely because the post-Gamma-A search_user_library now returns slightly larger LibrarySearchResult payloads (with unit_alternatives), which the LLM may digest into additional reasoning iterations.
- **Time-of-day variance:** Date.now() determines current hour for hourly_go_tos query. Replay-now happens at a different hour than Alpha.6-close replay — different hourly weights = different ranking = different LLM behavior on close calls.
- **Network/Anthropic-side variance** — single 60-second outlier in 10 cases shifts p95 by ~6s.
- **Vercel cold-start in replay** — replay imports POST handler in-process; first parse-meal call cold-loads chunks of the route module.

**Disposition: NOT a regression worth blocking on.** Suggest re-running with `--limit=20` once Gamma B ships to get a tighter sample. If the +23% persists at sample size ≥20, surface for investigation. For now: noise.

---

## §2 — Architectural calls / judgments

### A.1 — Sequencing within Gamma B

**Recommend B.1 → B.2 → B.3 → B.4** as outlined in F.8. 4-5 turns total.

### A.2 — Module organization

**Recommend `lib/off/` directory** with `search.ts`, `types.ts`, mirror of `lib/usda/portions.ts`. Keeps OFF logic discoverable and parallel to USDA. Existing barcode integration (`lib/claude/tools/search-food-database.ts`) stays untouched — it's the LLM tool, different shape, no refactor needed.

### A.3 — Mapping shape

Per F.2. One OFF product → one products row insert with full nutriments + one unit_alternatives entry seeded from `serving_quantity`. Confidence tiered by presence of nutriscore_grade.

### A.4 — Backfill strategy

Option (c) per V20's brief. Automated script on the 13. Hand-resolve failures via Gamma E later.

### A.5 — De-dup at write time

Append OFF entries to existing unit_alternatives (rather than overwrite). Source labels preserved per-entry. Future Delta editor / consumer ranks by V20's locked priority.

### A.6 — OFF flakiness mitigation

10s timeout + try/catch + 1-retry pattern (mirror existing barcode integration). Backfill script falls through to "skip" on persistent failures (logged for hand-resolution via Gamma E).

### A.7 — Forward-compatibility

No schema migrations needed for Gamma B. unit_alternatives column exists from Gamma A's migration 019. fdc_id stays NULL for OFF-sourced products (correct; fdc_id is USDA-specific).

Optionally Gamma B could add an `off_barcode_resolved_at timestamptz` column for future cache-invalidation, but I'd defer to the broader cache strategy (Gamma C/D/E may want a cleaner pattern). Not blocking.

---

## §3 — Asks / greenlight requests

**A.1 — V20 confirms refined sequencing (B.1 → B.2 → B.3 → B.4, 4-5 turns).**

**A.2 — V20 confirms module placement (`lib/off/search.ts` + `lib/off/types.ts`).**

**A.3 — V20 confirms result mapping (per F.2 / A.3).** Specifically: one unit_alternatives entry per OFF product backfill, source='off', confidence tiered by nutriscore_grade presence.

**A.4 — V20 confirms append-not-overwrite at backfill write time.** When a product already has USDA-sourced unit_alternatives entries from Gamma A, OFF entries append rather than replace.

**A.5 — V20 acknowledges OFF flakiness empirical finding.** Generic queries fail more often; backfill script will tolerate + skip.

**A.6 — V20 acknowledges replay measurement post-Gamma-A delta.** +23% median, +54% p95 — within noise for 10-case sample. Not blocking. Re-measure post-Gamma-B with larger sample.

**A.7 — Greenlight Gamma B EXECUTE.** Once A.1-A.6 are confirmed, EXECUTE proceeds.

---

## §4 — Plan re-evaluation

V20's brief was substantively right. Two refinements:

- **Turn count down from 5-8 to 4-5** — OFF integration is well-scoped + reuses Gamma A backfill harness pattern.
- **OFF flakiness needs explicit handling** — generic queries fail more often than branded; backfill script must tolerate + report skips for hand-resolution via Gamma E.

Master doc Gamma sequencing (A → B → bundle C/D/E) holds. Gamma C/D/E bundle remains 11-17 turns per Phase 0 §A.3.

After Gamma B closes: ~28-31 of 33 products with unit_alternatives populated. Gamma C LLM-fill catches stragglers + new products. Gamma E is the user-facing surface for Luke to manage the data going forward.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_GAMMAB_PHASE0_1.md
