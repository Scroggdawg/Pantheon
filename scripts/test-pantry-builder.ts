import assert from 'node:assert/strict'

import type { FoodIdentityDocument } from '../lib/claude/food-identity'
import { searchFoodIdentityDocuments } from '../lib/claude/food-identity'
import { normalizeFoodText } from '../lib/pantry-builder/normalize'
import { classifyPantryCandidate } from '../lib/pantry-builder/risk'
import type { ExistingProductSummary, PantryCandidate, PantryProfile } from '../lib/pantry-builder/types'
import { resolveUnitGrams, withStandardUnits } from '../lib/pantry-builder/units'
import { candidateFromUsdaFood } from '../lib/pantry-builder/usda-core'

function candidate(overrides: Partial<PantryCandidate> = {}): PantryCandidate {
  const base: PantryCandidate = {
    candidate_key: 'usda:Foundation:123:whole_foods',
    target_query: 'strawberries',
    normalized_name: 'strawberries raw',
    display_name: 'Strawberries, raw',
    source_kind: 'usda',
    source_dataset: 'Foundation',
    external_id: '123',
    source_release: 'test',
    category: 'whole_foods',
    proposed_product: {
      name: 'Strawberries, raw',
      brand: null,
      unit: '100 g',
      serving_size_g: 100,
      calories_per_serving: 32,
      protein_g_per_serving: 0.7,
      fat_g_per_serving: 0.3,
      carbs_g_per_serving: 7.7,
      fiber_g_per_serving: 2,
      fulfillment_source: 'manual',
      barcode: null,
      product_url: null,
      notes: null,
      tracks_inventory: false,
      servings_per_unit: null,
      unit_alternatives: withStandardUnits([], { strawberry: 12 }, 'strawberries'),
      fdc_id: 123,
      unit_alternatives_updated_at: new Date(0).toISOString(),
      provenance_source_kind: 'usda',
      provenance_dataset: 'Foundation',
      provenance_external_id: '123',
      provenance_release: 'test',
      import_confidence: 'high',
      canonical_category: 'whole_foods',
    },
    aliases: ['strawberry', 'strawberries'],
    rejected_aliases: [],
    unit_alternatives: withStandardUnits([], { strawberry: 12 }, 'strawberries'),
    risk_score: 0,
    decision: 'auto_approved',
    reasons: [],
  }
  return {
    ...base,
    ...overrides,
    proposed_product: {
      ...base.proposed_product,
      ...overrides.proposed_product,
    },
    unit_alternatives: overrides.unit_alternatives ?? overrides.proposed_product?.unit_alternatives ?? base.unit_alternatives,
  }
}

function identityDoc(overrides: Partial<FoodIdentityDocument>): FoodIdentityDocument {
  return {
    identity_id: 'product:test',
    identity_type: 'product',
    canonical_source_ref: 'lib:product:test',
    display_name: 'Test Food',
    brand: null,
    restaurant: null,
    aliases: [],
    rejected_aliases: [],
    search_text: 'Test Food',
    identity_tokens: ['test', 'food'],
    context_tokens: [],
    macros_per_serving: {
      calories: 100,
      protein_g: 1,
      carbs_g: 10,
      fat_g: 1,
    },
    serving: { qty: 1, unit: 'serving', grams: 100 },
    unit_alternatives: [],
    components: [],
    authority: 'product',
    ranking_signals: {
      is_favorite: false,
      times_logged: 0,
      last_logged_at: null,
      hourly_weight: 0,
      source_priority: 3,
      correction_weight: 0,
    },
    safety: {
      generic_overmatch_guard: true,
      requires_review: false,
      can_auto_commit: true,
      warnings: [],
    },
    index_version: 1,
    updated_at: null,
    ...overrides,
  }
}

function testUnits() {
  const units = withStandardUnits(
    [{ unit: 'cup', grams: 152, source: 'usda', confidence: 'high' }],
    { strawberry: 12 },
    'strawberries',
  )
  assert.equal(resolveUnitGrams('g', units)?.grams, 1)
  assert.equal(resolveUnitGrams('grams', units)?.grams, 1)
  assert.equal(resolveUnitGrams('oz', units)?.grams, 28.35)
  assert.equal(resolveUnitGrams('cup', units)?.grams, 152)
  assert.equal(resolveUnitGrams('strawberries', units)?.grams, 12)
  assert.equal(resolveUnitGrams('dragon', units), null)
}

function testRisk() {
  const existing: ExistingProductSummary[] = []
  assert.equal(classifyPantryCandidate(candidate(), existing, []).decision, 'auto_approved')

  assert.equal(
    classifyPantryCandidate(
      candidate({
        display_name: 'Chipotle Chicken',
        normalized_name: normalizeFoodText('Chipotle Chicken'),
        category: 'prepared_common',
      }),
      existing,
      ['chipotle'],
    ).decision,
    'review_required',
  )

  assert.equal(
    classifyPantryCandidate(candidate(), [{ id: '1', name: 'Strawberries, raw', brand: null, barcode: null }], []).decision,
    'rejected',
  )
  assert.equal(
    classifyPantryCandidate(
      candidate({
        target_query: 'cilantro',
        display_name: 'Coriander (cilantro) leaves, raw',
        aliases: ['cilantro', 'coriander cilantro leaves raw'],
      }),
      [{ id: '1', name: 'Cilantro, raw', brand: null, barcode: null }],
      [],
    ).decision,
    'rejected',
  )

  const badMacroCandidate = candidate()
  badMacroCandidate.proposed_product.calories_per_serving = 0
  assert.equal(classifyPantryCandidate(badMacroCandidate, existing, []).decision, 'rejected')

  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'zucchini', display_name: 'Zucchini, pickled' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'mint', display_name: 'Spearmint, dried' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'pinto beans', display_name: 'Beans, pinto, sprouted, raw' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'jasmine rice cooked', display_name: 'Flour, rice, brown' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'apple', display_name: 'Strudel, apple' }), existing, []).decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'apple', display_name: 'Croissants, apple' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'orange', display_name: 'Orange peel, raw' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'salmon cooked', display_name: 'Salmon nuggets, cooked' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'salmon cooked', display_name: 'Fish, salmon, sockeye, raw' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'shrimp cooked', display_name: 'Shrimp scampi' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'rotisserie chicken', display_name: 'Chicken breast, rotisserie, skin eaten' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'rotisserie chicken', display_name: 'Chicken drumstick, rotisserie, skin not eaten' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'salmon cooked', display_name: 'Salmon salad' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'avocado', display_name: 'Avocados, raw, Florida' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'flour tortilla', display_name: 'Tortillas, ready-to-bake or -fry, flour, refrigerated' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'corn tortilla', display_name: 'Snacks, tortilla chips, unsalted, white corn' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'bacon cooked', display_name: 'Beef, bacon, cooked' }), existing, [])
      .decision,
    'review_required',
  )
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'mint', display_name: 'Mint julep' }), existing, []).decision,
    'review_required',
  )
  const brandedCandidate = candidate()
  brandedCandidate.proposed_product.brand = 'Example Brand'
  assert.equal(classifyPantryCandidate(brandedCandidate, existing, []).decision, 'review_required')
  assert.equal(
    classifyPantryCandidate(candidate({ target_query: 'apple', display_name: 'Apples, fuji, with skin, raw' }), existing, [])
      .decision,
    'auto_approved',
  )
}

function testIdentityLearning() {
  const rebbl = identityDoc({
    display_name: 'REBBL Hazelnut Coffee Elixir',
    search_text: 'REBBL Hazelnut Coffee Elixir',
    identity_tokens: ['rebbl', 'hazelnut', 'coffee', 'elixir'],
    rejected_aliases: ['coffee'],
  })
  assert.equal(searchFoodIdentityDocuments('coffee', [rebbl], { minScore: 0.5 }).length, 0)

  const dosEquis = identityDoc({
    identity_id: 'product:dos-equis',
    canonical_source_ref: 'lib:product:dos-equis',
    display_name: 'Dos Equis Lager Especial 16 oz',
    aliases: ['dos xx', 'dos equis'],
    search_text: 'Dos Equis Lager Especial 16 oz dos xx dos equis',
    identity_tokens: ['dos', 'equis', 'lager', 'especial', '16', 'oz', 'xx'],
  })
  const [hit] = searchFoodIdentityDocuments('dos xx', [dosEquis], { minScore: 0.5 })
  assert.equal(hit?.document.canonical_source_ref, 'lib:product:dos-equis')
  assert.equal(hit?.outcome, 'resolved_high')
}

function testUsdaCandidateReviewReasons() {
  const profile: PantryProfile = {
    version: 1,
    name: 'Test',
    target_count: 1,
    luke_food_profile: {
      core_cuisines: [],
      restaurants: [],
      protein_anchors: [],
      staple_categories: [],
    },
    already_covered: [],
    allocation: {
      whole_foods: 1,
      proteins: 0,
      cuisine_staples: 0,
      sauces_condiments_oils: 0,
      breakfast_snacks: 0,
      beverages: 0,
      prepared_common: 0,
      coverage_buffer: 0,
    },
    categories: {
      whole_foods: [],
      proteins: [],
      cuisine_staples: [],
      sauces_condiments_oils: [],
      breakfast_snacks: [],
      beverages: [],
      prepared_common: [],
      coverage_buffer: [],
    },
    count_unit_grams: {},
    review_only_patterns: [],
  }

  const riceNoodles = candidateFromUsdaFood(
    { query: 'jasmine rice cooked', category: 'whole_foods', reviewOnly: false },
    {
      fdcId: 1,
      description: 'Rice noodles, cooked',
      dataType: 'SR Legacy',
      foodNutrients: [
        { nutrientId: 1008, value: 108 },
        { nutrientId: 1003, value: 1.8 },
        { nutrientId: 1005, value: 24 },
        { nutrientId: 1004, value: 0.2 },
      ],
    },
    profile,
    [],
    'test',
  )
  assert.equal(riceNoodles?.decision, 'review_required')
  assert.ok(riceNoodles?.reasons.includes('low_target_token_coverage_50'))

  const brandLikeRice = candidateFromUsdaFood(
    { query: 'brown rice cooked', category: 'whole_foods', reviewOnly: false },
    {
      fdcId: 2,
      description: 'Rice, brown, parboiled, cooked, UNCLE BENS',
      dataType: 'Survey (FNDDS)',
      foodNutrients: [
        { nutrientId: 1008, value: 123 },
        { nutrientId: 1003, value: 2.7 },
        { nutrientId: 1005, value: 25.6 },
        { nutrientId: 1004, value: 1 },
      ],
    },
    profile,
    [],
    'test',
  )
  assert.equal(brandLikeRice?.decision, 'review_required')
  assert.ok(brandLikeRice?.reasons.includes('brand_like_name_token_review_required'))
}

testUnits()
testRisk()
testIdentityLearning()
testUsdaCandidateReviewReasons()

console.log('test-pantry-builder: ok')
