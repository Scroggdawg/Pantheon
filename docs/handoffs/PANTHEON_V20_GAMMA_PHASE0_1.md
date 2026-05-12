# Op FASTRAK Brick Gamma — Phase 0 recon

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Phase 0 only. No code, no commits, no migrations. Empirical reads + architectural calls + sequencing recommendation.

---

## §0 — Status

Recon complete. V20's A→B→bundle(C/D/E) phasing validated with one refinement. Three load-bearing surprises surfaced: **OFF integration is BARCODE-ONLY today (text search is new code, expanding Gamma B)**; **products table has no fdcId column** (backfill requires name-search re-resolution per row); **USDA food_portions endpoint exists at `/v1/food/{fdcId}` separately from the existing `/foods/search` endpoint that the matcher uses today** — Gamma A adds the second integration path.

Architectural call on A.3 refined: `unit_alternatives` lives on `products` table (additive column) AND inside `saved_meals.foods_json[i]` (JSONB shape extension, no schema change). The matcher reads from whichever surface the candidate came from. User corrections write to saved_meals.foods_json[i].unit_alternatives.

Recommended sequencing: **Gamma A (foundational, ships value alone) → Gamma B (OFF text search, larger than V20 estimated due to barcode-only baseline) → bundle Gamma C/D/E (polish on top).** Total 21-30 turn estimate, aligned with V20's projection.

---

## §1 — Verbatim source for files referenced

### Products table schema (migration 009, lines 13-32)

```sql
CREATE TABLE IF NOT EXISTS products (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                      text NOT NULL,
  brand                     text,
  unit                      text NOT NULL,
  serving_size_g            numeric,
  calories_per_serving      numeric NOT NULL,
  protein_g_per_serving     numeric NOT NULL,
  fat_g_per_serving         numeric NOT NULL,
  carbs_g_per_serving       numeric NOT NULL,
  fiber_g_per_serving       numeric,
  fulfillment_source        text NOT NULL CHECK (fulfillment_source IN
                              ('amazon_fresh','amazon_prime','whole_foods','manual')),
  barcode                   text,
  product_url               text,
  notes                     text,
  tracks_inventory          boolean DEFAULT false,
  servings_per_unit         integer,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
```

**No `fdcId` column.** Products were created with macro data but the original USDA fdcId wasn't preserved. Backfill requires name-search re-resolution per row (see §3 F.1).

**`fulfillment_source` is for Provisions Planner, NOT matcher source.** The 4-value enum (`amazon_fresh`/`amazon_prime`/`whole_foods`/`manual`) tracks where Luke buys the food, not where the macros came from. Don't conflate during Gamma scope.

### Existing USDA + OFF integration

`lib/claude/tools/search-food-database.ts` (682 lines) — the LLM tool that runs at parse time. Two backend functions:

```typescript
async function usdaSearch(query, dataset, limit): Promise<UsdaFood[]>
  // Hits /v1/foods/search with API key + query + dataType filter
  // Returns lighter list (no foodPortions array)

async function usdaLookupByUpc(upc): Promise<UsdaFood | null>
  // Hits /v1/foods/search with gtinUpc:"<upc>" filter

async function offLookupByUpc(upc): Promise<OffProduct | null>
  // Hits world.openfoodfacts.org/api/v2/product/{barcode}.json
  // ⚠ BARCODE ONLY — no text search backend exists today
```

Endpoints (`lib/claude/tools/constants.ts`):
```
USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'
OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product/{barcode}.json'
USER_AGENT     = 'Pantheon/1.0 (luke@scrog.dev)'
```

Auth: `USDA_FDC_API_KEY` in `.env.local` (verified present). OFF requires `User-Agent` header per their TOS (already set).

### USDA food_portions empirical probe

`GET /v1/food/{fdcId}` returns the FULL food record with `foodPortions[]` array. Sampled `fdcId=2710638` (Margarita on the rocks, USDA-sourced from Luke's logs):

```
foodPortions count: 3
  - {gramWeight: 30,  portionDescription: '1 fl oz',  measureUnit: undetermined}
  - {gramWeight: 225, portionDescription: 'Quantity not specified', ...}
  - {gramWeight: 225, portionDescription: '1 drink', ...}
```

This is the canonical unit_alternatives source. Parser maps:
- `gramWeight → grams`
- `portionDescription` (or `measureUnit.name` when not "undetermined") → `unit`
- Filter "Quantity not specified" / "undetermined" rows
- `source: 'usda'`, `confidence: 'high'` for FNDDS / `'medium'` for SR Legacy / `'low'` for Branded

### Live state (P0.1 confirmation)

```
products:                 33 (matches memory)
saved_meals:              6 (post-Alpha.6 + 2 hearted McDonald's items)
unit_alternatives column: DOES NOT EXIST (42703 confirmed)
USDA_FDC_API_KEY:         present in .env.local
```

### Existing food_query_cache infrastructure (migration 012)

The `search_food_database` LLM tool already caches results with 30-day TTL keyed on `(query, brand, barcode)`. **Gamma's bulk USDA + OFF calls should use a SEPARATE cache surface** — bulk-import semantics (one-shot canonical resolution) differ from per-parse caching (recurring queries with name variants).

---

## §2 — Architectural calls + judgments + flags

### A.1 — `unit_alternatives` placement (refining V20's framing)

**Two surfaces, both populated, no per-user override table:**

- **`products.unit_alternatives` (NEW JSONB column, additive migration):** canonical source for global product data (USDA + OFF + LLM-fill).
- **`saved_meals.foods_json[i].unit_alternatives` (JSONB shape extension, no schema change):** per-saved_meal overrides. When Luke corrects a unit weight in the Delta editor, the correction writes here with `source: 'user_corrected'`.

**Why this works:** saved_meals already store rich FoodItem objects in foods_json[]. Adding `unit_alternatives` as an optional field on FoodItem (TS type) propagates the data without a schema migration on saved_meals. Matcher logic that returns a saved_meal hit gets the user-corrected data automatically. Matcher returning a product hit reads `products.unit_alternatives`.

**Single-tenant assumption:** all saved_meals belong to one user, so per-saved_meal overrides ARE per-user overrides at this scale. Future multi-tenant work would need a `user_unit_overrides` table keyed on (user_id, product_id).

V20's framing (A.3 "per-user `unit_alternatives` overrides on saved_meals") is correct in principle — refinement is just the storage location (inside foods_json items, not a top-level column on saved_meals).

### A.2 — Source priority confidence ranking

V20's locked: `OFF > USDA > user_corrected > llm_estimated`. **Refinement:** user_corrected should beat USDA for foods Luke has explicitly tuned. The user-correction path is intent-driven (Luke saw the wrong macro and edited it). It deserves precedence over the default OFF/USDA reads when Luke saved an override.

**Recommended ranking:**
```
user_corrected > OFF > USDA(FNDDS, Branded) > USDA(SR Legacy) > llm_estimated
```

This matches MacroFactor's empirical behavior (user-tuned data wins for that user). V20's call.

### A.3 — Sequencing within Gamma (validating V20's lean with one refinement)

**Recommended:** **Gamma A → Gamma B → bundle(Gamma C/D/E)**.

| Sub-brick | Scope | Estimate | Ship value alone? |
|---|---|---|---|
| **Gamma A** | Schema migration (019), USDA food_portions integration, 33-product backfill script, matcher reads unit_alternatives for product hits | **6-8 turns** (V20: 5-7) | YES — Luke gets accurate USDA-sourced unit data immediately |
| **Gamma B** | OFF text search NEW (no existing backend), bulk-cache OFF results into products, refresh source ranking | **5-8 turns** (V20: 3-5) | YES — branded foods get accurate per-serving info |
| **Gamma C** | LLM-fill prompt + eval + cache result + run across foods missing USDA/OFF | **4-6 turns** | NO — bundles with D/E for one push |
| **Gamma D** | User-correction loop (saved_meals.foods_json[i].unit_alternatives write path; Delta editor consumes from C+D) | **2-3 turns** | NO — bundles with C/E |
| **Gamma E** | Bulk-add UI at `/admin/pantry` route, Luke-only, MVP paste-list + search-and-pick + bulk INSERT | **5-8 turns** | NO — bundles with C/D |

**Total: 22-33 turns** across Gamma. Real scope.

**Why bundle C/D/E:**
- C produces LLM-fill data; D consumes it via user-correction overrides; E is the bulk-load surface that benefits from C+D being live. Shipping these together avoids a Gamma C in-flight where the matcher uses LLM-fill data without the correction path being live.
- Gamma D's UI piece is in Brick Delta. Gamma D ships only the schema/write path; Delta later consumes it. Bundling C/D/E doesn't pull Delta scope in.

**Why A and B as separate phases:**
- A is foundational (schema + USDA portions). Ships clean value alone.
- B is bigger than V20 estimated because OFF text search is NEW code (existing OFF integration is barcode-only). Need to add: text search endpoint, ranking against USDA results, dedup logic.
- Splitting A from B means each gets its own Gate review + bundle measurement, lowering integration risk.

### F.1 — products table has no `fdcId` column (load-bearing for backfill)

**Surprise:** I expected products to carry the originating USDA `fdcId`. It doesn't. Products schema is "macros + brand + name + unit" with no provenance ID.

**Implication for Gamma A backfill:**
- Each of the 33 existing products needs a name-search round-trip to USDA to recover its fdcId
- Then a second hop to `/v1/food/{fdcId}` for foodPortions
- 33 × 2 = 66 USDA API hits for the full backfill — well within rate limits (USDA's free key allows 1000/hour)

**Recommended:** during the Gamma A backfill, ALSO add `fdcId` to products as an optional column. Future product creations stash the fdcId at insert time, eliminating the name-search hop on subsequent backfills.

Migration shape:
```sql
ALTER TABLE products
  ADD COLUMN unit_alternatives jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN fdc_id integer NULL,
  ADD COLUMN unit_alternatives_updated_at timestamptz NULL;
```

`unit_alternatives_updated_at` is for cache-invalidation (re-fetch from USDA every N days if needed). Optional; can defer if scope creep.

### F.2 — OFF integration is BARCODE-ONLY today

V20's brief framed Gamma B as "OFF integration (folds in Brick J)". My read of the existing code: the LLM tool's `offLookupByUpc(upc)` only handles barcode lookups. **No text search to OFF exists.** Brick J's text-search OFF integration was scoped but never implemented.

**Implication for Gamma B:**
- New backend function `offTextSearch(query, brand)` calling `https://world.openfoodfacts.org/cgi/search.pl?search_terms=...&search_simple=1&action=process&json=1`
- Per-result mapping to products schema (different shape than the per-100g/per-serving USDA mapping)
- Ranking logic: OFF for branded text matches > USDA for generic
- Bulk-cache pattern (write to products table) vs runtime-query pattern (the existing barcode lookup)

V20's framing of "bulk-import (cache OFF data into our products table) rather than runtime-query OFF every parse" — confirmed correct architecturally. The barcode integration that exists today STAYS at parse time; the new text search runs at admin/bulk time.

### F.3 — USDA food_portions has variable shape

Empirical probe (Margarita example):
- Some entries have `measureUnit.name = 'undetermined'` with the human-readable label in `portionDescription`
- Some have `portionDescription = 'Quantity not specified'` — must filter
- Some entries have `gramWeight` of 0 — must filter

Parser needs:
1. Skip rows where `portionDescription = 'Quantity not specified'`
2. Skip rows where `gramWeight = 0`
3. Use `measureUnit.name` if present and != 'undetermined', else use `portionDescription` (cleaned of leading "1 ")
4. Normalize unit names (e.g., "fl oz" → "floz" or "fluid_ounce" — pick a canonical form)

**Coverage estimate:** Survey (FNDDS) entries reliably have 2-4 portions. Branded entries usually have 1 (just the labeled serving). SR Legacy entries are mixed. For Luke's 33 products (mostly USDA-sourced), expect ~70-90% to return at least one usable portion. Foods with zero usable portions fall through to the LLM-fill path (Gamma C).

### F.4 — Bulk-add UI scope (P0.5 V20 lean validated)

**Confirmed:** dedicated `/admin/pantry` route, Luke-only via existing pantheon_session cookie auth (single-tenant, no new gating needed), MVP is paste-list + search-and-pick + bulk INSERT.

Recommended MVP shape:
1. Textarea for pasted food names (one per line)
2. For each name, fetch top-3 candidates from OFF + USDA (parallel via Gamma B's text search + existing USDA search)
3. Render a pick-one UI per row with the candidates' name + brand + per-serving macros
4. Luke clicks one, INSERT into products with full unit_alternatives + fdc_id stashed
5. Skip rows with no acceptable match (LLM-fill batch runs separately for those)

CSV import + custom-food entry are polish. Defer to "Gamma E.2" if needed.

### F.5 — Carry-forward: Brick Beta candidates from Alpha.6 closeout

Alpha.6 §F.1 (variant-ambiguity gap-gate), §F.3 (compound-name segmenter), §F.4 (McDonald's Tier 1 verification) — all matcher-side issues that **Brick Beta** addresses, NOT Gamma. Track as Beta inputs.

Beta's scope grows: matcher upgrade + variant-merge + compound-name segmenter expansion. Gamma's data-layer work makes Beta higher-value (matcher quality matters more when there's more data to differentiate).

### F.6 — Gamma is forward-compatible per Alpha.6 schema-code memory rule

All Gamma schema migrations are additive (`ADD COLUMN` with default). Safe to apply ahead of code per the locked memory rule. **But push discipline still recommended:** apply migration in the same Gate 2 push as the matcher code that reads the new column. Cleaner state.

---

## §3 — Asks / greenlight requests

**A.1 — V20 confirms refined sequencing.** A→B→bundle(C/D/E) with the F.2 / F.3 scope expansions noted. Total 22-33 turns. Awaiting confirmation.

**A.2 — V20 confirms `fdc_id` column addition during Gamma A backfill.** Adding fdc_id alongside unit_alternatives in migration 019 is +1 line of SQL; eliminates the name-search hop on future re-fetches. Awaiting greenlight.

**A.3 — V20 confirms source ranking refinement.** `user_corrected > OFF > USDA(FNDDS/Branded) > USDA(SR Legacy) > llm_estimated`. Promotes user_corrected above USDA per the intent-driven argument. Awaiting V20 call.

**A.4 — V20 confirms unit_alternatives placement.** Products column + saved_meals.foods_json[i] shape extension. NO per-user override table at this scale. Awaiting confirmation.

**A.5 — V20 confirms backfill strategy is option (a) one-time script.** 33 products, 66 USDA hops, runs in <1 min. Awaiting greenlight (this lands during Gamma A EXECUTE).

**A.6 — V20 confirms /admin/pantry route + Luke-only auth.** No new auth gating; single-tenant pantheon_session cookie suffices. Awaiting confirmation.

**A.7 — Greenlight Gamma A EXECUTE.** Phase 0 for Gamma A is essentially done; once V20 confirms the architectural calls (A.1-A.6), I can execute:

```
Gamma A.1 — migration 019_unit_alternatives.sql
Gamma A.2 — lib/usda/portions.ts (new module — usdaFetchPortions(fdcId), portionToUnitAlternative(p))
Gamma A.3 — lib/usda/backfill.ts + scripts/backfill-product-portions.ts
Gamma A.4 — Run backfill, capture coverage stats
Gamma A.5 — Matcher hookup (search-food-database returns unit_alternatives in candidate shape; saved_meal/product mappers in search-user-library.ts also include them)
Gamma A.6 — Type updates (FoodItem gains unit_alternatives?: UnitAlternative[])
Gamma A.7 — Bundle smoke + Gate 1 handoff
```

Estimate 6-8 turns for Gamma A.

---

## §4 — Plan re-evaluation

V20's framing was substantially right. The two refinements (OFF text search is new code; products lacks fdcId so backfill needs name-search) shift Gamma B's estimate up by 2-3 turns and add 1 column to migration 019. Neither changes the brick's overall shape.

Master doc revisions queued for V20-side fold (per carry-forwards section): Beta/Gamma sequence ALREADY swapped per audit; Gamma C/D/E bundle clarification could land in the next master-doc revision pass. Not blocking.

After Gamma A ships clean, V20 fires Gamma B brief. Phase 0 for Gamma B will need additional recon on OFF text-search behavior + ranking semantics; defer until then.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_GAMMA_PHASE0_1.md
