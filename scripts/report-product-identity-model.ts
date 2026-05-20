// Read-only Product Identity Model audit.
//
// Usage:
//   npm run product-identity:audit
//
// This script inspects live identity surfaces and reports where products,
// saved meals, barcode rows, aliases, and history-facing source refs align
// with Pantheon's product identity doctrine. It does not write production data.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>

interface ProductRow {
  id: string
  name: string | null
  brand: string | null
  unit: string | null
  serving_size_g: number | null
  barcode: string | null
  provenance_source_kind?: string | null
  provenance_external_id?: string | null
  canonical_category?: string | null
  unit_alternatives?: unknown
}

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
  yield_servings: number | null
  times_logged: number | null
  last_logged_at: string | null
  is_favorite: boolean | null
}

interface AliasRow {
  target_type: string | null
  target_source_ref: string | null
  alias_type: string | null
  confidence: string | null
  source: string | null
  active: boolean | null
}

interface RejectionRow {
  rejected_source_ref: string | null
  source: string | null
  active: boolean | null
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

function countBy<T>(rows: T[], keyFn: (row: T) => string | null | undefined): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const key = keyFn(row) || '(none)'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function sourceRefKind(ref: string | null | undefined): 'product' | 'saved_meal' | 'hourly' | 'external' | 'none' | 'other' {
  if (!ref) return 'none'
  if (ref.startsWith('lib:product:')) return 'product'
  if (ref.startsWith('lib:saved_meal:')) return 'saved_meal'
  if (ref.startsWith('lib:hourly_go_to:')) return 'hourly'
  if (ref.startsWith('usda:') || ref.startsWith('off:')) return 'external'
  return 'other'
}

function formatCountMap(counts: Record<string, number>): string[] {
  const entries = Object.entries(counts)
  if (entries.length === 0) return ['- (none)']
  return entries.map(([key, count]) => `- ${key}: ${count}`)
}

function firstRows<T>(rows: T[], limit = 8): T[] {
  return rows.slice(0, limit)
}

function hasCompositionShape(name: string | null | undefined): boolean {
  const n = normalize(name)
  return /\b(protein shake|with dextrose|half dextrose|no dextrose|salad kit|meal|recipe|bowl)\b/.test(n)
}

function foodSummary(food: FoodLike): string {
  return `${food.name ?? '(unnamed)'}${food.qty ? ` x${food.qty}` : ''}${food.unit ? ` ${food.unit}` : ''}${food.source_ref ? ` [${food.source_ref}]` : ''}`
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')

  const supabase = createClient(url, key)

  const [productsRes, savedMealsRes, aliasesRes, rejectionsRes] = await Promise.all([
    supabase
      .from('products')
      .select('id,name,brand,unit,serving_size_g,barcode,provenance_source_kind,provenance_external_id,canonical_category,unit_alternatives')
      .order('name', { ascending: true }),
    supabase
      .from('saved_meals')
      .select('id,name,foods_json,total_calories,total_protein_g,total_carbs_g,total_fat_g,yield_servings,times_logged,last_logged_at,is_favorite')
      .order('times_logged', { ascending: false, nullsFirst: false }),
    supabase
      .from('food_identity_aliases')
      .select('target_type,target_source_ref,alias_type,confidence,source,active')
      .eq('active', true),
    supabase
      .from('food_identity_rejections')
      .select('rejected_source_ref,source,active')
      .eq('active', true),
  ])

  if (productsRes.error) throw new Error(`products query failed: ${productsRes.error.message}`)
  if (savedMealsRes.error) throw new Error(`saved_meals query failed: ${savedMealsRes.error.message}`)

  const products = (productsRes.data ?? []) as ProductRow[]
  const savedMeals = (savedMealsRes.data ?? []) as SavedMealRow[]
  const aliases = aliasesRes.error ? [] : ((aliasesRes.data ?? []) as AliasRow[])
  const rejections = rejectionsRes.error ? [] : ((rejectionsRes.data ?? []) as RejectionRow[])

  const productRefs = new Set(products.map((product) => `lib:product:${product.id}`))
  const savedMealRefs = new Set(savedMeals.map((meal) => `lib:saved_meal:${meal.id}`))

  const barcodeProducts = products.filter((product) => Boolean(product.barcode))
  const provenanceProducts = products.filter((product) => Boolean(product.provenance_source_kind || product.provenance_external_id))
  const productsWithUnits = products.filter((product) => asArray(product.unit_alternatives).length > 0)
  const compositionProducts = products.filter((product) => hasCompositionShape(product.name))
  const shakeProducts = products.filter((product) => normalize(product.name).includes('protein shake') || normalize(product.name).includes('dextrose'))

  const singleFoodMeals = savedMeals.filter((meal) => asArray(meal.foods_json).length === 1)
  const compositeMeals = savedMeals.filter((meal) => asArray(meal.foods_json).length > 1)
  const emptyMeals = savedMeals.filter((meal) => asArray(meal.foods_json).length === 0)
  const favoriteMeals = savedMeals.filter((meal) => meal.is_favorite)

  const productBackedSingleMeals = singleFoodMeals.filter((meal) => {
    const food = asArray(meal.foods_json)[0] as FoodLike | undefined
    return sourceRefKind(food?.source_ref) === 'product'
  })
  const savedMealBackedSingleMeals = singleFoodMeals.filter((meal) => {
    const food = asArray(meal.foods_json)[0] as FoodLike | undefined
    return sourceRefKind(food?.source_ref) === 'saved_meal'
  })
  const sourceRefMissingMeals = savedMeals.filter((meal) =>
    asArray(meal.foods_json).some((food) => sourceRefKind((food as FoodLike).source_ref) === 'none'),
  )
  const staleProductRefs = savedMeals.flatMap((meal) =>
    asArray(meal.foods_json)
      .map((food) => (food as FoodLike).source_ref)
      .filter((ref): ref is string => typeof ref === 'string' && ref.startsWith('lib:product:') && !productRefs.has(ref))
      .map((ref) => ({ meal, ref })),
  )
  const staleSavedMealRefs = savedMeals.flatMap((meal) =>
    asArray(meal.foods_json)
      .map((food) => (food as FoodLike).source_ref)
      .filter((ref): ref is string => typeof ref === 'string' && ref.startsWith('lib:saved_meal:') && !savedMealRefs.has(ref))
      .map((ref) => ({ meal, ref })),
  )
  const hourlyRefsInsideMeals = savedMeals.flatMap((meal) =>
    asArray(meal.foods_json)
      .map((food) => (food as FoodLike).source_ref)
      .filter((ref): ref is string => typeof ref === 'string' && ref.startsWith('lib:hourly_go_to:'))
      .map((ref) => ({ meal, ref })),
  )

  const productBackedFavoriteWrappers = productBackedSingleMeals.filter((meal) => meal.is_favorite)
  const likelyQuantityWrappers = productBackedFavoriteWrappers.filter((meal) => /^\d+\s/.test(normalize(meal.name)))
  const productWrapperCounts = countBy(productBackedSingleMeals, (meal) => {
    const food = asArray(meal.foods_json)[0] as FoodLike | undefined
    return food?.source_ref ?? null
  })
  const duplicateProductWrappers = Object.entries(productWrapperCounts).filter(([, count]) => count > 1)

  const healthWarnings: string[] = []
  if (staleProductRefs.length > 0) healthWarnings.push(`${staleProductRefs.length} saved-meal component refs point at missing products.`)
  if (staleSavedMealRefs.length > 0) healthWarnings.push(`${staleSavedMealRefs.length} saved-meal component refs point at missing saved meals.`)
  if (hourlyRefsInsideMeals.length > 0) healthWarnings.push(`${hourlyRefsInsideMeals.length} saved-meal component refs still contain hourly wrapper refs.`)
  if (sourceRefMissingMeals.length > 0) healthWarnings.push(`${sourceRefMissingMeals.length} saved meals have at least one component without source_ref.`)
  if (likelyQuantityWrappers.length > 0) healthWarnings.push(`${likelyQuantityWrappers.length} favorite/product wrappers look quantity-shaped.`)
  if (duplicateProductWrappers.length > 0) healthWarnings.push(`${duplicateProductWrappers.length} product source refs have multiple saved-meal wrappers.`)
  if (healthWarnings.length === 0) healthWarnings.push('No high-level identity health warnings found.')

  const report: string[] = []
  report.push('Product Identity Model Audit')
  report.push('')
  report.push('Summary')
  report.push(`- products: ${products.length}`)
  report.push(`- saved_meals: ${savedMeals.length}`)
  report.push(`- active_aliases: ${aliases.length}${aliasesRes.error ? ` (query failed: ${aliasesRes.error.message})` : ''}`)
  report.push(`- active_rejections: ${rejections.length}${rejectionsRes.error ? ` (query failed: ${rejectionsRes.error.message})` : ''}`)
  report.push(`- barcode_products: ${barcodeProducts.length}`)
  report.push(`- provenance_products: ${provenanceProducts.length}`)
  report.push(`- products_with_unit_alternatives: ${productsWithUnits.length}`)
  report.push(`- single_food_saved_meals: ${singleFoodMeals.length}`)
  report.push(`- composite_saved_meals: ${compositeMeals.length}`)
  report.push(`- favorite_saved_meals: ${favoriteMeals.length}`)
  report.push('')
  report.push('Identity Health')
  for (const warning of healthWarnings) report.push(`- ${warning}`)
  report.push('')
  report.push('Product Provenance')
  report.push(...formatCountMap(countBy(products, (product) => product.provenance_source_kind ?? 'manual_or_legacy')))
  report.push('')
  report.push('Product Categories')
  report.push(...formatCountMap(countBy(products, (product) => product.canonical_category ?? 'uncategorized')))
  report.push('')
  report.push('Saved Meal Shapes')
  report.push(`- single food: ${singleFoodMeals.length}`)
  report.push(`- product-backed single food: ${productBackedSingleMeals.length}`)
  report.push(`- saved-meal-backed single food: ${savedMealBackedSingleMeals.length}`)
  report.push(`- composites: ${compositeMeals.length}`)
  report.push(`- empty/missing foods_json: ${emptyMeals.length}`)
  report.push(`- components missing source_ref: ${sourceRefMissingMeals.length}`)
  report.push('')
  report.push('Alias Targets')
  report.push(...formatCountMap(countBy(aliases, (alias) => alias.target_type)))
  report.push('')
  report.push('Composition-Shaped Products To Watch')
  for (const product of firstRows(compositionProducts, 12)) {
    report.push(`- ${product.name} [lib:product:${product.id}]`)
  }
  if (compositionProducts.length === 0) report.push('- (none)')
  report.push('')
  report.push('Protein / Dextrose Product Surface')
  for (const product of firstRows(shakeProducts, 12)) {
    const alts = asArray(product.unit_alternatives).length
    report.push(`- ${product.name} | brand=${product.brand ?? '(none)'} | unit=${product.unit ?? '(none)'} | unit_alts=${alts} | ref=lib:product:${product.id}`)
  }
  if (shakeProducts.length === 0) report.push('- (none)')
  report.push('')
  report.push('Favorite Product Wrappers')
  for (const meal of firstRows(productBackedFavoriteWrappers, 12)) {
    const food = asArray(meal.foods_json)[0] as FoodLike | undefined
    report.push(`- ${meal.name} -> ${food ? foodSummary(food) : '(missing food)'} | times_logged=${meal.times_logged ?? 0}`)
  }
  if (productBackedFavoriteWrappers.length === 0) report.push('- (none)')
  report.push('')
  report.push('Duplicate Product Wrapper Refs')
  for (const [ref, count] of firstRows(duplicateProductWrappers, 12)) {
    report.push(`- ${ref}: ${count} wrappers`)
  }
  if (duplicateProductWrappers.length === 0) report.push('- (none)')
  report.push('')
  report.push('Hourly Wrapper Refs Inside Saved Meals')
  for (const item of firstRows(hourlyRefsInsideMeals, 12)) {
    report.push(`- ${item.meal.name ?? '(unnamed saved meal)'}: ${item.ref}`)
  }
  if (hourlyRefsInsideMeals.length === 0) report.push('- (none)')
  report.push('')
  report.push('Saved Meals With Missing Component Source Refs')
  for (const meal of firstRows(sourceRefMissingMeals, 12)) {
    const foods = asArray(meal.foods_json)
      .map((food) => foodSummary(food as FoodLike))
      .join('; ')
    report.push(`- ${meal.name ?? '(unnamed saved meal)'}: ${foods}`)
  }
  if (sourceRefMissingMeals.length === 0) report.push('- (none)')
  report.push('')
  report.push('Next Repair Hints')
  report.push('- If a barcode product is edited repeatedly, promote or repair its product facts rather than creating saved-meal variants.')
  report.push('- If a saved meal wraps a single product only for favoriting, preserve the product source_ref so hearts survive quantity changes.')
  report.push('- If a composition-shaped product keeps causing ambiguity, move behavior toward recipe/component composition instead of broad aliases.')
  report.push('- If stale refs appear here, repair live emitters first and treat historical rows as evidence.')

  console.log(report.join('\n'))

  const json: JsonRecord = {
    products: products.length,
    saved_meals: savedMeals.length,
    aliases: aliases.length,
    rejections: rejections.length,
    barcode_products: barcodeProducts.length,
    provenance_products: provenanceProducts.length,
    products_with_unit_alternatives: productsWithUnits.length,
    single_food_saved_meals: singleFoodMeals.length,
    composite_saved_meals: compositeMeals.length,
    product_backed_single_food_saved_meals: productBackedSingleMeals.length,
    product_backed_favorite_wrappers: productBackedFavoriteWrappers.length,
    likely_quantity_wrappers: likelyQuantityWrappers.length,
    duplicate_product_wrapper_refs: duplicateProductWrappers.length,
    stale_product_refs: staleProductRefs.length,
    stale_saved_meal_refs: staleSavedMealRefs.length,
    hourly_refs_inside_saved_meals: hourlyRefsInsideMeals.length,
  }
  if (process.argv.includes('--json')) console.log(JSON.stringify(json, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
