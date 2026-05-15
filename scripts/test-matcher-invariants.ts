// Matcher Constitution invariant tests.
//
// These are intentionally helper-level tests: no Supabase, no replay
// corpus, no LLM. Replay tells us real examples still work; this file
// tells us the matcher still obeys its identity and normalization laws.

import {
  dedupeAndSortLibraryResults,
  guardedLibraryNameSimilarity,
  type LibrarySearchResult,
} from '../lib/claude/tools/search-user-library'
import {
  normalizeFoodSourceRef,
  relaxedSegmentQuery,
  segmentTranscript,
} from '../lib/claude/parse-meal-library-shortcut'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function candidate(
  overrides: Pick<LibrarySearchResult, 'library_id' | 'source' | 'source_ref' | 'name'>
    & Partial<LibrarySearchResult>,
): LibrarySearchResult {
  const score = overrides.match_confidence?.score ?? 1
  return {
    is_favorite: false,
    aliases: [],
    components: [],
    total: { kcal: 100, protein_g: 10, carbs_g: 10, fat_g: 3 },
    yield_servings: 1,
    total_batch: null,
    times_logged: null,
    last_logged_at: null,
    ...overrides,
    match_confidence: {
      score,
      label: score >= 0.85 ? 'high' : score >= 0.7 ? 'medium' : 'low',
      components: { name_similarity: score },
      formula: 'test',
      ...overrides.match_confidence,
    },
  }
}

function names(results: LibrarySearchResult[]): string[] {
  return results.map((r) => `${r.source}:${r.name}`)
}

const tests: Array<[string, () => void]> = [
  [
    'canonical saved_meal beats hourly wrapper with same terminal source_ref',
    () => {
      const results = dedupeAndSortLibraryResults([
        candidate({
          library_id: 'lib:hourly_go_to:3 eggs|lib:saved_meal:s1',
          source: 'hourly_go_to',
          source_ref: 'lib:hourly_go_to:3 eggs|lib:saved_meal:s1',
          name: '3 eggs',
          times_logged: 8,
        }),
        candidate({
          library_id: 'lib:saved_meal:s1',
          source: 'saved_meal',
          source_ref: 'lib:saved_meal:s1',
          name: '3 eggs',
          is_favorite: true,
        }),
      ])

      assert(results.length === 1, `expected one result, got ${names(results)}`)
      assert(results[0].source === 'saved_meal', `expected saved_meal, got ${names(results)}`)
      assert(results[0].source_ref === 'lib:saved_meal:s1', 'expected canonical source_ref')
    },
  ],
  [
    'canonical product beats null-ref hourly with same name',
    () => {
      const results = dedupeAndSortLibraryResults([
        candidate({
          library_id: 'lib:hourly_go_to:banana|',
          source: 'hourly_go_to',
          source_ref: null,
          name: 'Banana',
          times_logged: 3,
        }),
        candidate({
          library_id: 'lib:product:p1',
          source: 'product',
          source_ref: 'lib:product:p1',
          name: 'Banana',
        }),
      ])

      assert(results.length === 1, `expected one result, got ${names(results)}`)
      assert(results[0].source === 'product', `expected product, got ${names(results)}`)
    },
  ],
  [
    'canonical saved_meal beats external-ref hourly with same name',
    () => {
      const results = dedupeAndSortLibraryResults([
        candidate({
          library_id: 'lib:hourly_go_to:burrito|usda:123',
          source: 'hourly_go_to',
          source_ref: 'usda:123',
          name: "McDonald's Sausage Burrito",
        }),
        candidate({
          library_id: 'lib:saved_meal:s2',
          source: 'saved_meal',
          source_ref: 'lib:saved_meal:s2',
          name: "McDonald's Sausage Burrito",
          is_favorite: true,
        }),
      ])

      assert(results.length === 1, `expected one result, got ${names(results)}`)
      assert(results[0].source === 'saved_meal', `expected saved_meal, got ${names(results)}`)
    },
  ],
  [
    'hourly survives when no canonical identity exists',
    () => {
      const results = dedupeAndSortLibraryResults([
        candidate({
          library_id: 'lib:hourly_go_to:t-bone steak|',
          source: 'hourly_go_to',
          source_ref: null,
          name: 'T-bone steak',
        }),
      ])

      assert(results.length === 1, `expected one result, got ${names(results)}`)
      assert(results[0].source === 'hourly_go_to', `expected hourly_go_to, got ${names(results)}`)
    },
  ],
  [
    'singular/plural variants collapse to canonical product',
    () => {
      const results = dedupeAndSortLibraryResults([
        candidate({
          library_id: 'lib:hourly_go_to:banana|',
          source: 'hourly_go_to',
          source_ref: null,
          name: 'banana',
        }),
        candidate({
          library_id: 'lib:product:p2',
          source: 'product',
          source_ref: 'lib:product:p2',
          name: 'Bananas',
        }),
      ])

      assert(results.length === 1, `expected one result, got ${names(results)}`)
      assert(results[0].source === 'product', `expected product, got ${names(results)}`)
    },
  ],
  [
    'generic coffee is capped below shortcut threshold for branded overmatches',
    () => {
      const branded = guardedLibraryNameSimilarity('coffee', 'REBBL Hazelnut Coffee Elixir')
      const exact = guardedLibraryNameSimilarity('coffee', 'Coffee')

      assert(branded === 0.84, `expected branded cap 0.84, got ${branded}`)
      assert(exact === 1, `expected exact coffee score 1, got ${exact}`)
    },
  ],
  [
    'generic chip and bacon queries are capped below shortcut threshold for composite overmatches',
    () => {
      const chipBar = guardedLibraryNameSimilarity('chips', 'Yasso Greek Yogurt Bar - Mint Chocolate Chip')
      const baconSandwich = guardedLibraryNameSimilarity(
        'bacon',
        "McDonald's Bacon Egg & Cheese Biscuit",
      )
      const exactBacon = guardedLibraryNameSimilarity('bacon', 'Bacon')

      assert(chipBar === 0.84, `expected chip cap 0.84, got ${chipBar}`)
      assert(baconSandwich === 0.84, `expected bacon cap 0.84, got ${baconSandwich}`)
      assert(exactBacon === 1, `expected exact bacon score 1, got ${exactBacon}`)
    },
  ],
  [
    'relaxed segment query strips quantity and filler but preserves identity words',
    () => {
      assert(
        relaxedSegmentQuery('20 chips with guacamole') === 'chips guacamole',
        'expected chips guacamole relaxed query',
      )
      assert(
        relaxedSegmentQuery('2 margaritas on the rocks') === 'margaritas',
        'expected margaritas relaxed query',
      )
      assert(
        relaxedSegmentQuery('stevia hazelnut liquid') === 'stevia hazelnut liquid',
        'expected identity words to remain unchanged',
      )
    },
  ],
  [
    'segmenter splits obvious accompaniment foods without splitting integrated shake ingredients',
    () => {
      const chips = segmentTranscript('20 chips with guacamole')
      assert(chips.length === 2, `expected chips + guacamole, got ${JSON.stringify(chips)}`)
      assert(chips[0].stripped === '20 chips', `expected 20 chips, got ${chips[0].stripped}`)
      assert(chips[1].stripped === 'guacamole', `expected guacamole, got ${chips[1].stripped}`)

      const churros = segmentTranscript('2 churros with chocolate sauce')
      assert(churros.length === 2, `expected churros + sauce, got ${JSON.stringify(churros)}`)
      assert(churros[0].stripped === '2 churros', `expected 2 churros, got ${churros[0].stripped}`)
      assert(
        churros[1].stripped === 'chocolate sauce',
        `expected chocolate sauce, got ${churros[1].stripped}`,
      )

      const shake = segmentTranscript('protein shake with dextrose')
      assert(shake.length === 1, `expected integrated shake segment, got ${JSON.stringify(shake)}`)
      assert(
        shake[0].stripped === 'protein shake with dextrose',
        `expected shake to stay intact, got ${shake[0].stripped}`,
      )
    },
  ],
  [
    'written source_ref never persists hourly_go_to wrappers when terminal ref exists',
    () => {
      assert(
        normalizeFoodSourceRef('lib:hourly_go_to:3 eggs|lib:saved_meal:s1') === 'lib:saved_meal:s1',
        'expected saved_meal terminal ref',
      )
      assert(
        normalizeFoodSourceRef('lib:hourly_go_to:banana|lib:product:p1') === 'lib:product:p1',
        'expected product terminal ref',
      )
    },
  ],
]

let pass = 0
for (const [name, run] of tests) {
  run()
  pass += 1
  console.log(`✓ ${name}`)
}

console.log(`\nMatcher invariants: ${pass} pass / 0 fail`)
