import type { UnitAlternative } from '@/types/database'

import { candidateKey, normalizeFoodText, simpleAliases } from './normalize'
import { withStandardUnits } from './units'
import type { PantryCandidate, PantryCategory, PantryProfile, PantryTarget } from './types'

const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'
const USER_AGENT = 'Pantheon/1.0 (Autonomous Pantry Builder)'

const NUTRIENT_KCAL = 1008
const NUTRIENT_KCAL_ATWATER_SPECIFIC = 2048
const NUTRIENT_KCAL_ATWATER_GENERAL = 2047
const NUTRIENT_PROTEIN = 1003
const NUTRIENT_CARBS = 1005
const NUTRIENT_FAT = 1004
const NUTRIENT_FIBER = 1079

const STATE_MODIFIERS = [
  'babyfood',
  'bbq',
  'bake',
  'beef bacon',
  'breast',
  'bread',
  'canned',
  'cake',
  'chip',
  'chips',
  'cooked',
  'croissant',
  'croissants',
  'dehydrated',
  'dried',
  'drumstick',
  'dry',
  'flour',
  'florida',
  'frozen',
  'hopi',
  'juice',
  'mission',
  'mix',
  'nugget',
  'nuggets',
  'overripe',
  'pastry',
  'peel',
  'pickled',
  'pie',
  'powder',
  'powdered',
  'prepackaged',
  'refrigerated',
  'restaurant',
  'salad',
  'sauce',
  'scampi',
  'sliced',
  'strawberry',
  'strudel',
  'stew',
  'sweetened',
  'syrup',
  'thigh',
  'topping',
  'sprouted',
  'wing',
]

const TARGET_STOP_TOKENS = new Set([
  'and',
  'cooked',
  'fat',
  'fresh',
  'large',
  'lean',
  'low',
  'medium',
  'nonfat',
  'raw',
  'with',
  'without',
])

interface UsdaFoodNutrient {
  nutrientId?: number
  value?: number
}

interface UsdaSearchFood {
  fdcId?: number
  description?: string
  dataType?: string
  brandName?: string
  brandOwner?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients?: UsdaFoodNutrient[]
}

interface UsdaSearchResponse {
  foods?: UsdaSearchFood[]
}

export function targetsFromProfile(profile: PantryProfile, limit: number | null): PantryTarget[] {
  const targets: PantryTarget[] = []
  for (const [category, queries] of Object.entries(profile.categories) as Array<[PantryCategory, string[]]>) {
    for (const query of queries) {
      const normalized = normalizeFoodText(query)
      if (profile.already_covered.some((covered) => normalizeFoodText(covered) === normalized)) continue
      targets.push({
        query,
        category,
        reviewOnly: profile.review_only_patterns.some((pattern) => normalized.includes(normalizeFoodText(pattern))),
      })
    }
  }
  return limit == null ? targets : targets.slice(0, limit)
}

async function usdaSearch(query: string, dataType: string, apiKey: string): Promise<UsdaSearchFood[]> {
  const params = new URLSearchParams({
    query,
    pageSize: '5',
    dataType,
    api_key: apiKey,
  })
  const res = await fetch(`${USDA_SEARCH_URL}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return []
  const json = (await res.json()) as UsdaSearchResponse
  return json.foods ?? []
}

function nutrient(food: UsdaSearchFood, id: number): number | null {
  const row = (food.foodNutrients ?? []).find((n) => n.nutrientId === id)
  return typeof row?.value === 'number' ? row.value : null
}

function kcal(food: UsdaSearchFood): number | null {
  return (
    nutrient(food, NUTRIENT_KCAL) ??
    nutrient(food, NUTRIENT_KCAL_ATWATER_SPECIFIC) ??
    nutrient(food, NUTRIENT_KCAL_ATWATER_GENERAL)
  )
}

function hasRequiredMacros(food: UsdaSearchFood): boolean {
  return (
    kcal(food) != null &&
    nutrient(food, NUTRIENT_PROTEIN) != null &&
    nutrient(food, NUTRIENT_CARBS) != null &&
    nutrient(food, NUTRIENT_FAT) != null
  )
}

function singularize(token: string): string {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`
  if (token.endsWith('es') && token.length > 4) return token.slice(0, -2)
  if (token.endsWith('s') && token.length > 4) return token.slice(0, -1)
  return token
}

function importantTokens(value: string): string[] {
  return normalizeFoodText(value)
    .split(' ')
    .map(singularize)
    .filter((token) => token.length > 2 && !TARGET_STOP_TOKENS.has(token))
}

function stateModifierMismatch(query: string, description: string | undefined): string[] {
  const q = normalizeFoodText(query)
  const desc = normalizeFoodText(description)
  const mismatches = STATE_MODIFIERS.filter((term) => desc.includes(term) && !q.includes(term))
  if (q.includes('cooked') && desc.includes('raw')) mismatches.push('raw_when_cooked_requested')
  return mismatches
}

function targetTokenCoverage(query: string, description: string | undefined): number {
  const targetTokens = importantTokens(query)
  if (targetTokens.length === 0) return 1
  const descTokens = new Set(importantTokens(description ?? ''))
  const hits = targetTokens.filter((token) => descTokens.has(token)).length
  return hits / targetTokens.length
}

function primaryTargetStartsDescription(query: string, description: string | undefined): boolean {
  const targetTokens = importantTokens(query)
  if (targetTokens.length !== 1) return true
  const descTokens = importantTokens(description ?? '')
  return descTokens[0] === targetTokens[0]
}

function rankFood(query: string, food: UsdaSearchFood): number {
  const q = normalizeFoodText(query)
  const desc = normalizeFoodText(food.description)
  let score = 0
  if (desc === q) score += 100
  if (desc.startsWith(q)) score += 35
  if (q.split(' ').every((token) => desc.includes(token))) score += 20
  if (desc.includes('raw') && !q.includes('cooked')) score += 8
  if (food.dataType === 'Foundation') score += 10
  if (food.dataType === 'Survey (FNDDS)') score += 8
  if (food.dataType === 'SR Legacy') score += 5
  if (!hasRequiredMacros(food)) score -= 50
  score -= (1 - targetTokenCoverage(query, food.description)) * 80
  if (!primaryTargetStartsDescription(query, food.description)) score -= 80
  score -= stateModifierMismatch(query, food.description).length * 40
  score -= Math.max(0, desc.length - q.length) / 20
  return score
}

export async function fetchBestUsdaCoreFood(query: string): Promise<UsdaSearchFood | null> {
  const apiKey = process.env.USDA_FDC_API_KEY
  if (!apiKey) throw new Error('USDA_FDC_API_KEY missing from env')

  const batches = await Promise.all([
    usdaSearch(query, 'Foundation', apiKey),
    usdaSearch(query, 'Survey (FNDDS)', apiKey),
    usdaSearch(query, 'SR Legacy', apiKey),
  ])
  const foods = batches.flat().filter((food) => food.fdcId && food.description)
  if (foods.length === 0) return null
  return [...foods].sort((a, b) => rankFood(query, b) - rankFood(query, a))[0] ?? null
}

export function candidateFromUsdaFood(
  target: PantryTarget,
  food: UsdaSearchFood,
  profile: PantryProfile,
  portions: UnitAlternative[],
  sourceRelease: string | null,
): PantryCandidate | null {
  const calories = kcal(food)
  const protein = nutrient(food, NUTRIENT_PROTEIN)
  const carbs = nutrient(food, NUTRIENT_CARBS)
  const fat = nutrient(food, NUTRIENT_FAT)
  if (calories == null || protein == null || carbs == null || fat == null) return null

  const displayName = food.description ?? target.query
  const unitAlternatives = withStandardUnits(portions, profile.count_unit_grams, target.query)
  const now = new Date().toISOString()
  const aliases = [...new Set([...simpleAliases(target.query), ...simpleAliases(displayName)])]
  const descriptorMismatches = stateModifierMismatch(target.query, displayName)
  const coverage = targetTokenCoverage(target.query, displayName)
  const coverageReasons = coverage < 0.67 ? [`low_target_token_coverage_${Math.round(coverage * 100)}`] : []
  const primaryReasons = primaryTargetStartsDescription(target.query, displayName)
    ? []
    : ['single_token_secondary_match_review_required']
  const brandReasons =
    food.brandName || food.brandOwner
      ? ['branded_usda_candidate_review_required']
      : /\b(?!NFS\b)[A-Z]{4,}\b/.test(displayName)
        ? ['brand_like_name_token_review_required']
        : []
  const reviewReasons = [
    ...(target.reviewOnly ? ['profile_review_only'] : []),
    ...descriptorMismatches.map((term) => `state_modifier_mismatch_${term}`),
    ...coverageReasons,
    ...primaryReasons,
    ...brandReasons,
  ]

  const candidate: PantryCandidate = {
    candidate_key: candidateKey(['usda', food.dataType, food.fdcId, target.category]),
    target_query: target.query,
    normalized_name: normalizeFoodText(displayName),
    display_name: displayName,
    source_kind: 'usda',
    source_dataset: food.dataType ?? null,
    external_id: food.fdcId ? String(food.fdcId) : null,
    source_release: sourceRelease,
    category: target.category,
    proposed_product: {
      name: displayName,
      brand: food.brandName ?? food.brandOwner ?? null,
      unit: '100 g',
      serving_size_g: 100,
      calories_per_serving: Math.round(calories * 100) / 100,
      protein_g_per_serving: Math.round(protein * 100) / 100,
      carbs_g_per_serving: Math.round(carbs * 100) / 100,
      fat_g_per_serving: Math.round(fat * 100) / 100,
      fiber_g_per_serving: nutrient(food, NUTRIENT_FIBER),
      fulfillment_source: 'manual',
      barcode: null,
      product_url: null,
      notes: `Autonomous Pantry Builder candidate for "${target.query}".`,
      tracks_inventory: false,
      servings_per_unit: null,
      unit_alternatives: unitAlternatives,
      fdc_id: food.fdcId ?? null,
      unit_alternatives_updated_at: now,
      provenance_source_kind: 'usda',
      provenance_dataset: food.dataType ?? null,
      provenance_external_id: food.fdcId ? String(food.fdcId) : null,
      provenance_release: sourceRelease,
      import_confidence: food.dataType === 'SR Legacy' ? 'medium' : 'high',
      canonical_category: target.category,
    },
    aliases,
    rejected_aliases: [],
    unit_alternatives: unitAlternatives,
    risk_score: reviewReasons.length > 0 ? 20 : 0,
    decision: reviewReasons.length > 0 ? 'review_required' : 'auto_approved',
    reasons: reviewReasons,
  }

  return candidate
}
