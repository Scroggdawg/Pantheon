import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { normalizeFoodText } from '../lib/pantry-builder/normalize'

const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'
const USDA_DETAIL_URL = 'https://api.nal.usda.gov/fdc/v1/food'
const USER_AGENT = 'Pantheon/1.0 (luke@scrog.dev)'
const NUTRIENT_KCAL = 1008
const NUTRIENT_PROTEIN = 1003
const NUTRIENT_FAT = 1004
const NUTRIENT_CARBS = 1005
const MATCH_STOP_TOKENS = new Set([
  'organic',
  'gluten',
  'free',
  'premium',
  'classic',
  'original',
  'the',
  'with',
  'and',
  'drink',
  'drinks',
])
const REQUIRED_IF_PRESENT_TOKENS = new Set([
  'apple',
  'orange',
  'pulp',
  'hazelnut',
  'peanut',
  'banana',
  'blackberry',
  'pineapple',
  'mango',
  'sorbet',
  'creatine',
  'bcaas',
  'sour',
  'grape',
  'avocado',
  'greens',
  'maca',
  'mocha',
  'bluephoria',
])
const EXTRA_VARIANT_TOKENS = new Set([
  'fajita',
  'honey',
  'chipotle',
  'baked',
  'scoops',
  'scoop',
  'restaurant',
])

type Lane = 'packaged-beverages' | 'condiments-sauces' | 'snacks-bread'

interface Args {
  csv: string
  lane: Lane
  limit: number
  candidates: number
}

interface InstacartItem {
  itemName: string
  brand: string
  sizeVolume: string
  category: string
}

interface ProductRow {
  name: string
}

interface AliasRow {
  normalized_alias: string
}

interface UsdaNutrient {
  nutrientId?: number
  value?: number
  amount?: number
  nutrient?: {
    id?: number
  }
  foodNutrientDerivation?: {
    code?: string
  }
}

interface UsdaFood {
  fdcId?: number
  description?: string
  dataType?: string
  brandName?: string
  brandOwner?: string
  gtinUpc?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients?: UsdaNutrient[]
}

interface UsdaSearchResponse {
  foods?: UsdaFood[]
}

interface CandidateScore {
  candidate: UsdaFood
  score: number
  warnings: string[]
  servingGrams: number | null
  servingUnit: string
  macroMode: string | null
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}

interface PilotResult {
  item: InstacartItem
  searchQuery: string
  candidates: CandidateScore[]
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    csv: '/Users/scroggdawg/Downloads/instacart_food_items.csv',
    lane: 'packaged-beverages',
    limit: 20,
    candidates: 5,
  }
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--csv=')) args.csv = arg.slice('--csv='.length)
    else if (arg === '--lane=packaged-beverages') args.lane = 'packaged-beverages'
    else if (arg === '--lane=condiments-sauces') args.lane = 'condiments-sauces'
    else if (arg === '--lane=snacks-bread') args.lane = 'snacks-bread'
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length))
    else if (arg.startsWith('--candidates=')) args.candidates = Number(arg.slice('--candidates='.length))
    else throw new Error(`Unknown arg: ${arg}`)
  }
  if (!Number.isInteger(args.limit) || args.limit < 1) throw new Error('--limit must be a positive integer')
  if (!Number.isInteger(args.candidates) || args.candidates < 1 || args.candidates > 10) {
    throw new Error('--candidates must be an integer from 1 to 10')
  }
  return args
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

function supabaseFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]
    const next = content[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (char === '"') quoted = false
      else field += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') field += char
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((csvRow) => csvRow.some((value) => value.trim().length > 0))
}

function loadInstacartItems(path: string): InstacartItem[] {
  const rows = parseCsv(readFileSync(resolve(path), 'utf8'))
  const header = rows.shift()
  if (!header || normalizeFoodText(header[0]) !== 'item name') throw new Error('Unexpected Instacart CSV header')
  return rows.map((row) => ({
    itemName: row[0]?.trim() ?? '',
    brand: row[1]?.trim() ?? '',
    sizeVolume: row[2]?.trim() ?? '',
    category: row[3]?.trim() ?? '',
  })).filter((item) => item.itemName.length > 0)
}

function itemNameWithoutBrand(item: InstacartItem): string {
  const brandNorm = normalizeFoodText(item.brand)
  const nameNorm = normalizeFoodText(item.itemName)
  if (!brandNorm || !nameNorm.startsWith(brandNorm)) return item.itemName
  return item.itemName.split(/\s+/).slice(brandNorm.split(' ').length).join(' ').trim() || item.itemName
}

function searchQuery(item: InstacartItem): string {
  return [item.brand, itemNameWithoutBrand(item)]
    .filter(Boolean)
    .join(' ')
    .replace(/\bOrganic\b/gi, '')
    .replace(/\bGluten Free\b/gi, '')
    .replace(/\bDairy Free\b/gi, '')
    .replace(/\bLess Sodium\b/gi, 'Reduced Sodium')
    .replace(/\s+/g, ' ')
    .trim()
}

function isPackagedBeverage(item: InstacartItem): boolean {
  if (item.category.toLowerCase() !== 'beverages') return false
  if (!item.brand.trim()) return false
  const normalized = normalizeFoodText(`${item.brand} ${item.itemName}`)
  if (/\b(whole bean|ground coffee|tea bags|herbal tea|throat coat|peppermint caffeine free)\b/.test(normalized)) return false
  return /\b(yerba|mate|rebbl|protein|coconut water|soda|diet coke|dr pepper|pressed|smoothie|fitaid|juice|almond milk|sparkling cider|sprite|lacroix|water|energy|recovery)\b/.test(normalized)
}

function isCondimentSauce(item: InstacartItem): boolean {
  const category = item.category.toLowerCase()
  const normalized = normalizeFoodText(`${item.brand} ${item.itemName}`)
  if (!['condiments & sauces', 'canned goods'].includes(category)) return false
  if (/\b(soup|sushi ginger)\b/.test(normalized)) return false
  return /\b(sauce|dressing|vinegar|soy sauce|fish sauce|worcestershire|tomato paste|pasta sauce|barbecue|bbq|catalina)\b/.test(normalized)
}

function isLaneItem(item: InstacartItem, lane: Lane): boolean {
  if (lane === 'packaged-beverages') return isPackagedBeverage(item)
  if (lane === 'condiments-sauces') return isCondimentSauce(item)
  return isSnackBread(item)
}

function isSnackBread(item: InstacartItem): boolean {
  const category = item.category.toLowerCase()
  if (!['snacks', 'bakery & bread', 'breakfast'].includes(category)) return false
  if (!item.brand.trim()) return false
  const normalized = normalizeFoodText(`${item.brand} ${item.itemName}`)
  if (/\b(protein energy bites|rxbar)\b/.test(normalized)) return false
  return /\b(chips|tortilla|scoops|cantina|cereal|bagel|bread|cracker|fritos|tostitos|magic spoon|kashi|cracklin)\b/.test(normalized)
}

function nutrient(food: UsdaFood, id: number): number | null {
  const row = food.foodNutrients?.find((entry) => (entry.nutrientId ?? entry.nutrient?.id) === id)
  const value = row?.value ?? row?.amount
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function nutrientDerivation(food: UsdaFood, id: number): string | null {
  const row = food.foodNutrients?.find((entry) => (entry.nutrientId ?? entry.nutrient?.id) === id)
  return row?.foodNutrientDerivation?.code ?? null
}

function servingGrams(food: UsdaFood): number | null {
  const size = food.servingSize
  const unit = food.servingSizeUnit?.toLowerCase()
  if (!size || size <= 0) return null
  if (unit === 'g' || unit === 'ml') return Math.round(size * 100) / 100
  return null
}

function servingUnit(food: UsdaFood, item: InstacartItem): string {
  const household = normalizeFoodText(food.householdServingFullText ?? '')
  if (household.includes('bottle')) return 'bottle'
  if (household.includes('can')) return 'can'
  if (household.includes('tbsp')) return 'tbsp'
  if (household.includes('tablespoon')) return 'tbsp'
  if (household.includes('tsp')) return 'tsp'
  if (item.category.toLowerCase() === 'beverages') return 'serving'
  return 'serving'
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function macroCalories(protein: number, carbs: number, fat: number) {
  return protein * 4 + carbs * 4 + fat * 9
}

function resolveServingMacros(food: UsdaFood): {
  mode: string | null
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  warnings: string[]
} {
  const grams = servingGrams(food)
  const energy = nutrient(food, NUTRIENT_KCAL)
  const protein = nutrient(food, NUTRIENT_PROTEIN)
  const carbs = nutrient(food, NUTRIENT_CARBS)
  const fat = nutrient(food, NUTRIENT_FAT)
  if (grams === null || energy === null || protein === null || carbs === null || fat === null) {
    return { mode: null, kcal: null, protein: null, carbs: null, fat: null, warnings: ['incomplete_macros'] }
  }

  const scale = grams / 100
  const scaled = {
    mode: 'scaled_all',
    kcal: round2(energy * scale),
    protein: round2(protein * scale),
    carbs: round2(carbs * scale),
    fat: round2(fat * scale),
  }
  const mixed = {
    mode: 'scaled_energy_unscaled_macros',
    kcal: scaled.kcal,
    protein: round2(protein),
    carbs: round2(carbs),
    fat: round2(fat),
  }
  const unscaled = {
    mode: 'unscaled_all',
    kcal: round2(energy),
    protein: round2(protein),
    carbs: round2(carbs),
    fat: round2(fat),
  }
  const modes = [scaled, mixed, unscaled].map((mode) => ({
    ...mode,
    gap: Math.abs(macroCalories(mode.protein, mode.carbs, mode.fat) - mode.kcal),
  }))
  const scaledMode = modes.find((mode) => mode.mode === 'scaled_all')!
  const unscaledMode = modes.find((mode) => mode.mode === 'unscaled_all')!
  const mixedMode = modes.find((mode) => mode.mode === 'scaled_energy_unscaled_macros')!
  const scaledTolerance = Math.max(20, scaledMode.kcal * 0.25)
  const derivations = [
    nutrientDerivation(food, NUTRIENT_KCAL),
    nutrientDerivation(food, NUTRIENT_PROTEIN),
    nutrientDerivation(food, NUTRIENT_CARBS),
    nutrientDerivation(food, NUTRIENT_FAT),
  ]
  const hasServingDerivedNutrients = derivations.some((code) => code === 'LCCS' || code === 'LCCD')
  const unscaledTolerance = Math.max(20, unscaledMode.kcal * 0.25)
  const best = !hasServingDerivedNutrients && unscaledMode.gap <= unscaledTolerance
    && !(grams <= 100 && unscaledMode.kcal > 300 && scaledMode.gap <= scaledTolerance)
    ? unscaledMode
    : !hasServingDerivedNutrients && mixedMode.gap <= Math.max(20, mixedMode.kcal * 0.25)
      ? mixedMode
      : scaledMode.gap <= scaledTolerance
    ? scaledMode
    : modes.sort((a, b) => a.gap - b.gap)[0]
  const tolerance = Math.max(20, best.kcal * 0.25)
  if (best.gap > tolerance) {
    return {
      mode: best.mode,
      kcal: best.kcal,
      protein: best.protein,
      carbs: best.carbs,
      fat: best.fat,
      warnings: [`macro_energy_gap_${Math.round(best.gap)}`],
    }
  }
  return {
    mode: best.mode,
    kcal: best.kcal,
    protein: best.protein,
    carbs: best.carbs,
    fat: best.fat,
    warnings: best.mode === 'scaled_all' ? [] : [`macro_mode_${best.mode}`],
  }
}

function scoreCandidate(item: InstacartItem, candidate: UsdaFood, index: number): CandidateScore {
  const warnings: string[] = []
  const itemNorm = normalizeFoodText(`${item.brand} ${item.itemName}`)
  const descNorm = normalizeFoodText(candidate.description ?? '')
  const brandNorm = normalizeFoodText(`${candidate.brandName ?? ''} ${candidate.brandOwner ?? ''}`)
  const expectedBrand = normalizeFoodText(item.brand)
  let score = 0

  if (candidate.dataType === 'Branded') score += 2
  else warnings.push('not_branded')
  if (expectedBrand && brandNorm.includes(expectedBrand)) score += 4
  else warnings.push('brand_mismatch')

  const brandTokens = new Set(normalizeFoodText(item.brand).split(' '))
  const tokens = itemNorm
    .split(' ')
    .filter((token) => token.length > 2 && !brandTokens.has(token) && !MATCH_STOP_TOKENS.has(token))
  const descTokens = new Set(descNorm.split(' '))
  const overlap = tokens.filter((token) => descTokens.has(token)).length
  score += Math.min(4, overlap * 0.6)
  const missingCore = tokens.filter((token) => !descTokens.has(token))
  if (tokens.length > 0 && missingCore.length / tokens.length > 0.34) {
    warnings.push(`missing_core_tokens:${missingCore.join('+')}`)
    score -= 4
  }
  const missingRequired = tokens.filter((token) => REQUIRED_IF_PRESENT_TOKENS.has(token) && !descTokens.has(token))
  if (missingRequired.length > 0) {
    warnings.push(`missing_required_tokens:${missingRequired.join('+')}`)
    score -= 6
  }
  if (itemNorm.includes('zero sugar') && !descNorm.includes('zero sugar')) {
    warnings.push('zero_sugar_missing')
    score -= 6
  }
  if (itemNorm.includes('reduced sodium') && !descNorm.includes('reduced sodium')) {
    warnings.push('reduced_sodium_missing')
    score -= 4
  }
  const targetTokenSet = new Set(tokens)
  const extraVariants = [...descTokens].filter((token) => EXTRA_VARIANT_TOKENS.has(token) && !targetTokenSet.has(token))
  if (extraVariants.length > 0) {
    warnings.push(`extra_variant_tokens:${extraVariants.join('+')}`)
    score -= 5
  }

  const grams = servingGrams(candidate)
  if (grams) score += 1
  else warnings.push('missing_serving_size')
  if (candidate.gtinUpc) score += 1
  else warnings.push('missing_upc')

  const resolved = resolveServingMacros(candidate)
  const kcal = resolved.kcal
  const protein = resolved.protein
  const carbs = resolved.carbs
  const fat = resolved.fat
  warnings.push(...resolved.warnings.filter((warning) => warning !== 'incomplete_macros' && !warning.startsWith('macro_mode_')))
  const complete = kcal !== null && protein !== null && carbs !== null && fat !== null
  const zeroDrink = complete && item.category.toLowerCase() === 'beverages' && kcal === 0 && protein === 0 && carbs === 0 && fat === 0
  if ((complete && kcal > 0) || zeroDrink) score += 3
  else warnings.push('incomplete_macros')

  score -= index * 0.05
  return {
    candidate,
    score: Math.round(score * 100) / 100,
    warnings,
    servingGrams: grams,
    servingUnit: servingUnit(candidate, item),
    macroMode: resolved.mode,
    kcal,
    protein,
    carbs,
    fat,
  }
}

async function usdaSearchBranded(query: string, limit: number): Promise<UsdaFood[]> {
  const apiKey = process.env.USDA_FDC_API_KEY
  if (!apiKey) throw new Error('USDA_FDC_API_KEY missing from env')
  const params = new URLSearchParams({
    query,
    pageSize: String(Math.max(1, Math.min(25, limit))),
    dataType: 'Branded',
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

async function usdaDetail(fdcId: number): Promise<UsdaFood | null> {
  const apiKey = process.env.USDA_FDC_API_KEY
  if (!apiKey) throw new Error('USDA_FDC_API_KEY missing from env')
  const res = await fetch(`${USDA_DETAIL_URL}/${fdcId}?api_key=${encodeURIComponent(apiKey)}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return null
  return (await res.json()) as UsdaFood
}

function renderMarkdown(results: PilotResult[], args: Args) {
  const ready = results.filter((result) => {
    const best = result.candidates[0]
    return best && best.score >= 9 && best.warnings.length === 0
  })
  const lines = [
    '# Instacart USDA Branded Pilot Dry Run',
    '',
    `lane: ${args.lane}`,
    `source_csv: ${resolve(args.csv)}`,
    `items_searched: ${results.length}`,
    `ready_exact_candidates: ${ready.length}`,
    `needs_manual_review: ${results.length - ready.length}`,
    '',
    'No pantry/product rows were written.',
    '',
  ]
  for (const result of results) {
    lines.push(`## ${result.item.itemName}`, '')
    lines.push(`- instacart_brand: ${result.item.brand || '(none)'}`)
    lines.push(`- search_query: ${result.searchQuery}`)
    if (result.candidates.length === 0) {
      lines.push('- candidates: none', '')
      continue
    }
    lines.push('', '| rank | score | USDA description | brand | fdc_id | upc | serving | kcal | P | C | F | warnings |')
    lines.push('| --- | ---: | --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- |')
    result.candidates.forEach((candidate, index) => {
      const c = candidate.candidate
      lines.push([
        `| ${index + 1}`,
        candidate.score.toFixed(2),
        c.description ?? '',
        c.brandName ?? c.brandOwner ?? '',
        c.fdcId ?? '',
        c.gtinUpc ?? '',
        `${candidate.servingUnit}${candidate.servingGrams ? `; ${candidate.servingGrams}g` : ''}${candidate.macroMode ? `; ${candidate.macroMode}` : ''}`,
        candidate.kcal ?? '',
        candidate.protein ?? '',
        candidate.carbs ?? '',
        candidate.fat ?? '',
        candidate.warnings.length ? candidate.warnings.join(', ') : 'clean',
      ].join(' | ') + ' |')
    })
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv)
  const supabase = supabaseFromEnv()
  const items = loadInstacartItems(args.csv)
  const [{ data: productsData, error: productsError }, { data: aliasesData, error: aliasesError }] = await Promise.all([
    supabase.from('products').select('name'),
    supabase.from('food_identity_aliases').select('normalized_alias').eq('active', true),
  ])
  if (productsError) throw productsError
  if (aliasesError) throw aliasesError

  const productNames = new Set(((productsData ?? []) as ProductRow[]).map((product) => normalizeFoodText(product.name)))
  const aliasNames = new Set(((aliasesData ?? []) as AliasRow[]).map((alias) => alias.normalized_alias))
  const pilotItems = items
    .filter((item) => {
      const normalized = normalizeFoodText(item.itemName)
      return !productNames.has(normalized) && !aliasNames.has(normalized)
    })
    .filter((item) => isLaneItem(item, args.lane))
    .slice(0, args.limit)

  const results: PilotResult[] = []
  for (const item of pilotItems) {
    const query = searchQuery(item)
    const searchCandidates = await usdaSearchBranded(query, args.candidates)
    const candidates = await Promise.all(
      searchCandidates.map(async (candidate) => {
        if (!candidate.fdcId) return candidate
        return (await usdaDetail(candidate.fdcId)) ?? candidate
      }),
    )
    results.push({
      item,
      searchQuery: query,
      candidates: candidates.map((candidate, index) => scoreCandidate(item, candidate, index)).sort((a, b) => b.score - a.score),
    })
  }

  mkdirSync(join(__dirname, 'output'), { recursive: true })
  const runId = randomUUID()
  const base = join(__dirname, 'output', `instacart-usda-branded-pilot-${runId}`)
  writeFileSync(`${base}.json`, JSON.stringify({ runId, args, results }, null, 2))
  writeFileSync(`${base}.md`, renderMarkdown(results, args))
  console.log('# Instacart USDA Branded Pilot')
  console.log(`run_id: ${runId}`)
  console.log(`items_searched: ${results.length}`)
  console.log(`json: ${base}.json`)
  console.log(`markdown: ${base}.md`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
