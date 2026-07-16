import { readFileSync } from 'fs'
import { join } from 'path'

function loadEnvLocal() {
  const envPath = join(__dirname, '..', '.env.local')
  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

import { POST as parseMealPOST } from '../app/api/claude/parse-meal/route'
import type { FoodItem, ParsedMealResponse } from '../types/database'

type ParsedWithTelemetry = ParsedMealResponse & {
  _telemetry?: Record<string, unknown>
}

interface Case {
  id: string
  transcript: string
  assert: (result: ParsedWithTelemetry) => void
}

const STALE_PROTEIN_SHAKE_SOURCE_REF =
  'lib:saved_meal:1a2ac44d-80d4-4afd-83ed-bd388e77e14e'

function fail(message: string): never {
  throw new Error(message)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message)
}

function findFood(result: ParsedMealResponse, pattern: RegExp): FoodItem {
  const food = result.foods.find((item) => pattern.test(item.name))
  assert(food, `Missing food matching ${pattern}`)
  return food
}

function assertNoSavedShakeShortcut(result: ParsedMealResponse) {
  for (const food of result.foods) {
    assert(
      !/protein shake/i.test(food.name),
      `Unexpected saved protein-shake shortcut row: ${food.name}`,
    )
  }
}

function assertNoStaleProteinShakeSourceRef(result: ParsedMealResponse) {
  for (const food of result.foods) {
    assert(
      food.source_ref !== STALE_PROTEIN_SHAKE_SOURCE_REF,
      `Unexpected stale protein-shake source_ref on ${food.name}`,
    )
  }
  for (const group of result.disambiguation ?? []) {
    for (const candidate of group.candidates) {
      assert(
        candidate.source_ref !== STALE_PROTEIN_SHAKE_SOURCE_REF,
        `Unexpected stale protein-shake candidate source_ref on ${candidate.name}`,
      )
    }
  }
}

function assertClose(actual: number, expected: number, label: string) {
  assert(
    Math.abs(actual - expected) < 0.01,
    `${label}: expected ${expected}, got ${actual}`,
  )
}

async function parseTranscript(transcript: string): Promise<ParsedWithTelemetry> {
  const res = await parseMealPOST(
    new Request('http://localhost/api/claude/parse-meal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    }),
  )
  const json = await res.json()
  assert(res.ok, `Parse failed ${res.status}: ${JSON.stringify(json)}`)
  return json as ParsedWithTelemetry
}

const cases: Case[] = [
  {
    id: 'salmon-taylor-farms-whole-bag',
    transcript:
      "1 1/4 lb salmon fillet, 1/4 medium avocado, 2 slices of Dave's Killer Bread 21 whole grains and seeds, 1 Taylor Farms Mexican Street Corn Salad, the entire bag of 12.8 ounces",
    assert(result) {
      assert(result.clarification_needed === null, 'Expected no bag clarification')
      assert(
        result._telemetry?.library_segmented_quantity_only_ignored_count === 1,
        'Expected one quantity-only segment to be ignored',
      )
      assert(
        result._telemetry?.weighted_protein_fast_path_hit === true,
        'Expected salmon weighted-protein fast path',
      )
      const bread = findFood(result, /Dave's Killer Bread/i)
      assertClose(bread.qty, 2, 'Dave bread qty')
      assert(/slice/i.test(bread.unit), `Expected Dave bread unit slice, got ${bread.unit}`)
      const avocado = findFood(result, /Avocado/i)
      assertClose(avocado.qty, 0.25, 'Avocado qty')
      findFood(result, /Taylor Farms Mexican Street Corn Salad/i)
      findFood(result, /Salmon fillet/i)
      assert(
        !result.foods.some((food) => /12\.8|bag/i.test(food.name)),
        'Quantity-only bag text should not become a food row',
      )
    },
  },
  {
    id: 'plain-protein-shake-with-dextrose',
    transcript: 'Protein shake with dextrose.',
    assert(result) {
      assertNoSavedShakeShortcut(result)
      assertNoStaleProteinShakeSourceRef(result)
      assertClose(result.total_protein_g, 25, 'Plain full dextrose protein')
      assertClose(result.total_carbs_g, 20, 'Plain full dextrose carbs')
      assert(result.foods.length === 2, `Expected protein + dextrose rows, got ${result.foods.length}`)
      assert(result._telemetry?.protein_shake_ingredient_shortcut_hit === true, 'Expected shake shortcut')
    },
  },
  {
    id: 'protein-shake-full-dextrose',
    transcript:
      'Protein shake with Isopure chocolate protein and one serving of NutriCost dextrose',
    assert(result) {
      assertNoSavedShakeShortcut(result)
      assertNoStaleProteinShakeSourceRef(result)
      assertClose(result.total_protein_g, 25, 'Full dextrose protein')
      assertClose(result.total_carbs_g, 20, 'Full dextrose carbs')
      assert(result._telemetry?.protein_shake_ingredient_shortcut_hit === true, 'Expected shake shortcut')
    },
  },
  {
    id: 'protein-shake-voice-mangled-nutricost',
    transcript: 'Isopure Protein Shake with Nutri-Cust Dextrose',
    assert(result) {
      assertNoSavedShakeShortcut(result)
      assertNoStaleProteinShakeSourceRef(result)
      assertClose(result.total_protein_g, 25, 'Voice-mangled Nutricost protein')
      assertClose(result.total_carbs_g, 20, 'Voice-mangled Nutricost carbs')
      assert(result.foods.length === 2, `Expected protein + dextrose rows, got ${result.foods.length}`)
      assert(result._telemetry?.protein_shake_ingredient_shortcut_hit === true, 'Expected shake shortcut')
    },
  },
  {
    id: 'protein-shake-half-dextrose',
    transcript:
      'Protein shake with Isopure chocolate protein and half a serving of NutriCost dextrose',
    assert(result) {
      assertNoSavedShakeShortcut(result)
      assertNoStaleProteinShakeSourceRef(result)
      assertClose(result.total_protein_g, 25, 'Half dextrose protein')
      assertClose(result.total_carbs_g, 10.5, 'Half dextrose carbs')
      assert(result._telemetry?.protein_shake_ingredient_shortcut_hit === true, 'Expected shake shortcut')
    },
  },
  {
    id: 'protein-shake-no-dextrose',
    transcript: 'Protein shake with Isopure chocolate protein, no dextrose',
    assert(result) {
      assertNoSavedShakeShortcut(result)
      assertNoStaleProteinShakeSourceRef(result)
      assertClose(result.total_protein_g, 25, 'No dextrose protein')
      assertClose(result.total_carbs_g, 1, 'No dextrose carbs')
      assert(result.foods.length === 1, `Expected one protein row, got ${result.foods.length}`)
    },
  },
  {
    id: 'plain-protein-shake-no-dextrose',
    transcript: 'One protein shake, no dextrose',
    assert(result) {
      assertNoSavedShakeShortcut(result)
      assertNoStaleProteinShakeSourceRef(result)
      assertClose(result.total_protein_g, 25, 'Plain no dextrose protein')
      assert(result.foods.length === 1, `Expected one protein row, got ${result.foods.length}`)
      assert(result._telemetry?.protein_shake_ingredient_shortcut_hit === true, 'Expected shake shortcut')
    },
  },
  {
    id: 'plain-protein-shake-no-dextrose-with-sweet-potatoes',
    transcript: 'One protein shake, no dextrose, and 278 grams of sweet potatoes.',
    assert(result) {
      assertNoSavedShakeShortcut(result)
      assertNoStaleProteinShakeSourceRef(result)
      const proteinRows = result.foods.filter((food) => /isopure|protein/i.test(food.name))
      assert(proteinRows.length === 1, `Expected one protein ingredient row, got ${proteinRows.length}`)
      const sweetPotatoes = findFood(result, /Sweet potatoes/i)
      assertClose(sweetPotatoes.qty, 278, 'Sweet potato qty')
      assert(/grams/i.test(sweetPotatoes.unit), `Expected sweet potato unit grams, got ${sweetPotatoes.unit}`)
      assertClose(Math.round(sweetPotatoes.calories * 10) / 10, 215.2, 'Sweet potato calories')
    },
  },
  {
    id: 'one-scoop-isopure-with-sweet-potatoes',
    transcript: 'One scoop of Isopure protein and 260 grams of sweet potatoes.',
    assert(result) {
      assertNoSavedShakeShortcut(result)
      assertNoStaleProteinShakeSourceRef(result)
      const protein = findFood(result, /Isopure/i)
      assertClose(protein.qty, 1, 'Isopure protein qty')
      assert(/scoop/i.test(protein.unit), `Expected Isopure unit scoop, got ${protein.unit}`)
      const sweetPotatoes = findFood(result, /Sweet potatoes/i)
      assertClose(sweetPotatoes.qty, 260, 'Sweet potato qty')
      assert(/grams/i.test(sweetPotatoes.unit), `Expected sweet potato unit grams, got ${sweetPotatoes.unit}`)
      assert(result._telemetry?.library_segmented_hit === true, 'Expected fully segmented library shortcut')
      assert(result._telemetry?.fallback_llm_hit !== true, 'Expected no LLM fallback')
    },
  },
  {
    id: 'coconut-water-four-servings-candidates-mode',
    transcript: 'Harmless Harvest Organic Coconut Water, 4 servings',
    assert(result) {
      const coconutWater = findFood(result, /Harmless Harvest Organic Coconut Water/i)
      assertClose(coconutWater.qty, 4, 'Coconut water qty')
      assert(/serving/i.test(coconutWater.unit), `Expected coconut water unit serving, got ${coconutWater.unit}`)
      assertClose(coconutWater.calories, 200, 'Coconut water calories')
      assertClose(coconutWater.carbs_g, 50.3, 'Coconut water carbs')
      assert(
        coconutWater.match_confidence?.warnings.includes('library_candidates_quantity_applied'),
        'Expected candidate quantity warning',
      )
    },
  },
  {
    id: 'double-protein-full-dextrose',
    transcript:
      'Double protein shake, two scoops of Isopure chocolate protein, with one serving of NutriCost dextrose',
    assert(result) {
      assertNoSavedShakeShortcut(result)
      assertNoStaleProteinShakeSourceRef(result)
      assertClose(result.total_protein_g, 50, 'Double full protein')
      assertClose(result.total_carbs_g, 21, 'Double full carbs')
    },
  },
  {
    id: 'double-protein-half-dextrose',
    transcript:
      'Two scoop protein shake with Isopure chocolate protein and half a serving of NutriCost dextrose',
    assert(result) {
      assertNoSavedShakeShortcut(result)
      assertNoStaleProteinShakeSourceRef(result)
      assertClose(result.total_protein_g, 50, 'Double half protein')
      assertClose(result.total_carbs_g, 11.5, 'Double half carbs')
    },
  },
  {
    id: 'double-protein-no-dextrose',
    transcript: 'Double protein shake, two scoops of Isopure chocolate protein, no dextrose',
    assert(result) {
      assertNoSavedShakeShortcut(result)
      assertNoStaleProteinShakeSourceRef(result)
      assertClose(result.total_protein_g, 50, 'Double none protein')
      assertClose(result.total_carbs_g, 2, 'Double none carbs')
      assert(result.foods.length === 1, `Expected one protein row, got ${result.foods.length}`)
    },
  },
]

async function main() {
  let passed = 0
  for (const testCase of cases) {
    const result = await parseTranscript(testCase.transcript)
    testCase.assert(result)
    passed += 1
    console.log(`✓ ${testCase.id}`)
  }
  console.log(`\nparse-meal regressions: ${passed} pass / 0 fail`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
