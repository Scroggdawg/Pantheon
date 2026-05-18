import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'

import { normalizeFoodText } from '../lib/pantry-builder/normalize'
import { offTextSearch, parseUnitFromServingSize } from '../lib/off/search'
import type { OffProduct } from '../lib/off/types'

interface Args {
  csv: string
  limit: number
  candidates: number
  lane: 'frozen-desserts'
}

interface InstacartItem {
  itemName: string
  brand: string
  sizeVolume: string
  category: string
}

interface ProductRow {
  id: string
  name: string
}

interface AliasRow {
  normalized_alias: string
}

interface CandidateScore {
  candidate: OffProduct
  score: number
  warnings: string[]
  servingUnit: string
  servingGrams: number | null
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
    limit: 15,
    candidates: 5,
    lane: 'frozen-desserts',
  }
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--csv=')) args.csv = arg.slice('--csv='.length)
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length))
    else if (arg.startsWith('--candidates=')) args.candidates = Number(arg.slice('--candidates='.length))
    else if (arg === '--lane=frozen-desserts') args.lane = 'frozen-desserts'
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
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
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
    } else if (char !== '\r') {
      field += char
    }
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
  if (!header || normalizeFoodText(header[0]) !== 'item name') {
    throw new Error('Unexpected Instacart CSV header')
  }
  return rows.map((row) => ({
    itemName: row[0]?.trim() ?? '',
    brand: row[1]?.trim() ?? '',
    sizeVolume: row[2]?.trim() ?? '',
    category: row[3]?.trim() ?? '',
  })).filter((item) => item.itemName.length > 0)
}

function isFrozenDessertPilotItem(item: InstacartItem): boolean {
  if (item.category.toLowerCase() !== 'frozen') return false
  const normalized = normalizeFoodText(`${item.brand} ${item.itemName}`)
  if (/\b(reddy ice|rice|vegetable|fruit|acai bowl|breakfast|pizza|meal|sausage|egg|cheddar|biscuit|burrito|frittata|chicken)\b/.test(normalized)) return false
  return /\b(yasso|ben jerrys|van leeuwen|goodpop|aldens|ice cream|frozen dairy dessert|fudge|sandwich|bar|bars|pop|pops)\b/.test(normalized)
}

function itemNameWithoutBrand(item: InstacartItem): string {
  const brand = item.brand.trim()
  const name = item.itemName.trim()
  if (!brand) return name
  const brandNorm = normalizeFoodText(brand)
  const nameNorm = normalizeFoodText(name)
  if (!nameNorm.startsWith(brandNorm)) return name

  const brandWords = brandNorm.split(' ').length
  return name.split(/\s+/).slice(brandWords).join(' ').trim() || name
}

function searchQueries(item: InstacartItem): string[] {
  const base = itemNameWithoutBrand(item)
  const simplified = base
    .replace(/\bFrozen\b/gi, '')
    .replace(/\bGreek Yogurt\b/gi, 'Yogurt')
    .replace(/\bDairy-Free\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return [...new Set([base, simplified].filter(Boolean))]
}

function macroFromOff(candidate: OffProduct, key: 'energy-kcal' | 'proteins' | 'carbohydrates' | 'fat'): number | null {
  const n = candidate.nutriments ?? {}
  const servingKey = `${key}_serving` as keyof typeof n
  const per100Key = `${key}_100g` as keyof typeof n
  const servingValue = n[servingKey]
  if (typeof servingValue === 'number' && Number.isFinite(servingValue)) return Math.round(servingValue * 100) / 100
  const per100Value = n[per100Key]
  const grams = candidate.serving_quantity ?? 0
  if (typeof per100Value !== 'number' || !Number.isFinite(per100Value) || grams <= 0) return null
  return Math.round((per100Value * grams) / 100 * 100) / 100
}

function scoreCandidate(item: InstacartItem, candidate: OffProduct, index: number): CandidateScore {
  const itemNorm = normalizeFoodText(`${item.brand} ${item.itemName}`)
  const nameNorm = normalizeFoodText(candidate.product_name ?? '')
  const brandNorm = normalizeFoodText(candidate.brands ?? '')
  const expectedBrand = normalizeFoodText(item.brand)
  const warnings: string[] = []
  let score = 0

  if (expectedBrand && brandNorm.includes(expectedBrand)) score += 4
  else if (expectedBrand) warnings.push('brand_mismatch')

  const itemTokens = itemNorm.split(' ').filter((token) => token.length > 2)
  const nameTokens = new Set(nameNorm.split(' '))
  const overlap = itemTokens.filter((token) => nameTokens.has(token)).length
  score += Math.min(4, overlap * 0.6)

  const kcal = macroFromOff(candidate, 'energy-kcal')
  const protein = macroFromOff(candidate, 'proteins')
  const carbs = macroFromOff(candidate, 'carbohydrates')
  const fat = macroFromOff(candidate, 'fat')
  if (kcal !== null && kcal > 0 && protein !== null && carbs !== null && fat !== null) score += 3
  else warnings.push('incomplete_macros')

  if ((candidate.serving_quantity ?? 0) > 0) score += 1
  else warnings.push('missing_serving_quantity')

  const servingUnit = parseUnitFromServingSize(candidate.serving_size) || 'serving'
  if (/\b(bar|bars|pop|pops)\b/.test(itemNorm) && !/\b(bar|pop)\b/.test(servingUnit)) {
    warnings.push('serving_unit_mismatch')
    score -= 2
  }
  if (/\b(mini sandwich|sandwiches|sandwich)\b/.test(itemNorm) && !/\bsandwich\b/.test(servingUnit)) {
    warnings.push('serving_unit_mismatch')
    score -= 2
  }

  if (candidate.nutriscore_grade && candidate.nutriscore_grade !== 'unknown') score += 1
  if ((candidate.countries ?? '').toLowerCase().includes('united states')) score += 0.5
  score -= index * 0.05

  return {
    candidate,
    score: Math.round(score * 100) / 100,
    warnings,
    servingUnit,
    servingGrams: (candidate.serving_quantity ?? 0) > 0 ? Math.round((candidate.serving_quantity ?? 0) * 100) / 100 : null,
    kcal,
    protein,
    carbs,
    fat,
  }
}

function markdown(results: PilotResult[], args: Args): string {
  const ready = results.filter((result) => {
    const best = result.candidates[0]
    return best && best.score >= 9 && best.warnings.length === 0
  })
  const review = results.length - ready.length
  const lines: string[] = []
  lines.push('# Instacart Branded Pilot Dry Run')
  lines.push('')
  lines.push(`lane: ${args.lane}`)
  lines.push(`source_csv: ${resolve(args.csv)}`)
  lines.push(`items_searched: ${results.length}`)
  lines.push(`ready_exact_candidates: ${ready.length}`)
  lines.push(`needs_manual_review: ${review}`)
  lines.push('')
  lines.push('No pantry/product rows were written. This report is a source-gated OFF inspection pass for a future branded apply.')
  lines.push('')
  for (const result of results) {
    lines.push(`## ${result.item.itemName}`)
    lines.push('')
    lines.push(`- instacart_brand: ${result.item.brand || '(none)'}`)
    lines.push(`- size: ${result.item.sizeVolume || '(none)'}`)
    lines.push(`- search_query: ${result.searchQuery}`)
    if (result.candidates.length === 0) {
      lines.push('- candidates: none')
      lines.push('')
      continue
    }
    lines.push('')
    lines.push('| rank | score | OFF product | brands | barcode | serving | kcal | P | C | F | warnings |')
    lines.push('| --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |')
    result.candidates.forEach((scored, idx) => {
      const c = scored.candidate
      const serving = `${c.serving_size ?? scored.servingUnit}${scored.servingGrams ? `; ${scored.servingGrams}g` : ''}`
      lines.push([
        `| ${idx + 1}`,
        scored.score.toFixed(2),
        c.product_name ?? '(unnamed)',
        c.brands ?? '',
        c.code ?? '',
        serving,
        scored.kcal ?? '',
        scored.protein ?? '',
        scored.carbs ?? '',
        scored.fat ?? '',
        scored.warnings.length ? scored.warnings.join(', ') : 'clean',
      ].join(' | ') + ' |')
    })
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

async function main() {
  const args = parseArgs(process.argv)
  loadEnvLocal()
  const supabase = supabaseFromEnv()
  const items = loadInstacartItems(args.csv)

  const [{ data: productsData, error: productsError }, { data: aliasesData, error: aliasesError }] = await Promise.all([
    supabase.from('products').select('id,name'),
    supabase.from('food_identity_aliases').select('normalized_alias').eq('active', true),
  ])
  if (productsError) throw productsError
  if (aliasesError) throw aliasesError

  const productNames = new Set(((productsData ?? []) as ProductRow[]).map((product) => normalizeFoodText(product.name)))
  const aliasNames = new Set(((aliasesData ?? []) as AliasRow[]).map((alias) => alias.normalized_alias))
  const uncovered = items.filter((item) => {
    const normalized = normalizeFoodText(item.itemName)
    return !productNames.has(normalized) && !aliasNames.has(normalized)
  })
  const pilotItems = uncovered.filter(isFrozenDessertPilotItem).slice(0, args.limit)

  const results: PilotResult[] = []
  for (const item of pilotItems) {
    const queries = searchQueries(item)
    let candidates: OffProduct[] = []
    for (const query of queries) {
      candidates = await offTextSearch(query, item.brand || undefined, args.candidates)
      if (candidates.length > 0) break
    }
    results.push({
      item,
      searchQuery: queries.join(' | '),
      candidates: candidates
        .map((candidate, index) => scoreCandidate(item, candidate, index))
        .sort((a, b) => b.score - a.score),
    })
  }

  mkdirSync(join(__dirname, 'output'), { recursive: true })
  const runId = randomUUID()
  const base = join(__dirname, 'output', `instacart-branded-pilot-${runId}`)
  writeFileSync(`${base}.json`, JSON.stringify({ runId, args, results }, null, 2))
  writeFileSync(`${base}.md`, markdown(results, args))

  console.log(`# Instacart Branded Pilot`)
  console.log(`run_id: ${runId}`)
  console.log(`items_searched: ${results.length}`)
  console.log(`json: ${base}.json`)
  console.log(`markdown: ${base}.md`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
