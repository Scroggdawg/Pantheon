// Static validation for pantry training-pack files.
//
// Usage:
//   npx tsx scripts/test-pantry-packs.ts

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { normalizeFoodText } from '../lib/pantry-builder/normalize'
import type { PantryCategory, PantryProfile } from '../lib/pantry-builder/types'

const PACK_DIR = 'data/pantry/packs'
const CATEGORY_KEYS: PantryCategory[] = [
  'whole_foods',
  'proteins',
  'cuisine_staples',
  'sauces_condiments_oils',
  'breakfast_snacks',
  'beverages',
  'prepared_common',
  'coverage_buffer',
]
const PROTECTED_PATTERN_TRIGGERS = [
  'chipotle',
  'mcdonald',
  'restaurant',
  'rebbl',
  'yasso',
  'magic spoon',
  'silk',
  'kashi',
  'cracklin',
  'margarita',
  'beer',
  'dos equis',
  'dos xx',
]

function loadPack(file: string): PantryProfile {
  return JSON.parse(readFileSync(join(PACK_DIR, file), 'utf8')) as PantryProfile
}

function assertStringArray(value: unknown, label: string) {
  assert.ok(Array.isArray(value), `${label} must be an array`)
  for (const [index, item] of value.entries()) {
    assert.equal(typeof item, 'string', `${label}[${index}] must be a string`)
    assert.ok(item.trim().length > 0, `${label}[${index}] must not be empty`)
  }
}

function validatePack(file: string, pack: PantryProfile) {
  assert.ok(Number.isInteger(pack.version) && pack.version >= 1, `${file}: version must be a positive integer`)
  assert.ok(pack.name.trim().length > 0, `${file}: name is required`)
  assert.ok(Number.isInteger(pack.target_count) && pack.target_count > 0, `${file}: target_count must be positive`)

  for (const key of CATEGORY_KEYS) {
    assert.ok(key in pack.allocation, `${file}: allocation.${key} missing`)
    assert.ok(key in pack.categories, `${file}: categories.${key} missing`)
    assert.ok(Number.isInteger(pack.allocation[key]) && pack.allocation[key] >= 0, `${file}: allocation.${key} invalid`)
    assertStringArray(pack.categories[key], `${file}: categories.${key}`)
  }

  assertStringArray(pack.already_covered, `${file}: already_covered`)
  assertStringArray(pack.review_only_patterns, `${file}: review_only_patterns`)
  assertStringArray(pack.luke_food_profile.core_cuisines, `${file}: luke_food_profile.core_cuisines`)
  assertStringArray(pack.luke_food_profile.restaurants, `${file}: luke_food_profile.restaurants`)
  assertStringArray(pack.luke_food_profile.protein_anchors, `${file}: luke_food_profile.protein_anchors`)
  assertStringArray(pack.luke_food_profile.staple_categories, `${file}: luke_food_profile.staple_categories`)

  const seenTargets = new Set<string>()
  const duplicates: string[] = []
  const normalizedTargets: string[] = []
  for (const key of CATEGORY_KEYS) {
    for (const query of pack.categories[key]) {
      const normalized = normalizeFoodText(query)
      normalizedTargets.push(normalized)
      if (seenTargets.has(normalized)) duplicates.push(query)
      seenTargets.add(normalized)
    }
  }
  assert.deepEqual(duplicates, [], `${file}: duplicate target queries are not allowed`)
  assert.ok(seenTargets.size > 0, `${file}: pack must contain at least one target`)

  const protectedText = [
    ...normalizedTargets,
    ...pack.luke_food_profile.restaurants.map(normalizeFoodText),
    ...pack.luke_food_profile.staple_categories.map(normalizeFoodText),
  ].join(' ')
  for (const pattern of PROTECTED_PATTERN_TRIGGERS) {
    if (!protectedText.includes(pattern)) continue
    assert.ok(
      pack.review_only_patterns.some((row) => normalizeFoodText(row).includes(pattern)),
      `${file}: review_only_patterns should include protected term ${pattern}`,
    )
  }
}

function main() {
  const files = readdirSync(PACK_DIR).filter((file) => file.endsWith('.json')).sort()
  assert.ok(files.length > 0, 'expected at least one pantry pack')
  for (const file of files) validatePack(file, loadPack(file))
  console.log(`test-pantry-packs: ok (${files.length} packs)`)
}

main()
