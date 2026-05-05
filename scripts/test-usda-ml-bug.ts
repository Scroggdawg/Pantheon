// Brick B regression test for the ml-unit per-serving bug surfaced in
// Brick A. Standalone script — run with:
//
//   npx tsx scripts/test-usda-ml-bug.ts
//
// Pre-fix:  4 of 5 checks fail. per_serving silently equals per_100g
//           when servingSizeUnit is 'ml' because line 262 of
//           search-food-database.ts only special-cases 'g'.
// Post-fix: 5 of 5 pass. Extending the check to also accept 'ml'
//           treats ml as g for water-density liquids (~1% accurate
//           for coconut water, juice, milk, etc).

import { usdaFoodToCandidate } from '../lib/claude/tools/search-food-database'

// Fake USDA response shaped after fdcId 2083861 (HARMLESS HARVEST,
// HARMLESS COCONUT WATER), the entry Brick A's reproduction
// identified as the likely Attempt-1 pick. Numeric values are real.
const fakeUsdaResponse = {
  fdcId: 999999,
  description: 'TEST, COCONUT WATER',
  brandName: 'TEST BRAND',
  dataType: 'Branded',
  servingSize: 236.0,
  servingSizeUnit: 'ml',
  householdServingFullText: '8 OZA',
  foodNutrients: [
    { nutrientId: 1008, value: 25 },    // kcal
    { nutrientId: 1003, value: 0 },     // protein_g
    { nutrientId: 1005, value: 6.36 },  // carbs_g
    { nutrientId: 1004, value: 0 },     // fat_g
  ],
}

const result = usdaFoodToCandidate(fakeUsdaResponse)

let failures = 0
function check(label: string, condition: boolean, detail: string) {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    console.log(`  ✗ ${label}`)
    console.log(`      ${detail}`)
    failures++
  }
}

console.log('Brick B regression — usdaFoodToCandidate ml-unit handling')
console.log('Input: 25 kcal/100g coconut water, servingSize=236ml')
console.log('')

// per_100g should be unchanged regardless of fix
check(
  'per_100g.kcal === 25',
  result.per_100g.kcal === 25,
  `got ${result.per_100g.kcal}`,
)

// THE BUG: per_serving currently equals per_100g for ml-unit input.
// After fix, per_serving should reflect the 236ml serving size
// (treating ml as g for water-density liquids).
check(
  'per_serving.kcal !== per_100g.kcal (the bug)',
  result.per_serving.kcal !== result.per_100g.kcal,
  `BUG REPRODUCED — per_serving.kcal === per_100g.kcal === ${result.per_serving.kcal}`,
)

// Post-fix: per_serving.kcal should be ~59 (25 * 236 / 100)
const expectedPerServingKcal = (25 * 236) / 100
check(
  `per_serving.kcal ≈ ${expectedPerServingKcal} (25 * 236/100)`,
  result.per_serving.kcal !== null &&
    Math.abs(result.per_serving.kcal - expectedPerServingKcal) < 1,
  `expected ~${expectedPerServingKcal}, got ${result.per_serving.kcal}`,
)

// Same for carbs (6.36 * 236/100 = 15.01)
const expectedPerServingCarbs = (6.36 * 236) / 100
check(
  `per_serving.carbs_g ≈ ${expectedPerServingCarbs.toFixed(2)} (6.36 * 236/100)`,
  result.per_serving.carbs_g !== null &&
    Math.abs(result.per_serving.carbs_g - expectedPerServingCarbs) < 0.5,
  `expected ~${expectedPerServingCarbs.toFixed(2)}, got ${result.per_serving.carbs_g}`,
)

// serving_size_g should reflect the actual serving (236g for water-density liquids)
check(
  'serving_size_g === 236 (treating ml as g for liquids)',
  result.serving_size_g === 236,
  `got ${result.serving_size_g}`,
)

console.log('')
if (failures === 0) {
  console.log('✓ ALL CHECKS PASSED — bug is fixed')
  process.exit(0)
} else {
  console.log(`✗ ${failures} CHECK(S) FAILED`)
  process.exit(1)
}
