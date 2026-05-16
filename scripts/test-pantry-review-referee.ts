// Validate the machine-readable Pantry Review Referee.
//
// Usage:
//   npx tsx scripts/test-pantry-review-referee.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

interface RefereePair {
  target_contains: string
  candidate_contains: string
  notes: string
}

interface ReviewReferee {
  version: number
  name: string
  principles: string[]
  compatible_pairs: RefereePair[]
  mismatch_pairs: RefereePair[]
  ask_luke_classes: Array<{
    class: string
    examples: string[]
    why: string
  }>
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function keyFor(pair: RefereePair) {
  return `${pair.target_contains.toLowerCase()} -> ${pair.candidate_contains.toLowerCase()}`
}

function validatePairs(label: string, pairs: RefereePair[]) {
  assert(pairs.length > 0, `${label} must not be empty`)
  const seen = new Set<string>()
  for (const pair of pairs) {
    assert(pair.target_contains.trim().length >= 3, `${label}: target_contains is too short`)
    assert(pair.candidate_contains.trim().length >= 3, `${label}: candidate_contains is too short`)
    assert(pair.notes.trim().length >= 10, `${label}: notes must explain the decision for ${keyFor(pair)}`)
    const key = keyFor(pair)
    assert(!seen.has(key), `${label}: duplicate pair ${key}`)
    seen.add(key)
  }
}

function includesPair(pairs: RefereePair[], target: string, candidate: string) {
  return pairs.some(
    (pair) =>
      pair.target_contains.toLowerCase() === target.toLowerCase() &&
      pair.candidate_contains.toLowerCase() === candidate.toLowerCase(),
  )
}

function main() {
  const path = join(process.cwd(), 'data/pantry/review-referee.json')
  const referee = JSON.parse(readFileSync(path, 'utf8')) as ReviewReferee

  assert(referee.version >= 1, 'version must be >= 1')
  assert(referee.name === 'Pantry Review Referee', 'unexpected referee name')
  assert(referee.principles.length >= 3, 'principles should document review doctrine')
  validatePairs('compatible_pairs', referee.compatible_pairs)
  validatePairs('mismatch_pairs', referee.mismatch_pairs)
  assert(referee.ask_luke_classes.length >= 3, 'ask_luke_classes should preserve true product-call boundaries')

  assert(
    includesPair(referee.mismatch_pairs, 'tom kha soup', 'tom collins'),
    'referee must know tom kha soup is not Tom Collins',
  )
  assert(
    includesPair(referee.mismatch_pairs, 'cracklin oat bran', 'oat bran, raw'),
    'referee must know Cracklin Oat Bran is not raw oat bran',
  )
  assert(
    includesPair(referee.mismatch_pairs, 'coffee black', 'plum, black'),
    'referee must know black coffee is not black plum',
  )
  assert(
    includesPair(referee.compatible_pairs, 'cilantro', 'coriander (cilantro) leaves'),
    'referee must know fresh coriander leaves are cilantro',
  )
  assert(
    includesPair(referee.compatible_pairs, 'balsamic vinegar', 'vinegar, balsamic'),
    'referee must know balsamic vinegar identity wording',
  )

  console.log('test-pantry-review-referee: ok')
  console.log(`compatible_pairs: ${referee.compatible_pairs.length}`)
  console.log(`mismatch_pairs: ${referee.mismatch_pairs.length}`)
  console.log(`ask_luke_classes: ${referee.ask_luke_classes.length}`)
}

main()
