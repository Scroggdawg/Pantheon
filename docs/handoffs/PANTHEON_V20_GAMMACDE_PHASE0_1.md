# Op FASTRAK Brick Gamma C/D/E — Phase 0 recon

**Date:** 2026-05-08
**From:** Terminal Claude
**To:** V20 Chat Claude
**Mode:** Phase 0 only. No code, no commits, no migrations. Empirical recon + sequencing recommendation + LLM-fill prompt sketch.

---

## §0 — Status

Recon complete. **One sequencing refinement, one architectural surprise, one prompt sketch.**

**Sequencing recommendation (P0.1):** split — **Gamma C → Gamma E → Gamma D** as separate sub-bricks rather than bundled. Reasoning: C and E are independently shippable + each delivers immediate value; D has no consumer yet (Brick Delta isn't built) and is cleanest to scope alongside Delta's Phase 0.

**Architectural surprise (P0.4):** existing `FoodEntryEditModal` writes back to `food_log_entries.foods_json` (not `saved_meals.foods_json`). Gamma D's user-correction targets a DIFFERENT table than where existing edits land. New endpoint required (V20's option (a)) — extending the existing edit flow doesn't fit cleanly.

**LLM-fill prompt sketched** (P0.2) with 6-example few-shot, claude-haiku-4-5-20251001 model, capped confidence at `medium`. Eval methodology proposed (15-20 foods, ±50% gram-weight tolerance vs USDA ground truth).

---

## §1 — Verbatim source for files referenced

| File | Lines | What it tells us |
|---|---|---|
| `proxy.ts:21-56` | NATIVE_ROUTES list, cookie auth at line 59 | Single-tenant cookie auth (`pantheon_session=1`); `/admin/*` would fall through to cookie check — sufficient gating per Phase 0 §P0.6 |
| `lib/claude/recipe.ts:93-95` | Anthropic SDK pattern | `client.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, system, messages })`. Use claude-haiku-4-5-20251001 for Gamma C (faster + cheaper for JSON-shaped output) |
| `lib/claude/claude.ts:14` | shared client | `const client = new Anthropic()` — already exists; reuse |
| `components/dashboard/FoodEntryEditModal.tsx:142` | edit save target | `supabase.from('food_log_entries').update({ foods_json: editFoods, ... }).eq('id', entry.id)`. Writes to `food_log_entries`, NOT `saved_meals`. **Gamma D needs a new endpoint** |
| `app/provisions/` | existing admin-ish page | Single `page.tsx`. Provisions surface manages buy-list / inventory; NOT pantry/library admin. Gamma E lives at `app/admin/pantry/` (new route, no overlap) |
| `lib/claude/tools/report-food-items.ts:10` | Haiku citation | comment references `claude-haiku-4-5-20251001` already; consistent model choice for Gamma C |
| `app/api/saved_meals/heart/route.ts` | reference shape | Sub-fix C.1's POST/DELETE pattern. Gamma D's `/api/saved_meals/foods/correct` follows same shape |
| Live REST | 6 zero-coverage products | Dried Goji Berries, Eggs - Large, Magic Spoon Strawberry, Creatine, Quaker Oats, REBBL Coffee Elixir |

---

## §2 — Eight P0 answers

### P0.1 — Bundle vs split sequencing (RECOMMEND SPLIT: C → E → D)

**Recommend three separate sub-bricks** with their own Gate 1 reviews:

1. **Gamma C ships first (4-5 turns):** smallest scope, closes the 6-product data-coverage story, low risk. Ship value: 27/33 → ~33/33 = ~100% library coverage (modulo LLM-fill quality).
2. **Gamma E ships second (5-7 turns):** depends on Gamma C (uses LLM-fill helper as the fall-through option in the bulk-add picker). Ship value: Luke gets an operational tool to grow library aggressively going forward.
3. **Gamma D ships LAST or DEFERRED to Brick Delta (2-3 turns):** has no consumer yet. Brick Delta builds the Delta editor UI that calls Gamma D's endpoint. Scoping Gamma D when Delta scopes lets the API contract evolve with Delta's UI needs.

**Why split over V20's bundle:**
- C and E are independently shippable; bundling delays C's value behind D+E's longer arcs
- Per-sub-brick Gate 1 review surfaces issues earlier (Alpha.6 + Gamma A/B both proved this — multi-sub-brick Gate 1s tend to surface architectural issues that would have been caught earlier per-sub-brick)
- D has zero immediate consumer; deferring to Delta keeps the API contract negotiable

**Alternative V20 might prefer (option γ from V20's brief):** ship C + E together; defer D to Delta. Same end state, slightly fewer Gate 1 cycles. I'm fine with either; V20's call.

**Estimated total:** 11-15 turns across the three sub-bricks (slightly tighter than V20's 11-17). C alone: 4-5; E alone: 5-7; D alone: 2-3.

### P0.2 — LLM-fill prompt sketch (per V20 ask)

**Model:** `claude-haiku-4-5-20251001` — fast (~1-2s per call), low cost (~$0.001/call), good for structured JSON output. Pattern matches existing `lib/claude/recipe.ts` invocation shape (`client.messages.create({ model, max_tokens, system, messages })`).

**Few-shot prompt structure:**

```
SYSTEM:
You are Pantheon's unit-conversion assistant. Given a food name + brand,
output plausible unit-to-grams conversions for that food.

Output schema (JSON ONLY, no preamble, no markdown fences):
[
  {"unit": "<canonical lowercase unit name>", "grams": <number>, "confidence": "<low|medium>"},
  ...
]

Rules:
- Output 1-4 entries per food. More entries for foods with multiple
  common units (e.g., "1 banana" + "1 cup mashed" + "1 slice");
  fewer for foods with one canonical serving (e.g., "1 bar").
- Use lowercase unit names. Examples: "cup", "tbsp", "tsp", "fl oz",
  "bar", "scoop", "egg", "banana", "slice", "container", "bottle".
- For supplements/powders, "scoop" is canonical; check the brand
  for typical scoop size.
- Confidence: "medium" for foods with established conventions (eggs,
  bananas, common pantry items); "low" for branded products where
  exact serving sizes vary (Magic Spoon SKUs, niche brands, supplement
  scoop sizes).
- If you have NO confidence in any unit (truly unknown food, ambiguous
  name), return [] (empty array).
- Never output "high" confidence. The user's own correction overrides
  always rank above your output regardless.

Few-shot examples:
1. "Bananas" (brand: null) → [
     {"unit": "banana", "grams": 118, "confidence": "medium"},
     {"unit": "cup", "grams": 150, "confidence": "medium"},
     {"unit": "slice", "grams": 6, "confidence": "low"}
   ]
2. "Eggs - Large" (brand: null) → [
     {"unit": "egg", "grams": 50, "confidence": "medium"}
   ]
3. "Magic Spoon Cereal - Strawberry" (brand: Magic Spoon) → [
     {"unit": "cup", "grams": 35, "confidence": "low"}
   ]
4. "Quaker Rolled Oats" (brand: Quaker) → [
     {"unit": "cup", "grams": 80, "confidence": "low"},
     {"unit": "scoop", "grams": 40, "confidence": "low"}
   ]
5. "Manuka Honey" (brand: null) → [
     {"unit": "tbsp", "grams": 21, "confidence": "medium"},
     {"unit": "tsp", "grams": 7, "confidence": "medium"}
   ]
6. "Random unknown XYZ" (brand: null) → []

USER:
Produce JSON for: <food_name> (brand: <brand_or_null>)
```

**Caller signature (lib/llm-fill/portions.ts):**

```typescript
export async function llmFillPortions(
  name: string,
  brand: string | null,
): Promise<UnitAlternative[]>
```

Post-processing:
1. Parse JSON from response.content[0].text
2. Validate shape (array of {unit: string, grams: number, confidence: 'low'|'medium'})
3. Force `source: 'llm_estimated'` on every entry (LLM doesn't include source field)
4. Cap confidence at `medium` (defensive — LLM should never set 'high', but enforce server-side)
5. Return [] on parse failure (caller falls through to "skip; hand-resolve" path)

### P0.3 — LLM-fill eval methodology (per V20 ask)

**Eval set composition (15-20 foods spanning categories):**

| Category | Examples | Ground truth source |
|---|---|---|
| Produce (5) | Bananas, Strawberries, Apple, Bell Peppers, Avocado | USDA Foundation/FNDDS |
| Generic packaged (5) | Eggs, Cottage Cheese, Yogurt, Oats, Milk | USDA Survey |
| Branded packaged (5) | Yasso bar, Mott's Applesauce, Magic Spoon, Quaker Oats, Cheerios | OFF or USDA Branded |
| Supplements (3) | Whey protein, Creatine powder, Multivitamin | LLM-only (no USDA ground truth) |
| Beverages (2) | Coconut water, Coffee | USDA + OFF |

**Pass/fail criteria per food:**
- **PASS:** LLM returns 1+ entries; for foods with USDA ground truth, the most-relevant unit's grams are within ±50% of USDA value (e.g., USDA banana = 118g; LLM 80-180g is PASS).
- **FAIL:** No entries returned for a food with known portion data, OR grams off by >50%, OR returns "high" confidence (regression check).
- **EXEMPT:** Foods with no ground truth (supplements, niche brands) — manually inspect for plausibility; don't fail on these.

**Threshold to ship the prompt:** 80% pass on the 12 foods with ground truth (10/12). If <80%, iterate the prompt with corrected examples.

**Implementation:** small one-off script `scripts/eval-llm-fill.ts` that runs the prompt over the eval set + prints pass/fail + delta-from-USDA per case. Run during Gamma C EXECUTE before bulk-running on the 6 zero-coverage products.

### P0.4 — User-correction API surface (RECOMMEND new endpoint per V20 option (a))

**Architectural surprise:** the existing edit flow (`FoodEntryEditModal`) writes to `food_log_entries.foods_json`, NOT `saved_meals.foods_json`. V20's locked Gamma A architectural decision (A.3) places user-correction overrides on `saved_meals.foods_json[i].unit_alternatives` — a different table.

**Implication:** option (b) "extend existing edit flow" doesn't fit. The existing flow writes to `food_log_entries` for instance-level edits (Luke shrinks today's portion of eggs); Gamma D's correction is a CANONICAL update on the saved_meal (Luke's egg measurement is now reliably 60g, not 50g).

These are semantically different. Don't conflate.

**Recommended Gamma D endpoint:**

```
POST /api/saved_meals/foods/correct
Body: { user_id, saved_meal_id, food_index, unit, grams }
Response: {
  saved_meal_id, food_index,
  unit_alternatives: [...]  // updated array
}
```

Add to proxy.ts NATIVE_ROUTES (mirror Sub-fix C.1's `/api/saved_meals/heart` pattern). Behavior:
1. Look up saved_meals row by id, verify user_id
2. Read foods_json[food_index]; assert food_index < length
3. Read existing unit_alternatives (default [])
4. Append/replace `{unit, grams, source: 'user_corrected', confidence: 'high'}` (dedup on (unit, source) per Gamma B's mergeUnitAlternatives pattern)
5. Write back foods_json with updated entry
6. Bust response cache (Alpha.5 pattern — library state changed)

**Caller (Brick Delta):** when Luke saves a unit edit on a card whose food has source_ref = `lib:saved_meal:<uuid>`, Delta UI extracts saved_meal_id + food_index from the food's metadata + calls this endpoint.

**Limitation flagged for Brick Delta scope:** foods with source_ref pointing to products/USDA/null (i.e., not saved-meal-backed) can't have corrections persisted via Gamma D. Delta UI should either (a) disable correction-save on non-saved-meal foods OR (b) prompt Luke to "save as favorite first" via the existing heart endpoint, then correct. V20's call when Delta scopes.

### P0.5 — User-correction trigger semantics (RECOMMEND option 3 with refinement)

V20's option 3 (only persist when new unit is novel) is right baseline, but needs a refinement:

**Refined trigger:**
- If the (unit, grams) tuple already exists with `source: 'user_corrected'` → no-op (idempotent re-save)
- Otherwise → write `{unit, grams, source: 'user_corrected', confidence: 'high'}` (dedup-on-(unit,source) replaces, additive on novel units)

This handles:
- Novel unit (Luke logs "1 jumbo egg" — never seen before): new entry added
- Existing-unit gram-correction (Luke says "1 cup = 230g, not 217g" because his measurement says so): replaces the user_corrected entry for "cup", leaves USDA "cup=217g" entry intact
- Idempotent re-save (Luke clicks Save twice): no double entries

The (unit, source) dedup means USDA/OFF/LLM entries for the same unit COEXIST with the user_corrected entry. Downstream consumer (matcher) ranks by source priority — `user_corrected > OFF > USDA > llm_estimated`.

### P0.6 — Gamma E auth & scope

**Existing pantheon_session cookie auth sufficient.** proxy.ts cookie check at line 59 (`request.cookies.get('pantheon_session')?.value === '1'`) covers `/admin/pantry`. No additional gating needed for single-tenant Pantheon.

If multi-user becomes a concern post-FASTRAK: add a per-user role flag (`is_admin`) on users table + check in proxy. Out of scope for Gamma E.

### P0.7 — Gamma E component organization

**Recommended:** new route `app/admin/pantry/page.tsx`. Inline components for MVP (textarea + per-row candidate picker).

Rationale:
- Brick K (barcode scanner, post-FASTRAK) will reuse the candidate-picker pattern. Extract into `components/admin/CandidatePicker.tsx` THEN, when there's a second consumer.
- For Gamma E MVP, inline code keeps the diff small and the surface easy to review.
- Existing `app/provisions/page.tsx` is an inline-everything page with similar admin-shaped UX — same pattern.

### P0.8 — Migrations

**None expected, confirmed.** `unit_alternatives` column already exists from Gamma A's migration 019. saved_meals.foods_json[i] is a JSONB shape extension (no schema change). Gamma D's endpoint writes JSONB; no migration needed.

### P0.9 — Estimated turn count refinement

**Tightened to 11-15 turns** (V20: 11-17):

| Sub-brick | Turns | Notes |
|---|---|---|
| Gamma C | 4-5 | Phase 0 (P0.2 sketch) + lib/llm-fill/portions.ts (~80 lines) + eval-llm-fill.ts script + iterate prompt + backfill script + run on 6 + commit/push + handoff. |
| Gamma E | 5-7 | Phase 0 + admin/pantry route + textarea+picker UI + bulk INSERT logic + smoke (paste 3-5 names) + commit/push + handoff. |
| Gamma D | 2-3 | New endpoint (mirror heart pattern, ~120 lines) + curl smoke (per Sub-fix C.1 8-test pattern) + commit/push + handoff. |

Lower than V20's estimate because:
- Gamma C copies the Gamma A/B backfill harness pattern (mature)
- Gamma D's endpoint is a near-copy of Sub-fix C.1's heart endpoint shape
- Gamma E is the only fresh-architecture sub-brick; even there, Provisions page provides the inline-page UX pattern

### P0.10 — Bundle measurement timing

Per V20's brief: re-measure post-bundle. Acceptable.

Empirical reality from Gamma B Gate 1: Luke's `food_log_entries` dataset bottoms out at 10 replay candidates over the last 60 days. To get to a 20+ sample, Luke needs to log ~10+ more meals with full telemetry (~1-2 weeks of typical usage). Re-running replay-parse @ `--limit=20` then will give the tighter read V20's Gamma B A.6 refinement asked for.

---

## §3 — Architectural calls / judgments / flags

### F.1 — Existing edit flow writes to food_log_entries, NOT saved_meals

This is THE key surprise of this Phase 0. Existing FoodEntryEditModal (web) + edit-food/[id].tsx (native) save edits to `food_log_entries.foods_json` for instance-level editing. Gamma D's user-correction targets `saved_meals.foods_json[i].unit_alternatives` for canonical override.

**Two semantic models:** instance-level (food_log_entries) and canonical (saved_meals). They serve different purposes:
- Instance-level: "today's eggs were a small portion, just track it as 30g"
- Canonical: "my eggs are reliably 60g per serving going forward"

Brick Delta's UI must distinguish these. V20's Gamma D scope is canonical-only. Fine — surface to Brick Delta planning.

### F.2 — Gamma D requires a new endpoint, not extending existing flow

Per F.1's semantic distinction, V20's option (a) "new endpoint" is right. Option (b) "extend existing edit flow" would conflate the two semantic models. Recommend `POST /api/saved_meals/foods/correct` per Phase 0 §P0.4.

### F.3 — Generic-detection heuristic for Gamma C (per Gamma B carry-forward)

V20's brief mentioned a generic-detection heuristic. Per the LLM-fill prompt design (P0.2), I'd argue: route ALL the 6 zero-coverage products through LLM-fill regardless of generic-vs-branded. The prompt's confidence assignment ("medium" for generic conventions, "low" for branded SKUs) handles the quality differential within the output.

Empirically: Eggs - Large (generic) is exactly where LLM knowledge IS reliable (50g/egg is a well-known convention). Magic Spoon Strawberry (branded) is exactly where LLM knowledge ISN'T reliable (specific SKU details). Confidence label captures this.

Recommend: skip the upfront generic-detection filter; rely on confidence labels to distinguish quality post-fill. Simpler architecture, same end state.

### F.4 — Single-tenant /admin/pantry auth (P0.6 confirmed)

`pantheon_session=1` cookie is sufficient. Single-tenant means anyone authenticated = Luke = admin. Don't over-engineer. Future multi-user: add `is_admin` column + proxy check; out of scope.

### F.5 — Gamma C eval: 80% pass threshold

12 ground-truth foods × 80% = 10 must pass. Stricter than 70% (which feels too permissive for "ship the prompt"); looser than 90% (which would fail on small variance). Phase 0 to lock if V20 disagrees.

### F.6 — No disagreements with brief

V20's framing was substantively right. Two refinements (split sequencing, new endpoint over extend-existing) emerged from recon + are folded into asks below.

---

## §4 — Asks / greenlight requests

**A.1 — V20 confirms split sequencing C → E → (D deferred or last).** My recommendation. V20's option γ (C + E together, D deferred to Delta) is a fine alternative. Either works.

**A.2 — V20 reviews + confirms LLM-fill prompt sketch (P0.2).** 6-example few-shot, claude-haiku-4-5-20251001, output schema constrained to UnitAlternative shape. Surface refinements before EXECUTE.

**A.3 — V20 confirms eval methodology (P0.3).** 15-20 foods, ±50% gram-weight tolerance vs USDA, 80% pass threshold. Lock or iterate.

**A.4 — V20 confirms new endpoint for Gamma D (per F.1/F.2).** `/api/saved_meals/foods/correct` POST. Mirror Sub-fix C.1 heart-endpoint shape. NATIVE_ROUTES gate.

**A.5 — V20 confirms refined trigger semantics (P0.5).** Dedup-on-(unit, source); idempotent re-save; user_corrected coexists with USDA/OFF entries for the same unit.

**A.6 — V20 confirms /admin/pantry auth (P0.6 cookie-only) + component organization (P0.7 inline MVP).**

**A.7 — V20 confirms drop generic-detection heuristic (F.3).** Route all 6 through LLM-fill; rely on confidence labels for quality differentiation. Simpler than the upfront filter from Gamma B carry-forward.

**A.8 — Greenlight Gamma C EXECUTE.** Once A.1-A.7 are confirmed, EXECUTE proceeds on Gamma C (LLM-fill).

---

## §5 — Plan re-evaluation

V20's bundle framing was the entry point; Phase 0 recon points toward split as cleaner. C and E are independently valuable + shippable; D has no consumer.

Cumulative cost projection: **11-15 turns total** for the three sub-bricks. Compared to per-bundle-Gate-1, three Gate 1 reviews adds maybe 1-2 turns total. Worth it for cleaner per-sub-brick review.

After Gamma C ships: 33/33 product coverage (modulo 6 LLM-fill quality on edge cases). After Gamma E ships: Luke has the operational tool to grow library aggressively. After Gamma D ships (or deferred to Delta): Brick Delta can build its UI knowing the API surface is locked.

Brick Beta + Brick Delta + post-FASTRAK Brick K (barcode) all consume Gamma's data layer. Worth getting it right.

---

file:///Users/scrogdawg/BMF%20Headquarters/2026%20-%20THE%20NARRATIVE/26_09%20Pantheon/pantheon/PANTHEON_V20_GAMMACDE_PHASE0_1.md
