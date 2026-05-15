# Lightning Parse Canonical Identity Spec

Date: 2026-05-14
Status: LP-1 contract. This is the source document for the search-index proof in LP-2.
Scope: Web parse-meal identity, Pantheon Plate, Provisions recipes/plans, Progress scoring inputs.

Companions:

- `docs/MATCHER_CONSTITUTION.md`
- `docs/MACROFACTOR_LESSONS_DOCTRINE.md`
- `scripts/test-matcher-invariants.ts`

## 1. Why This Exists

Pantheon cannot get to reliable sub-5-second parsing by making the LLM guess faster.

The fast path needs a single searchable identity layer that can answer:

- What food did Luke mean?
- Is that food a durable thing Pantheon can reuse?
- What serving and unit did the utterance imply?
- Is the result safe to auto-stage, or does Plate need to ask?
- Which explicit correction should the system learn from next time?

Today that identity is spread across `saved_meals`, `products`, `recipes`, `food_log_entries`, `hourly_go_tos`, brand aliases, and `unit_alternatives`. LP-1 defines the read-model that future search work should target before LP-2 chooses the engine.

## 2. Current Source Inventory

### Canonical Sources

These are durable enough to survive as final parser identity:

- `saved_meals`: Luke-approved recurring meals and single-food shortcuts. Some are true composites, some are effectively favorites.
- `products`: pantry/catalog rows. Includes branded items, barcode fields, serving sizes, per-serving macros, and `unit_alternatives`.
- `recipes`: Provisions recipe rows. Not yet in the live matcher, but they must become first-class identities before Provisions and Plate fully connect.
- Future barcode/OFF/USDA-backed pantry rows: products should absorb these where possible instead of leaving parser output as external-only identities.

### Evidence Sources

These can influence ranking or review state, but should not win final identity when a canonical exists:

- `hourly_go_tos`: time-of-day recall. Useful for ranking and fallback coverage, not a durable entity.
- `food_log_entries`: historical observations. Useful for learning, but may contain stale parser bugs.
- `brand-voice-aliases`: pronunciation and brand shorthand. Identity-preserving only.
- `unit_alternatives`: serving conversion evidence. Attached to identities, not separate searchable foods.
- Parse response cache rows: latency optimization, not identity authority.

## 3. Canonical Food Identity Document

LP-2 should be able to construct this shape from current tables without a production migration. A later migration may persist it if the proof shows the index earns its keep.

```ts
type FoodIdentityType =
  | 'saved_meal'
  | 'product'
  | 'recipe'
  | 'barcode_product'
  | 'external_food'
  | 'history_signal'

type FoodIdentityAuthority =
  | 'user_corrected'
  | 'saved_meal'
  | 'recipe'
  | 'product'
  | 'barcode'
  | 'off'
  | 'usda'
  | 'llm_estimated'
  | 'history_signal'

interface FoodIdentityDocument {
  identity_id: string
  identity_type: FoodIdentityType
  canonical_source_ref: string | null

  display_name: string
  brand: string | null
  restaurant: string | null
  aliases: string[]
  rejected_aliases: string[]

  search_text: string
  identity_tokens: string[]
  context_tokens: string[]

  macros_per_serving: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  } | null

  serving: {
    qty: number
    unit: string
    grams: number | null
  } | null

  unit_alternatives: Array<{
    unit: string
    grams: number
    source: 'usda' | 'off' | 'user_corrected' | 'llm_estimated'
    confidence: 'high' | 'medium' | 'low'
  }>

  components: Array<{
    name: string
    qty: number
    unit: string
    source_ref: string | null
  }>

  authority: FoodIdentityAuthority
  ranking_signals: {
    is_favorite: boolean
    times_logged: number
    last_logged_at: string | null
    hourly_weight: number
    source_priority: number
    correction_weight: number
  }

  safety: {
    generic_overmatch_guard: boolean
    requires_review: boolean
    can_auto_commit: boolean
    warnings: string[]
  }

  index_version: number
  updated_at: string | null
}
```

## 4. Identity IDs And Source Refs

`identity_id` is the stable index key. `canonical_source_ref` is what parser output should persist when known.

| Source | identity_id | canonical_source_ref |
| --- | --- | --- |
| Saved meal | `saved_meal:<uuid>` | `lib:saved_meal:<uuid>` |
| Product | `product:<uuid>` | `lib:product:<uuid>` |
| Recipe | `recipe:<uuid>` | `recipe:<uuid>` |
| Barcode product | `product:<uuid>` once saved | `lib:product:<uuid>` |
| USDA-only fallback | `external:usda:<fdc_id>` | `usda:<fdc_id>` |
| OFF-only fallback | `external:off:<barcode_or_id>` | `off:<barcode_or_id>` |
| Hourly/history signal | `history:<hash>` | `null` unless it points to a canonical `lib:*` ref |

Rules:

1. Do not persist `lib:hourly_go_to:*` wrapper IDs as final food identity.
2. If a history signal points to a canonical `lib:*`, the canonical document survives.
3. If a history signal has the same normalized name as a canonical, the canonical document survives unless ambiguity is intentional and surfaced to Plate.
4. External USDA/OFF refs are acceptable only when there is no saved local product yet. They should be candidates for pantry promotion, not the long-term happy path.

## 5. Authority Order

When two documents describe the same food, the resolver should prefer the strongest explicit source.

1. User-corrected product/saved-meal/recipe data.
2. Saved meal or recipe created/accepted by Luke.
3. Product/barcode row in the pantry catalog.
4. OFF/USDA-backed external hit.
5. LLM-estimated food with explicit review.
6. History/hourly signal.

This order does not mean a lower source can never appear. It means a lower source cannot silently outrank a higher source for the same identity.

## 6. Alias Semantics

Aliases are identity-preserving search aids, not free guesses.

Allowed:

- Pronunciation variants: `dos xx` -> `dos equis`.
- Restaurant shorthand when the utterance contains restaurant context.
- Product shorthand after Luke explicitly accepts it.

Not allowed:

- `coffee` -> `REBBL Hazelnut Coffee Elixir`.
- `margarita` -> one arbitrary generic margarita without variant handling.
- `chips with guacamole` -> one fused saved meal when the utterance names two foods.

`rejected_aliases` should exist in the identity contract even before storage exists. It gives future correction learning somewhere to put "do not do that again" signals.

## 7. Resolver Outcomes

The search layer should not return only "a best match." It should classify the result into one of five outcomes:

```ts
type ResolverOutcome =
  | 'resolved_high'
  | 'needs_choice'
  | 'needs_review'
  | 'estimated'
  | 'fallback_required'
```

- `resolved_high`: one canonical identity clears score, gap, authority, and safety gates.
- `needs_choice`: multiple plausible canonicals are close enough that Plate should show choices.
- `needs_review`: the identity is plausible but serving, brand, or decomposition is uncertain.
- `estimated`: no canonical exists, but a reasonable macro estimate can be staged with an estimate pill.
- `fallback_required`: the local/search layer cannot responsibly answer; call the LLM or database fallback.

## 8. Plate Contract

Plate should receive staged food items that preserve identity and uncertainty separately.

Minimum staged item fields:

```ts
interface StagedPlateItem {
  name: string
  source_ref: string | null
  identity_id: string | null
  resolver_outcome: ResolverOutcome
  qty: number
  unit: string
  unit_grams: number | null
  macros: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
  confidence_label: 'high' | 'medium' | 'low'
  review_pill: 'HIGH' | 'CHOOSE' | 'REVIEW' | 'ESTIMATE'
  warnings: string[]
  candidates: Array<{
    identity_id: string
    name: string
    source_ref: string | null
    reason: string
  }>
}
```

This is the bridge between fast parsing and real accuracy. If the resolver is unsure, it should make the Plate fast to correct rather than pretending.

## 9. Provisions And Progress Contract

Provisions needs recipes and planned meals to become canonical identities, not parser side effects.

- A planned `recipe:<uuid>` should be searchable when Luke logs it later.
- A cooked recipe portion should preserve recipe identity plus portion math.
- Planned product rows should share the same product identity as live logging.

Progress needs stable identity because scoring and trends will eventually answer questions like:

- Are calories accurate enough to adjust targets?
- Is food quality improving?
- Are recurring meals consistent?
- Did a correction change future logs?

Progress should consume canonical source refs first and treat temporary/history-only identities as lower confidence.

## 10. LP-2 Search Proof Requirements

The LP-2 search proof should compare candidate engines against this document shape, not against raw table rows.

Minimum proof harness:

- Build identity documents from `saved_meals`, `products`, `recipes`, and `hourly_go_tos`.
- Search the LP-0 golden utterances and current matcher invariant examples.
- Report p50/p95/p99 search latency separate from full parse latency.
- Report outcome classification, not only top score.
- Prove generic-overmatch guards still hold.
- Prove hourly/history signals boost recall without becoming final identity.
- Prove `chips with guacamole` and `churros with chocolate sauce` decompose/stage as multiple foods or fall through, not fused wrong-confidence matches.

Candidate engines:

- Current Postgres/Supabase queries plus in-memory scoring.
- Postgres `pg_trgm` or full-text proof.
- Typesense proof without activating paid/production infra.

## 11. Migration Plan

LP-1 itself is spec-only.

Likely later steps:

1. Create a pure read-model builder in TypeScript.
2. Add helper tests for document construction and authority ordering.
3. Run LP-2 engine proof against generated documents.
4. If needed, add additive storage for aliases/rejected aliases/index metadata.
5. If needed, persist an identity index table or external search index.

Any production schema migration, data backfill, or search infrastructure activation remains a protected action.

## 12. Non-Negotiables

- Speed cannot come from confident wrongness.
- History can boost but not rule.
- Canonical source refs are the long-term data spine.
- Plate is the recovery layer, not an excuse for sloppy matching.
- A new matcher pass must either enforce this spec or remove older complexity.

