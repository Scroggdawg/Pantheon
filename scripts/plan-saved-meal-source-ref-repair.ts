// Read-only dry-run planner for saved_meals.foods_json source_ref repair.
//
// Usage:
//   npx tsx scripts/plan-saved-meal-source-ref-repair.ts
//
// This script does not write production data. It inspects saved meal
// component source_refs and proposes conservative repair actions for:
//   - lib:hourly_go_to:* wrapper refs inside saved meals
//   - missing component source_ref values
//
// Proposed actions are local artifacts only. Any live data mutation must
// be routed through integration review and explicit approval.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

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
  total_calories: number | null
  total_protein_g: number | null
  total_carbs_g: number | null
  total_fat_g: number | null
  times_logged: number | null
  last_logged_at: string | null
  is_favorite: boolean | null
}

interface ProductRow {
  id: string
  name: string | null
  brand: string | null
  calories_per_serving: number | null
  protein_g_per_serving: number | null
  carbs_g_per_serving: number | null
  fat_g_per_serving: number | null
  canonical_category?: string | null
}

interface Candidate {
  source_ref: string
  name: string
  source: 'product' | 'saved_meal'
  score: number
  reasons: string[]
}

interface RepairPlanItem {
  saved_meal_id: string
  saved_meal_name: string
  food_index: number
  food_name: string
  current_source_ref: string | null
  issue: 'hourly_wrapper_ref' | 'missing_source_ref'
  decision: 'auto_map' | 'review_required' | 'leave_null'
  proposed_source_ref: string | null
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
  candidates: Candidate[]
}

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

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripHourlyWrapper(ref: string): string | null {
  const cleaned = ref.replace(/^(lib:hourly_go_to:[^|]+\|)+/, '')
  if (cleaned && cleaned !== ref) return cleaned
  return null
}

function hourlyName(ref: string): string {
  const withoutPrefix = ref.replace(/^lib:hourly_go_to:/, '')
  return withoutPrefix.split('|')[0]?.trim() ?? ''
}

function macroScore(food: FoodLike, candidate: ProductRow | SavedMealRow): { score: number; reasons: string[] } {
  const reasons: string[] = []
  const comparisons: Array<[string, number | null | undefined, number | null | undefined, number]> = [
    ['calories', food.calories, 'calories_per_serving' in candidate ? candidate.calories_per_serving : candidate.total_calories, 25],
    ['protein', food.protein_g, 'protein_g_per_serving' in candidate ? candidate.protein_g_per_serving : candidate.total_protein_g, 5],
    ['carbs', food.carbs_g, 'carbs_g_per_serving' in candidate ? candidate.carbs_g_per_serving : candidate.total_carbs_g, 5],
    ['fat', food.fat_g, 'fat_g_per_serving' in candidate ? candidate.fat_g_per_serving : candidate.total_fat_g, 5],
  ]
  let matched = 0
  let available = 0
  for (const [label, actual, expected, tolerance] of comparisons) {
    if (typeof actual !== 'number' || typeof expected !== 'number') continue
    available += 1
    if (Math.abs(actual - expected) <= tolerance) {
      matched += 1
      reasons.push(`${label}_close`)
    }
  }
  if (available === 0) return { score: 0, reasons: [] }
  return { score: matched / available, reasons }
}

function nameScore(query: string, candidateName: string | null | undefined): { score: number; reasons: string[] } {
  const q = normalize(query)
  const c = normalize(candidateName)
  if (!q || !c) return { score: 0, reasons: [] }
  if (q === c) return { score: 1, reasons: ['exact_name'] }
  if (c.includes(q) || q.includes(c)) return { score: 0.86, reasons: ['name_contains'] }

  const qTokens = new Set(q.split(' ').filter((token) => token.length > 2))
  const cTokens = new Set(c.split(' ').filter((token) => token.length > 2))
  if (qTokens.size === 0 || cTokens.size === 0) return { score: 0, reasons: [] }
  const overlap = [...qTokens].filter((token) => cTokens.has(token)).length
  return { score: overlap / qTokens.size, reasons: overlap > 0 ? [`token_overlap_${overlap}`] : [] }
}

function rankCandidates(args: {
  food: FoodLike
  query: string
  products: ProductRow[]
  savedMeals: SavedMealRow[]
  currentSavedMealId: string
}): Candidate[] {
  const productCandidates = args.products.map((product): Candidate => {
    const name = nameScore(args.query, product.name)
    const macros = macroScore(args.food, product)
    return {
      source_ref: `lib:product:${product.id}`,
      name: product.name ?? '(unnamed product)',
      source: 'product',
      score: Math.round((name.score * 0.8 + macros.score * 0.2) * 1000) / 1000,
      reasons: [...name.reasons, ...macros.reasons],
    }
  })

  const savedMealCandidates = args.savedMeals
    .filter((meal) => meal.id !== args.currentSavedMealId)
    .map((meal): Candidate => {
      const name = nameScore(args.query, meal.name)
      const macros = macroScore(args.food, meal)
      return {
        source_ref: `lib:saved_meal:${meal.id}`,
        name: meal.name ?? '(unnamed saved meal)',
        source: 'saved_meal',
        score: Math.round((name.score * 0.8 + macros.score * 0.2) * 1000) / 1000,
        reasons: [...name.reasons, ...macros.reasons],
      }
    })

  return [...productCandidates, ...savedMealCandidates]
    .filter((candidate) => candidate.score >= 0.55)
    .sort((a, b) => b.score - a.score || (a.source === 'product' ? -1 : 1) || a.name.localeCompare(b.name))
    .slice(0, 5)
}

function classifyPlanItem(args: {
  meal: SavedMealRow
  food: FoodLike
  foodIndex: number
  issue: 'hourly_wrapper_ref' | 'missing_source_ref'
  candidates: Candidate[]
  strippedRef: string | null
}): RepairPlanItem {
  const [top, second] = args.candidates
  const reasons: string[] = []

  let decision: RepairPlanItem['decision'] = 'review_required'
  let proposed: string | null = null
  let confidence: RepairPlanItem['confidence'] = 'low'

  if (
    args.strippedRef?.startsWith('lib:product:') ||
    (
      args.strippedRef?.startsWith('lib:saved_meal:') &&
      args.strippedRef !== `lib:saved_meal:${args.meal.id}`
    )
  ) {
    decision = 'auto_map'
    proposed = args.strippedRef
    confidence = 'high'
    reasons.push('hourly_wrapper_contains_terminal_canonical_ref')
  } else if (top && top.score >= 0.95 && (!second || top.score - second.score >= 0.15)) {
    decision = 'auto_map'
    proposed = top.source_ref
    confidence = top.source === 'product' ? 'high' : 'medium'
    reasons.push('single_clear_candidate')
  } else if (top && top.score >= 0.8) {
    decision = 'review_required'
    proposed = top.source_ref
    confidence = 'medium'
    reasons.push('plausible_candidate_needs_review')
  } else if (args.issue === 'missing_source_ref') {
    decision = 'leave_null'
    proposed = null
    confidence = 'low'
    reasons.push('no_confident_canonical_identity')
  } else {
    decision = 'review_required'
    proposed = null
    confidence = 'low'
    reasons.push('hourly_wrapper_without_terminal_ref')
  }

  return {
    saved_meal_id: args.meal.id,
    saved_meal_name: args.meal.name ?? '(unnamed saved meal)',
    food_index: args.foodIndex,
    food_name: args.food.name ?? '(unnamed food)',
    current_source_ref: args.food.source_ref ?? null,
    issue: args.issue,
    decision,
    proposed_source_ref: proposed,
    confidence,
    reasons,
    candidates: args.candidates,
  }
}

function renderMarkdown(runId: string, items: RepairPlanItem[]): string {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.decision] = (acc[item.decision] ?? 0) + 1
    return acc
  }, {})

  const lines: string[] = []
  lines.push(`# Saved Meal Source Ref Repair Plan ${runId}`)
  lines.push('')
  lines.push('Status: dry-run only. No production data was changed.')
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- items: ${items.length}`)
  lines.push(`- auto_map: ${counts.auto_map ?? 0}`)
  lines.push(`- review_required: ${counts.review_required ?? 0}`)
  lines.push(`- leave_null: ${counts.leave_null ?? 0}`)
  lines.push('')
  lines.push('## Proposed Items')
  lines.push('')
  for (const item of items) {
    lines.push(`### ${item.saved_meal_name} / ${item.food_name}`)
    lines.push('')
    lines.push(`- issue: ${item.issue}`)
    lines.push(`- decision: ${item.decision}`)
    lines.push(`- confidence: ${item.confidence}`)
    lines.push(`- current_source_ref: ${item.current_source_ref ?? '(none)'}`)
    lines.push(`- proposed_source_ref: ${item.proposed_source_ref ?? '(none)'}`)
    lines.push(`- reasons: ${item.reasons.join(', ') || '(none)'}`)
    lines.push('- candidates:')
    for (const candidate of item.candidates.slice(0, 3)) {
      lines.push(`  - ${candidate.source_ref} | ${candidate.name} | score=${candidate.score} | ${candidate.reasons.join(', ')}`)
    }
    if (item.candidates.length === 0) lines.push('  - (none)')
    lines.push('')
  }
  lines.push('## Safety Gates')
  lines.push('')
  lines.push('- Do not apply this plan automatically.')
  lines.push('- Review every `review_required` and `leave_null` item before any mutation.')
  lines.push('- Route production writes through integration approval.')
  lines.push('- Prefer no source_ref over a guessed source_ref.')
  return lines.join('\n')
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')

  const supabase = createClient(url, key)
  const [savedMealsRes, productsRes] = await Promise.all([
    supabase
      .from('saved_meals')
      .select('id,name,foods_json,total_calories,total_protein_g,total_carbs_g,total_fat_g,times_logged,last_logged_at,is_favorite')
      .order('times_logged', { ascending: false, nullsFirst: false }),
    supabase
      .from('products')
      .select('id,name,brand,calories_per_serving,protein_g_per_serving,carbs_g_per_serving,fat_g_per_serving,canonical_category')
      .order('name', { ascending: true }),
  ])
  if (savedMealsRes.error) throw new Error(`saved_meals query failed: ${savedMealsRes.error.message}`)
  if (productsRes.error) throw new Error(`products query failed: ${productsRes.error.message}`)

  const savedMeals = (savedMealsRes.data ?? []) as SavedMealRow[]
  const products = (productsRes.data ?? []) as ProductRow[]
  const items: RepairPlanItem[] = []

  for (const meal of savedMeals) {
    const foods = Array.isArray(meal.foods_json) ? meal.foods_json : []
    for (const [index, food] of foods.entries()) {
      const currentRef = food.source_ref ?? null
      const issue =
        currentRef?.startsWith('lib:hourly_go_to:')
          ? 'hourly_wrapper_ref'
          : currentRef
            ? null
            : 'missing_source_ref'
      if (!issue) continue

      const strippedRef = currentRef ? stripHourlyWrapper(currentRef) : null
      const query = issue === 'hourly_wrapper_ref'
        ? hourlyName(currentRef ?? '') || food.name || meal.name || ''
        : food.name || meal.name || ''
      const candidates = rankCandidates({ food, query, products, savedMeals, currentSavedMealId: meal.id })
      items.push(classifyPlanItem({ meal, food, foodIndex: index, issue, candidates, strippedRef }))
    }
  }

  const runId = randomUUID()
  const outputDir = resolve('scripts/output')
  mkdirSync(outputDir, { recursive: true })
  const jsonPath = join(outputDir, `saved-meal-source-ref-repair-${runId}.json`)
  const markdownPath = join(outputDir, `saved-meal-source-ref-repair-${runId}.md`)
  writeFileSync(jsonPath, JSON.stringify({ run_id: runId, generated_at: new Date().toISOString(), items }, null, 2))
  writeFileSync(markdownPath, renderMarkdown(runId, items))

  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.decision] = (acc[item.decision] ?? 0) + 1
    return acc
  }, {})

  console.log('Saved Meal Source Ref Repair Plan')
  console.log('')
  console.log(`run_id: ${runId}`)
  console.log(`items: ${items.length}`)
  console.log(`auto_map: ${counts.auto_map ?? 0}`)
  console.log(`review_required: ${counts.review_required ?? 0}`)
  console.log(`leave_null: ${counts.leave_null ?? 0}`)
  console.log(`json: ${jsonPath}`)
  console.log(`markdown: ${markdownPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
