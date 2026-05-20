import { createClient } from '@/lib/supabase/server'
import {
  searchFoodDatabase,
  type FoodSearchResult,
} from '@/lib/claude/tools/search-food-database'
import type { FoodItem, MatchConfidence, UnitAlternative } from '@/types/database'

interface BarcodeLookupBody {
  barcode?: unknown
}

interface ProductBarcodeRow {
  id: string
  name: string
  brand: string | null
  unit: string
  serving_size_g: number | null
  calories_per_serving: number
  protein_g_per_serving: number
  carbs_g_per_serving: number
  fat_g_per_serving: number
  barcode: string | null
  unit_alternatives?: UnitAlternative[] | null
}

type BarcodeLookupSource = 'product' | 'database'

interface BarcodeLookupResponse {
  barcode: string
  status: 'found' | 'not_found'
  source: BarcodeLookupSource | null
  food: FoodItem | null
  candidates: FoodItem[]
  cache_hit?: boolean
  reason?: string
  lookup_ms: number
}

const BARCODE_MIN_LENGTH = 6
const BARCODE_MAX_LENGTH = 14

function json(status: number, body: Omit<BarcodeLookupResponse, 'lookup_ms'>, startedAt: number) {
  return Response.json(
    {
      ...body,
      lookup_ms: Date.now() - startedAt,
    },
    { status },
  )
}

function normalizeBarcode(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const digits = String(value).replace(/[^\d]/g, '')
  if (digits.length < BARCODE_MIN_LENGTH || digits.length > BARCODE_MAX_LENGTH) {
    return null
  }
  return digits
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function normalizedText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function nameWithBrand(name: string, brand: string | null): string {
  if (!brand) return name.trim()
  const cleanName = name.trim()
  const cleanBrand = brand.trim()
  if (!cleanBrand) return cleanName
  if (normalizedText(cleanName).startsWith(normalizedText(cleanBrand))) {
    return cleanName
  }
  return `${cleanBrand} ${cleanName}`.trim()
}

function cleanWarnings(warnings: string[]): string[] {
  // barcode_exact_match is a positive signal from the search tool, not a
  // user-facing warning that should force review in native.
  return warnings.filter((warning) => warning !== 'barcode_exact_match')
}

function productToFood(product: ProductBarcodeRow): FoodItem {
  return {
    name: nameWithBrand(product.name, product.brand),
    qty: 1,
    unit: product.unit || 'serving',
    calories: Math.round(product.calories_per_serving),
    protein_g: round1(product.protein_g_per_serving),
    carbs_g: round1(product.carbs_g_per_serving),
    fat_g: round1(product.fat_g_per_serving),
    source: 'library',
    source_ref: `lib:product:${product.id}`,
    match_confidence: { score: 1, label: 'high', warnings: [] },
    unit_alternatives: product.unit_alternatives ?? undefined,
  }
}

function macrosFromSearchResult(result: FoodSearchResult): {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
} | null {
  const serving = result.per_serving
  if (
    serving.kcal !== null &&
    serving.protein_g !== null &&
    serving.carbs_g !== null &&
    serving.fat_g !== null
  ) {
    return {
      calories: Math.round(serving.kcal),
      protein_g: round1(serving.protein_g),
      carbs_g: round1(serving.carbs_g),
      fat_g: round1(serving.fat_g),
    }
  }

  const per100g = result.per_100g
  if (
    result.serving_size_g !== null &&
    per100g.kcal !== null &&
    per100g.protein_g !== null &&
    per100g.carbs_g !== null &&
    per100g.fat_g !== null
  ) {
    const scale = result.serving_size_g / 100
    return {
      calories: Math.round(per100g.kcal * scale),
      protein_g: round1(per100g.protein_g * scale),
      carbs_g: round1(per100g.carbs_g * scale),
      fat_g: round1(per100g.fat_g * scale),
    }
  }

  return null
}

function searchResultToFood(result: FoodSearchResult): FoodItem | null {
  const macros = macrosFromSearchResult(result)
  if (!macros) return null
  const warnings = cleanWarnings(result.match_confidence.warnings)
  const confidence: MatchConfidence = {
    score: result.match_confidence.score,
    label: result.match_confidence.label,
    warnings,
  }

  return {
    name: nameWithBrand(result.name, result.brand),
    qty: 1,
    unit: result.household_serving || result.serving_description || 'serving',
    ...macros,
    source:
      result.match_confidence.score >= 0.8 && warnings.length === 0
        ? 'database_exact'
        : 'database_estimated',
    source_ref: result.id,
    match_confidence: confidence,
  }
}

async function lookupLocalProduct(barcode: string): Promise<FoodItem | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select(
      'id,name,brand,unit,serving_size_g,calories_per_serving,protein_g_per_serving,carbs_g_per_serving,fat_g_per_serving,barcode,unit_alternatives',
    )
    .eq('barcode', barcode)
    .limit(1)
    .maybeSingle<ProductBarcodeRow>()

  if (error) {
    console.warn('[food/barcode] local product lookup failed:', error.message)
    return null
  }
  return data ? productToFood(data) : null
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  let body: BarcodeLookupBody
  try {
    body = (await request.json()) as BarcodeLookupBody
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const barcode = normalizeBarcode(body.barcode)
  if (!barcode) {
    return Response.json(
      { error: 'barcode must contain 6-14 digits' },
      { status: 400 },
    )
  }

  const localFood = await lookupLocalProduct(barcode)
  if (localFood) {
    return json(
      200,
      {
        barcode,
        status: 'found',
        source: 'product',
        food: localFood,
        candidates: [localFood],
      },
      startedAt,
    )
  }

  const db = await searchFoodDatabase({
    query: barcode,
    barcode,
    dataset: 'off',
    limit: 5,
  })
  const candidates = db.results
    .map(searchResultToFood)
    .filter((food): food is FoodItem => food !== null)

  if (candidates.length === 0) {
    return json(
      200,
      {
        barcode,
        status: 'not_found',
        source: null,
        food: null,
        candidates: [],
        cache_hit: db._cache_hit,
        reason: 'no_barcode_product_with_complete_macros',
      },
      startedAt,
    )
  }

  return json(
    200,
    {
      barcode,
      status: 'found',
      source: 'database',
      food: candidates[0],
      candidates,
      cache_hit: db._cache_hit,
    },
    startedAt,
  )
}
