import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { normalizeFoodText } from '../lib/pantry-builder/normalize'

const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'
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

type Lane = 'packaged-beverages' | 'condiments-sauces'

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
  return isCondimentSauce(item)
}

function nutrient(food: UsdaFood, id: number): number | null {
  const row = food.foodNutrients?.find((entry) => entry.nutrientId === id)
  return typeof row?.value === 'number' && Number.isFinite(row.value) ? row.value : null
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

function perServing(food: UsdaFood, id: number): number | null {
  const per100 = nutrient(food, id)
  const grams = servingGrams(food)
  if (per100 === null || grams === null) return null
  return Math.round((per100 * grams) / 100 * 100) / 100
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
  if (itemNorm.includes('zero sugar') && !descNorm.includes('zero sugar')) {
    warnings.push('zero_sugar_missing')
    score -= 6
  }
  if (itemNorm.includes('reduced sodium') && !descNorm.includes('reduced sodium')) {
    warnings.push('reduced_sodium_missing')
    score -= 4
  }

  const grams = servingGrams(candidate)
  if (grams) score += 1
  else warnings.push('missing_serving_size')
  if (candidate.gtinUpc) score += 1
  else warnings.push('missing_upc')

  const kcal = perServing(candidate, NUTRIENT_KCAL)
  const protein = perServing(candidate, NUTRIENT_PROTEIN)
  const carbs = perServing(candidate, NUTRIENT_CARBS)
  const fat = perServing(candidate, NUTRIENT_FAT)
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
        `${candidate.servingUnit}${candidate.servingGrams ? `; ${candidate.servingGrams}g` : ''}`,
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
    const candidates = await usdaSearchBranded(query, args.candidates)
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
