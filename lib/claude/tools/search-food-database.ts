// search_food_database — unified USDA FoodData Central + Open Food Facts.
// TypeScript port of prototype/search_food_database.py (S26 Step 2).
//
// Ranking: composite match_confidence = base * macro_consistency
//   base = NAME_WEIGHT*name_sim + BRAND_WEIGHT*brand_match (when user gave a brand)
//   base = name_sim                                         (no user brand)
// Barcode-first: when a UPC is supplied, OFF + USDA Branded by-UPC lookups
// run before any text search; UPC hits are scored with name_sim = 1.0.

import type { Tool } from '@anthropic-ai/sdk/resources/messages'

import {
  BRAND_MATCH_DIFFERENT,
  BRAND_MATCH_EXACT,
  BRAND_MATCH_NO_USER_BRAND,
  BRAND_MATCH_USER_BRAND_GENERIC_FOOD,
  BRAND_WEIGHT,
  MACRO_CONS_HARD_PENALTY_VALUE,
  MACRO_CONS_LIGHT_PENALTY_PCT,
  MACRO_CONS_LIGHT_PENALTY_VALUE,
  MACRO_CONS_NO_PENALTY_PCT,
  MACRO_CONS_NO_PENALTY_VALUE,
  MACRO_CONS_UNKNOWN_VALUE,
  NAME_WEIGHT,
  NUTRIENT_CARBS,
  NUTRIENT_FAT,
  NUTRIENT_FIBER,
  NUTRIENT_KCAL,
  NUTRIENT_PROTEIN,
  NUTRIENT_SUGARS,
  OFF_PRODUCT_URL,
  USDA_SEARCH_URL,
  USER_AGENT,
  confidenceLabel,
  type ConfidenceLabel,
} from './constants'

// ---------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------

export interface FoodMacros {
  kcal: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  sugars_g?: number | null
  fiber_g?: number | null
}

export interface FoodPerUserServing {
  user_serving_g: number
  user_serving_unit: string
  user_serving_amount: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface FoodSearchResult {
  id: string                  // "usda:<fdcId>" or "off:<upc>"
  name: string
  brand: string | null
  source: string              // "usda_branded" | "usda_sr_legacy" | ... | "off"
  gtin_upc: string | null
  serving_size_g: number | null
  serving_description: string
  household_serving: string | null
  per_100g: FoodMacros
  per_serving: FoodMacros
  per_user_serving: FoodPerUserServing | null
  match_confidence: {
    score: number
    label: ConfidenceLabel
    components: {
      name_similarity: number
      brand_match: number
      macro_consistency: number
      macro_consistency_pct_off: number
    }
    formula: string
    warnings: string[]
  }
}

export interface SearchFoodDatabaseInput {
  query: string
  brand?: string
  barcode?: string
  serving_amount?: number
  serving_unit?: string
  dataset?: 'usda_branded' | 'usda_sr_legacy' | 'usda_foundation' | 'usda_fndds' | 'off' | 'all'
  limit?: number
}

interface RawCandidate {
  _raw_brand: string | null
  id: string
  name: string
  brand: string | null
  source: string
  gtin_upc: string | null
  serving_size_g: number | null
  serving_description: string
  household_serving: string | null
  per_100g: FoodMacros
  per_serving: FoodMacros
}

const DATASET_TO_USDA: Record<string, string> = {
  usda_branded: 'Branded',
  usda_sr_legacy: 'SR Legacy',
  usda_foundation: 'Foundation',
  usda_fndds: 'Survey (FNDDS)',
}

const USDA_DATA_TYPE_TO_SOURCE: Record<string, string> = {
  Branded: 'usda_branded',
  'SR Legacy': 'usda_sr_legacy',
  Foundation: 'usda_foundation',
  'Survey (FNDDS)': 'usda_fndds',
}

// ---------------------------------------------------------------------
// Tokenization + scoring helpers
// ---------------------------------------------------------------------

function normalize(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(s: string | null | undefined): Set<string> {
  return new Set(normalize(s).split(' ').filter((t) => t.length > 0))
}

function nameSimilarity(query: string, brand: string | null | undefined, name: string): number {
  const qTokens = tokens(query)
  const bTokens = brand ? tokens(brand) : new Set<string>()
  const allQ = new Set([...qTokens, ...bTokens])
  if (allQ.size === 0) return 0
  const cand = tokens(name)
  if (cand.size === 0) return 0
  let intersection = 0
  for (const t of allQ) {
    if (cand.has(t)) intersection += 1
  }
  const coverage = intersection / allQ.size
  const precision = intersection / Math.max(cand.size, 1)
  return Math.round((0.7 * coverage + 0.3 * precision) * 1000) / 1000
}

function brandMatchScore(userBrand: string | null | undefined, foodBrand: string | null | undefined): number {
  if (!userBrand) return BRAND_MATCH_NO_USER_BRAND
  if (!foodBrand) return BRAND_MATCH_USER_BRAND_GENERIC_FOOD
  const userT = tokens(userBrand)
  const foodT = tokens(foodBrand)
  for (const t of userT) {
    if (foodT.has(t)) return BRAND_MATCH_EXACT
  }
  return BRAND_MATCH_DIFFERENT
}

function macroConsistency(perServing: FoodMacros): { score: number; pctOff: number } {
  const kcal = perServing.kcal ?? 0
  const p = perServing.protein_g ?? 0
  const c = perServing.carbs_g ?? 0
  const f = perServing.fat_g ?? 0
  if (!kcal) return { score: MACRO_CONS_UNKNOWN_VALUE, pctOff: 0 }
  const expected = 4 * p + 4 * c + 9 * f
  const pctOff = Math.abs(kcal - expected) / Math.max(kcal, 1)
  if (pctOff < MACRO_CONS_NO_PENALTY_PCT) return { score: MACRO_CONS_NO_PENALTY_VALUE, pctOff }
  if (pctOff < MACRO_CONS_LIGHT_PENALTY_PCT) return { score: MACRO_CONS_LIGHT_PENALTY_VALUE, pctOff }
  return { score: MACRO_CONS_HARD_PENALTY_VALUE, pctOff }
}

function compositeScore(opts: {
  userBrandProvided: boolean
  nameSim: number
  brandMatch: number
  macroCons: number
}): { score: number; formula: string } {
  let base: number
  let formula: string
  if (opts.userBrandProvided) {
    base = NAME_WEIGHT * opts.nameSim + BRAND_WEIGHT * opts.brandMatch
    formula = `score = (${NAME_WEIGHT} * name_similarity + ${BRAND_WEIGHT} * brand_match) * macro_consistency`
  } else {
    base = opts.nameSim
    formula = 'score = name_similarity * macro_consistency  (no user brand)'
  }
  const score = Math.round(base * opts.macroCons * 1000) / 1000
  return { score, formula }
}

// ---------------------------------------------------------------------
// Unit conversions
// ---------------------------------------------------------------------

const UNIT_TO_GRAMS: Record<string, number> = {
  g: 1, gram: 1, grams: 1,
  kg: 1000,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, pound: 453.592, pounds: 453.592,
  ml: 1,
  l: 1000,
}

function toGrams(amount: number, unit: string): number | null {
  const u = (unit || '').toLowerCase().trim()
  if (u in UNIT_TO_GRAMS) return amount * UNIT_TO_GRAMS[u]
  return null
}

// ---------------------------------------------------------------------
// USDA + OFF result mapping
// ---------------------------------------------------------------------

interface UsdaFoodNutrient {
  nutrientId?: number
  value?: number
}

interface UsdaFood {
  fdcId: number
  description?: string
  brandName?: string
  brandOwner?: string
  dataType?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  gtinUpc?: string
  foodNutrients?: UsdaFoodNutrient[]
}

function usdaFoodToCandidate(food: UsdaFood): RawCandidate {
  const nuts: Record<number, number> = {}
  for (const n of food.foodNutrients ?? []) {
    if (n.nutrientId !== undefined && n.value !== undefined) {
      nuts[n.nutrientId] = n.value
    }
  }
  const per100g: FoodMacros = {
    kcal: nuts[NUTRIENT_KCAL] ?? null,
    protein_g: nuts[NUTRIENT_PROTEIN] ?? null,
    carbs_g: nuts[NUTRIENT_CARBS] ?? null,
    fat_g: nuts[NUTRIENT_FAT] ?? null,
    sugars_g: nuts[NUTRIENT_SUGARS] ?? null,
    fiber_g: nuts[NUTRIENT_FIBER] ?? null,
  }
  const servingSize = food.servingSize
  const servingUnit = (food.servingSizeUnit ?? '').toLowerCase()
  const servingG: number = servingUnit === 'g' && servingSize ? servingSize : 100
  const scaleFromPer100g = (v: number | null) =>
    v == null ? null : Math.round(v * (servingG / 100) * 100) / 100
  const perServing: FoodMacros =
    servingUnit === 'g' && servingSize
      ? {
          kcal: scaleFromPer100g(per100g.kcal),
          protein_g: scaleFromPer100g(per100g.protein_g),
          carbs_g: scaleFromPer100g(per100g.carbs_g),
          fat_g: scaleFromPer100g(per100g.fat_g),
          sugars_g: scaleFromPer100g(per100g.sugars_g ?? null),
          fiber_g: scaleFromPer100g(per100g.fiber_g ?? null),
        }
      : { ...per100g }

  const brand = food.brandName ?? food.brandOwner ?? null
  return {
    _raw_brand: brand,
    id: `usda:${food.fdcId}`,
    name: food.description ?? '',
    brand,
    source: USDA_DATA_TYPE_TO_SOURCE[food.dataType ?? ''] ?? (food.dataType ?? ''),
    gtin_upc: food.gtinUpc ?? null,
    serving_size_g: servingG,
    serving_description:
      food.householdServingFullText ??
      (servingSize ? `${servingSize}${servingUnit}` : '100g default'),
    household_serving: food.householdServingFullText ?? null,
    per_100g: per100g,
    per_serving: perServing,
  }
}

interface OffProduct {
  product_name?: string
  product_name_en?: string
  brands?: string
  serving_size?: string
  nutriments?: Record<string, number | undefined>
}

function offProductToCandidate(prod: OffProduct, code: string): RawCandidate {
  const nutr = prod.nutriments ?? {}
  const per100g: FoodMacros = {
    kcal: nutr['energy-kcal_100g'] ?? null,
    protein_g: nutr['proteins_100g'] ?? null,
    carbs_g: nutr['carbohydrates_100g'] ?? null,
    fat_g: nutr['fat_100g'] ?? null,
    sugars_g: nutr['sugars_100g'] ?? null,
    fiber_g: nutr['fiber_100g'] ?? null,
  }
  const perServing: FoodMacros = {
    kcal: nutr['energy-kcal_serving'] ?? null,
    protein_g: nutr['proteins_serving'] ?? null,
    carbs_g: nutr['carbohydrates_serving'] ?? null,
    fat_g: nutr['fat_serving'] ?? null,
    sugars_g: nutr['sugars_serving'] ?? null,
    fiber_g: nutr['fiber_serving'] ?? null,
  }
  const servingG = nutr['serving_quantity'] ?? 100
  const brand = prod.brands ?? null
  return {
    _raw_brand: brand,
    id: `off:${code}`,
    name: prod.product_name ?? prod.product_name_en ?? '',
    brand,
    source: 'off',
    gtin_upc: code,
    serving_size_g: servingG,
    serving_description: prod.serving_size ?? `${servingG}g`,
    household_serving: prod.serving_size ?? null,
    per_100g: per100g,
    per_serving: perServing,
  }
}

// ---------------------------------------------------------------------
// HTTP backends (USDA + OFF)
// ---------------------------------------------------------------------

async function usdaSearch(query: string, dataset: string | null, limit: number): Promise<UsdaFood[]> {
  const apiKey = process.env.USDA_FDC_API_KEY
  if (!apiKey) return []
  const params = new URLSearchParams({
    query,
    pageSize: String(limit),
    api_key: apiKey,
  })
  if (dataset && dataset !== 'all') {
    const usdaDt = DATASET_TO_USDA[dataset]
    if (usdaDt) params.set('dataType', usdaDt)
  }
  try {
    const r = await fetch(`${USDA_SEARCH_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return []
    const json = (await r.json()) as { foods?: UsdaFood[] }
    return json.foods ?? []
  } catch {
    return []
  }
}

async function usdaLookupByUpc(upc: string): Promise<UsdaFood | null> {
  const apiKey = process.env.USDA_FDC_API_KEY
  if (!apiKey) return null
  const params = new URLSearchParams({
    query: `gtinUpc:"${upc}"`,
    dataType: 'Branded',
    pageSize: '1',
    api_key: apiKey,
  })
  try {
    const r = await fetch(`${USDA_SEARCH_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return null
    const json = (await r.json()) as { foods?: UsdaFood[] }
    return json.foods?.[0] ?? null
  } catch {
    return null
  }
}

async function offLookupByUpc(upc: string): Promise<OffProduct | null> {
  try {
    const url = OFF_PRODUCT_URL.replace('{barcode}', upc)
    const r = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return null
    const d = (await r.json()) as { status?: number; product?: OffProduct }
    if (d.status !== 1) return null
    return d.product ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------
// Per-user-serving scaling
// ---------------------------------------------------------------------

function perUserServing(
  cand: RawCandidate,
  servingAmount: number | undefined,
  servingUnit: string | undefined,
): FoodPerUserServing | null {
  try {
    if (!servingAmount || !servingUnit) return null
    const grams = toGrams(servingAmount, servingUnit)
    if (grams === null) return null
    const per100g = cand.per_100g
    if (!per100g.kcal) return null
    return {
      user_serving_g: Math.round(grams * 100) / 100,
      user_serving_unit: servingUnit,
      user_serving_amount: servingAmount,
      kcal: Math.round((per100g.kcal ?? 0) * grams / 100 * 100) / 100,
      protein_g: Math.round((per100g.protein_g ?? 0) * grams / 100 * 100) / 100,
      carbs_g: Math.round((per100g.carbs_g ?? 0) * grams / 100 * 100) / 100,
      fat_g: Math.round((per100g.fat_g ?? 0) * grams / 100 * 100) / 100,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------

export async function searchFoodDatabase(
  input: SearchFoodDatabaseInput,
): Promise<{ results: FoodSearchResult[] }> {
  const { query, brand, barcode, serving_amount, serving_unit } = input
  const dataset = input.dataset ?? 'all'
  const limit = input.limit ?? 5
  const userBrandProvided = Boolean(brand)
  const rawCandidates: RawCandidate[] = []

  // ---- Barcode-first path ----
  let barcodeHitId: string | null = null
  if (barcode) {
    const offProd = await offLookupByUpc(barcode)
    if (offProd) {
      const r = offProductToCandidate(offProd, barcode)
      rawCandidates.push(r)
      barcodeHitId = r.id
    }
    const usdaFood = await usdaLookupByUpc(barcode)
    if (usdaFood) {
      const r = usdaFoodToCandidate(usdaFood)
      rawCandidates.push(r)
      if (!barcodeHitId) barcodeHitId = r.id
    }
  }

  // ---- Text search path ----
  const usdaDatasets = ['usda_branded', 'usda_sr_legacy', 'usda_foundation', 'usda_fndds', 'all']
  if (usdaDatasets.includes(dataset)) {
    let usdaQuery = query
    if (brand && !usdaQuery.toLowerCase().includes(brand.toLowerCase())) {
      usdaQuery = `${brand} ${usdaQuery}`
    }
    const usdaDataset = dataset === 'all' ? null : dataset
    const usdaFoods = await usdaSearch(usdaQuery, usdaDataset, limit)
    for (const food of usdaFoods) {
      rawCandidates.push(usdaFoodToCandidate(food))
    }
  }

  // ---- Score everything ----
  const seenIds = new Set<string>()
  const scored: FoodSearchResult[] = []
  for (const cand of rawCandidates) {
    if (seenIds.has(cand.id)) continue
    seenIds.add(cand.id)

    const isBarcodeHit = cand.id === barcodeHitId
    const nameSim = isBarcodeHit ? 1.0 : nameSimilarity(query, brand, cand.name)
    const brandMatch = brandMatchScore(brand, cand._raw_brand)
    const { score: macroCons, pctOff } = macroConsistency(cand.per_serving)
    const { score, formula } = compositeScore({
      userBrandProvided,
      nameSim,
      brandMatch,
      macroCons,
    })

    const warnings: string[] = []
    if (isBarcodeHit) warnings.push('barcode_exact_match')
    if (macroCons === MACRO_CONS_HARD_PENALTY_VALUE) {
      warnings.push(`macro_math_mismatch_${Math.round(pctOff * 100)}pct`)
    } else if (macroCons === MACRO_CONS_LIGHT_PENALTY_VALUE) {
      warnings.push(`macro_math_mild_mismatch_${Math.round(pctOff * 100)}pct`)
    } else if (macroCons === MACRO_CONS_UNKNOWN_VALUE) {
      warnings.push('macro_consistency_unknown')
    }
    if (nameSim < 0.6 && !isBarcodeHit) warnings.push('low_name_similarity')
    if (userBrandProvided && brandMatch === BRAND_MATCH_DIFFERENT) {
      warnings.push(`brand_mismatch_user_specified_${normalize(brand)}`)
    }

    scored.push({
      id: cand.id,
      name: cand.name,
      brand: cand.brand,
      source: cand.source,
      gtin_upc: cand.gtin_upc,
      serving_size_g: cand.serving_size_g,
      serving_description: cand.serving_description,
      household_serving: cand.household_serving,
      per_100g: cand.per_100g,
      per_serving: cand.per_serving,
      per_user_serving: perUserServing(cand, serving_amount, serving_unit),
      match_confidence: {
        score,
        label: confidenceLabel(score),
        components: {
          name_similarity: nameSim,
          brand_match: brandMatch,
          macro_consistency: macroCons,
          macro_consistency_pct_off: Math.round(pctOff * 10000) / 10000,
        },
        formula,
        warnings,
      },
    })
  }

  scored.sort((a, b) => b.match_confidence.score - a.match_confidence.score)
  return { results: scored.slice(0, limit) }
}

// ---------- Anthropic tool schema ----------

export const SEARCH_FOOD_DATABASE_TOOL: Tool = {
  name: 'search_food_database',
  description:
    'Search USDA FoodData Central and Open Food Facts for a food. Returns ' +
    'ranked candidates with per-100g and per-serving macros, plus a composite ' +
    'match_confidence that combines name similarity, brand presence, and ' +
    'internal macro-math consistency (kcal vs 4P+4C+9F). Always provide a ' +
    'barcode if available — barcode lookups short-circuit to exact-product ' +
    'matching. Use this AFTER search_user_library has been tried for items ' +
    'that might be recurring meals.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: "Food name to search, e.g. 'cheddar cheese'.",
      },
      brand: {
        type: 'string',
        description:
          "Brand name if mentioned (e.g. 'Yasso'). When provided, used both " +
          'as query refinement and as a brand-match signal.',
      },
      barcode: {
        type: 'string',
        description: 'UPC/EAN if scanned. Triggers barcode-first lookup.',
      },
      serving_amount: {
        type: 'number',
        description: 'User-specified serving amount, e.g. 10 (for 10oz).',
      },
      serving_unit: {
        type: 'string',
        description:
          "Unit for serving_amount, e.g. 'g', 'oz'. Only weight/volume units " +
          "are auto-converted; for 'cup', 'slice', 'medium', etc. caller must " +
          'scale manually.',
      },
      dataset: {
        type: 'string',
        enum: ['usda_branded', 'usda_sr_legacy', 'usda_foundation', 'usda_fndds', 'off', 'all'],
        default: 'all',
      },
      limit: {
        type: 'integer',
        default: 5,
        minimum: 1,
        maximum: 20,
      },
    },
    required: ['query'],
  },
}
