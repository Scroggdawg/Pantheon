import { proposeLearningFromPlateEdit } from '../lib/corrections/learning'
import type { FoodItem } from '../types/database'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function food(overrides: Partial<FoodItem>): FoodItem {
  return {
    name: 'Tortilla chips',
    qty: 1,
    unit: 'serving',
    calories: 140,
    protein_g: 2,
    carbs_g: 18,
    fat_g: 7,
    source: 'library',
    source_ref: 'lib:product:chips',
    match_confidence: { score: 0.9, label: 'high', warnings: [] },
    notes: null,
    ...overrides,
  }
}

const swap = proposeLearningFromPlateEdit({
  phrase: 'chips',
  before: food({
    name: 'Yasso Greek Yogurt Bar - Mint Chocolate Chip',
    source_ref: 'lib:product:yasso',
  }),
  after: food({
    name: 'Tortilla chips',
    source_ref: 'lib:product:chips',
  }),
})
assert(swap.length === 1, `expected one swap proposal, got ${swap.length}`)
assert(swap[0].type === 'identity_alias', `expected identity_alias, got ${swap[0].type}`)
assert(swap[0].rejected_source_ref === 'lib:product:yasso', 'expected rejected Yasso ref')
assert(swap[0].confidence === 'high', 'swap should be high confidence')

const quantity = proposeLearningFromPlateEdit({
  phrase: '20 chips',
  before: food({ qty: 1, unit: 'serving', calories: 140 }),
  after: food({ qty: 20, unit: 'chips', calories: 220 }),
})
assert(quantity.length === 1, `expected one quantity proposal, got ${quantity.length}`)
assert(quantity[0].type === 'unit_or_quantity_review', `expected unit review, got ${quantity[0].type}`)
assert(
  (quantity[0].payload.macro_delta as { calories: number }).calories === 80,
  'expected calorie delta to be captured',
)

const remove = proposeLearningFromPlateEdit({
  phrase: 'coffee',
  before: food({
    name: 'REBBL Hazelnut Coffee Elixir',
    source_ref: 'lib:product:rebbl',
  }),
  after: null,
})
assert(remove.length === 1, `expected one remove proposal, got ${remove.length}`)
assert(remove[0].type === 'identity_rejection', `expected rejection, got ${remove[0].type}`)
assert(remove[0].rejected_source_ref === 'lib:product:rebbl', 'expected rejected REBBL ref')

const addUnknown = proposeLearningFromPlateEdit({
  phrase: 'dos xx',
  before: null,
  after: food({
    name: 'Dos Equis 16 oz',
    source: 'llm_estimated',
    source_ref: null,
    match_confidence: { score: 0.45, label: 'low', warnings: [] },
  }),
})
assert(addUnknown.length === 1, `expected one unknown add proposal, got ${addUnknown.length}`)
assert(addUnknown[0].type === 'pantry_suggestion', `expected pantry_suggestion, got ${addUnknown[0].type}`)

console.log('LP-6 correction learning proposals: pass')

