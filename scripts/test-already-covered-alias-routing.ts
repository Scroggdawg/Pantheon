import assert from 'node:assert/strict'

import {
  type AliasProductTarget,
  type ExistingIdentityAlias,
  planAlreadyCoveredAliasRoute,
} from '../lib/pantry-builder/alias-routing'

const products: AliasProductTarget[] = [
  { id: 'p-banana', name: 'Bananas', brand: null },
  { id: 'p-balsamic', name: 'Vinegar, balsamic', brand: null },
  { id: 'p-almond', name: 'Almond milk, unsweetened, plain, shelf stable', brand: null },
  { id: 'p-beef-raw', name: 'Beef, top sirloin steak, raw', brand: null },
  { id: 'p-cottage-lowfat', name: 'Cheese, cottage, lowfat, 2% milkfat', brand: null },
  { id: 'p-coconut-a', name: 'Coconut water', brand: 'Harmless Harvest' },
  { id: 'p-coconut-b', name: 'Coconut water', brand: 'Taste Nirvana' },
  { id: 'p-oats-protein', name: 'Quaker Protein Old-Fashioned Rolled Oats', brand: null },
]

function aliases(rows: ExistingIdentityAlias[] = []) {
  return rows
}

function plan(input: { candidate_key: string; target_query: string | null; display_name: string }, existingAliases: ExistingIdentityAlias[] = []) {
  return planAlreadyCoveredAliasRoute(input, products, aliases(existingAliases))
}

{
  const result = plan({ candidate_key: 'banana', target_query: 'banana', display_name: 'Bananas' })
  assert.equal(result.type, 'propose_alias')
  if (result.type === 'propose_alias') {
    assert.equal(result.target_source_ref, 'lib:product:p-banana')
    assert.equal(result.normalized_alias, 'banana')
    assert.equal(result.confidence, 'high')
  }
}

{
  const result = plan({ candidate_key: 'balsamic', target_query: 'balsamic vinegar', display_name: 'Vinegar, balsamic' })
  assert.equal(result.type, 'propose_alias')
  if (result.type === 'propose_alias') {
    assert.equal(result.target_source_ref, 'lib:product:p-balsamic')
    assert.equal(result.confidence, 'high')
  }
}

{
  const result = plan({ candidate_key: 'almond', target_query: 'unsweetened almond milk', display_name: 'Almond milk, unsweetened, plain, shelf stable' })
  assert.equal(result.type, 'propose_alias')
  if (result.type === 'propose_alias') {
    assert.equal(result.target_source_ref, 'lib:product:p-almond')
  }
}

{
  const result = plan({ candidate_key: 'bowl', target_query: 'cottage cheese bowl', display_name: 'Yogurt, Greek, plain, nonfat' })
  assert.equal(result.type, 'not_aliasable')
}

{
  const result = plan({ candidate_key: 'coconut', target_query: 'coconut water', display_name: 'Coconut water' })
  assert.equal(result.type, 'ambiguous')
  if (result.type === 'ambiguous') assert.equal(result.matches.length, 2)
}

{
  const result = plan(
    { candidate_key: 'existing', target_query: 'banana', display_name: 'Bananas' },
    [{ target_source_ref: 'lib:product:p-banana', normalized_alias: 'banana' }],
  )
  assert.equal(result.type, 'already_exists')
}

{
  const result = plan({ candidate_key: 'none', target_query: 'black coffee', display_name: 'Plum, black, with skin, raw' })
  assert.equal(result.type, 'no_match')
}

{
  const result = plan({ candidate_key: 'cooked-raw', target_query: 'beef sirloin cooked', display_name: 'Beef, top sirloin steak, raw' })
  assert.equal(result.type, 'no_match')
}

{
  const result = plan({ candidate_key: 'fat-level', target_query: 'cottage cheese nonfat', display_name: 'Cheese, cottage, lowfat, 2% milkfat' })
  assert.equal(result.type, 'no_match')
}

{
  const result = plan({ candidate_key: 'specific-formula', target_query: 'rolled oats', display_name: 'Quaker Protein Old-Fashioned Rolled Oats' })
  assert.equal(result.type, 'no_match')
}

console.log('Already-covered alias routing tests: ok')
