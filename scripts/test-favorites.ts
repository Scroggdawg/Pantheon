import { buildFavorites, emptyFavorites, isFavoriteFood } from '../lib/favorites'
import type { FoodItem } from '../types/database'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function food(overrides: Partial<FoodItem>): FoodItem {
  return {
    name: 'Food',
    qty: 1,
    unit: 'serving',
    calories: 100,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    source: 'library',
    source_ref: null,
    match_confidence: { score: 1, label: 'high', warnings: [] },
    notes: null,
    ...overrides,
  }
}

const productRef = 'lib:product:yasso-black-raspberry-chip'
const favorites = buildFavorites([
  {
    id: 'saved-yasso-1',
    name: 'Yasso Black Raspberry Chip',
    foods_json: [
      food({
        name: 'Yasso Frozen Greek Yogurt Bar Black Raspberry Chip',
        qty: 1,
        unit: 'bar',
        source_ref: productRef,
      }),
    ],
  },
])

assert(
  isFavoriteFood(
    food({
      name: 'Yasso Frozen Greek Yogurt Bars Black Raspberry Chip',
      qty: 2,
      unit: 'serving',
      source_ref: productRef,
    }),
    favorites,
  ),
  'Expected product-backed favorite to survive name and quantity drift',
)

assert(
  !isFavoriteFood(
    food({
      name: 'Yasso Frozen Greek Yogurt Bars Sea Salt Caramel',
      qty: 1,
      unit: 'bar',
      source_ref: 'lib:product:yasso-sea-salt-caramel',
    }),
    favorites,
  ),
  'Expected different product ref not to inherit favorite state',
)

assert(
  !isFavoriteFood(
    food({
      name: 'Yasso Frozen Greek Yogurt Bars Black Raspberry Chip',
      qty: 2,
      unit: 'serving',
      source_ref: productRef,
    }),
    emptyFavorites(),
  ),
  'Expected empty favorites to stay empty',
)

console.log('favorite identity tests: 3 pass / 0 fail')
