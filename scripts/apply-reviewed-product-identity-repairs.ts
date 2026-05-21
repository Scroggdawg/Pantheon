// Apply reviewed production data repairs for saved_meals.foods_json source_refs.
//
// Usage:
//   npx tsx scripts/apply-reviewed-product-identity-repairs.ts
//   npx tsx scripts/apply-reviewed-product-identity-repairs.ts --apply
//
// Default mode is dry-run. --apply mutates production saved_meals rows.
// This script is deliberately narrow: every repair has an exact saved_meal id,
// food index, expected current source_ref, and reviewed replacement.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createClient } from '@supabase/supabase-js'

interface FoodLike {
  name?: string | null
  source_ref?: string | null
  qty?: number | null
  unit?: string | null
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
}

interface SavedMealRow {
  id: string
  name: string | null
  foods_json: FoodLike[] | null
}

interface Repair {
  saved_meal_id: string
  saved_meal_name: string
  food_index: number
  food_name: string
  expected_current_source_ref: string
  next_source_ref: string | null
  reason: string
}

const REPAIRS: Repair[] = [
  {
    saved_meal_id: '2bb76415-4ce0-448c-ab0f-3c85a50f7aa9',
    saved_meal_name: 'Avocado',
    food_index: 0,
    food_name: 'Avocado',
    expected_current_source_ref: 'lib:hourly_go_to:avocado|',
    next_source_ref: 'lib:product:95f98eb0-20a0-4d0d-bc35-1de174937484',
    reason: 'Luke-level generic avocado should map to Avocado, raw, not avocado oil.',
  },
  {
    saved_meal_id: 'dfb181ed-e49e-456c-a9f6-0b50daaac312',
    saved_meal_name: 'Isopure whey protein isolate',
    food_index: 0,
    food_name: 'Isopure whey protein isolate',
    expected_current_source_ref: 'lib:hourly_go_to:isopure whey protein isolate|',
    next_source_ref: 'lib:product:f6459c43-78c4-42f2-839f-b50d53401156',
    reason: 'Saved macros match the reviewed Isopure Low Carb Protein Powder - Chocolate product.',
  },
  {
    saved_meal_id: 'f8cc8950-5f40-4932-a998-9fe89e8042ff',
    saved_meal_name: 'Whole eggs',
    food_index: 0,
    food_name: 'Whole eggs',
    expected_current_source_ref: 'lib:hourly_go_to:whole eggs|',
    next_source_ref: 'lib:product:9d3aa4fe-469b-4e94-8d08-30bf986d1014',
    reason: 'Saved macros are exactly two large eggs, matching the Eggs - Large product.',
  },
  {
    saved_meal_id: '30ce4634-e6f2-426b-a63b-1672f4377200',
    saved_meal_name: 'Egg whites',
    food_index: 0,
    food_name: 'Egg whites',
    expected_current_source_ref: 'lib:hourly_go_to:egg whites|',
    next_source_ref: 'lib:product:7eee9798-0901-442f-9f77-48cb838d1c14',
    reason: 'Saved six-large egg white macros match the Egg, white, raw, fresh product with a large unit alternative.',
  },
  {
    saved_meal_id: '77cc1545-669b-488f-a0ae-840796b9144d',
    saved_meal_name: 'cooked white rice',
    food_index: 0,
    food_name: 'cooked white rice',
    expected_current_source_ref: 'lib:hourly_go_to:cooked white rice|',
    next_source_ref: 'lib:product:f9a72851-68fe-4d88-ae74-cd37357c8491',
    reason: 'Saved one-cup macros match long-grain cooked white rice using its 158g cup alternative.',
  },
  {
    saved_meal_id: 'e414215e-a2f4-470b-85fc-f7fb29d9cf72',
    saved_meal_name: '365 Mexican style blend cheese (shredded)',
    food_index: 0,
    food_name: '365 Mexican style blend cheese (shredded)',
    expected_current_source_ref: 'lib:hourly_go_to:365 mexican style blend cheese',
    next_source_ref: null,
    reason: 'No reviewed product row exists; null is safer than preserving an hourly wrapper as a durable identity.',
  },
  {
    saved_meal_id: 'b71f0681-59dd-4a36-af5d-7a4a904e6050',
    saved_meal_name: '365 Mexican style blend cheese (shredded)',
    food_index: 0,
    food_name: '365 Mexican style blend cheese (shredded)',
    expected_current_source_ref: 'lib:hourly_go_to:365 mexican style blend cheese|',
    next_source_ref: null,
    reason: 'No reviewed product row exists; null is safer than preserving an hourly wrapper as a durable identity.',
  },
]

function loadEnvLocal() {
  const envPath = join(__dirname, '..', '.env.local')
  if (!existsSync(envPath)) return
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

function cloneFoods(value: FoodLike[] | null): FoodLike[] {
  return JSON.parse(JSON.stringify(Array.isArray(value) ? value : [])) as FoodLike[]
}

async function main() {
  loadEnvLocal()
  const apply = process.argv.includes('--apply')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service env vars')

  const supabase = createClient(url, key)
  const ids = [...new Set(REPAIRS.map((repair) => repair.saved_meal_id))]
  const { data, error } = await supabase
    .from('saved_meals')
    .select('id,name,foods_json')
    .in('id', ids)
  if (error) throw new Error(`saved_meals query failed: ${error.message}`)

  const rows = new Map((data ?? []).map((row) => [row.id, row as SavedMealRow]))
  const planned: string[] = []
  const alreadyApplied: string[] = []
  for (const repair of REPAIRS) {
    const row = rows.get(repair.saved_meal_id)
    if (!row) throw new Error(`Missing saved meal ${repair.saved_meal_id} (${repair.saved_meal_name})`)
    if (row.name !== repair.saved_meal_name) {
      throw new Error(`Name mismatch for ${repair.saved_meal_id}: expected ${repair.saved_meal_name}, got ${row.name}`)
    }
    const foods = cloneFoods(row.foods_json)
    const food = foods[repair.food_index]
    if (!food) throw new Error(`Missing food index ${repair.food_index} for ${repair.saved_meal_name}`)
    if (food.name !== repair.food_name) {
      throw new Error(`Food name mismatch for ${repair.saved_meal_name}: expected ${repair.food_name}, got ${food.name}`)
    }
    if (food.source_ref === repair.next_source_ref) {
      alreadyApplied.push(`${repair.saved_meal_name}: already ${repair.next_source_ref ?? '(null)'}`)
      continue
    }

    if (food.source_ref !== repair.expected_current_source_ref) {
      throw new Error(
        `Source ref mismatch for ${repair.saved_meal_name}: expected ${repair.expected_current_source_ref}, got ${food.source_ref ?? '(none)'}`,
      )
    }

    foods[repair.food_index] = { ...food, source_ref: repair.next_source_ref }
    planned.push(`${repair.saved_meal_name}: ${repair.expected_current_source_ref} -> ${repair.next_source_ref ?? '(null)'}`)

    if (apply) {
      const update = await supabase
        .from('saved_meals')
        .update({ foods_json: foods })
        .eq('id', repair.saved_meal_id)
      if (update.error) throw new Error(`Update failed for ${repair.saved_meal_name}: ${update.error.message}`)
    }
  }

  console.log('Reviewed Product Identity Repairs')
  console.log('')
  console.log(`mode: ${apply ? 'APPLY' : 'DRY_RUN'}`)
  console.log(`repairs: ${REPAIRS.length}`)
  console.log(`planned: ${planned.length}`)
  console.log(`already_applied: ${alreadyApplied.length}`)
  for (const line of planned) console.log(`- ${line}`)
  for (const line of alreadyApplied) console.log(`- ${line}`)
  if (!apply) console.log('\nNo production data was changed. Re-run with --apply to mutate saved_meals.foods_json.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
