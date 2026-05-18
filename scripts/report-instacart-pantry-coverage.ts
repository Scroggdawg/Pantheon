import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { normalizeFoodText } from '../lib/pantry-builder/normalize'

interface Args {
  csv: string
  limit: number
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
  brand: string | null
}

interface AliasRow {
  alias: string
  normalized_alias: string
  target_source_ref: string
}

type CoverageType = 'product' | 'alias' | 'uncovered'
type ActionLane =
  | 'covered'
  | 'safe_alias_candidate'
  | 'needs_usda_anchor'
  | 'needs_branded_product'
  | 'review_only'
  | 'alcohol_hold'
  | 'non_food'

function parseArgs(argv: string[]): Args {
  const args: Args = {
    csv: '/Users/scroggdawg/Downloads/instacart_food_items.csv',
    limit: 20,
  }
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--csv=')) args.csv = arg.slice('--csv='.length)
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length))
    else throw new Error(`Unknown arg: ${arg}`)
  }
  if (!Number.isInteger(args.limit) || args.limit < 1) throw new Error('--limit must be a positive integer')
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

function classifyAction(item: InstacartItem, coverageType: CoverageType): ActionLane {
  if (coverageType !== 'uncovered') return 'covered'

  const category = item.category.toLowerCase()
  const normalized = normalizeFoodText(`${item.itemName} ${item.brand}`)

  if (category === 'alcohol' || /\b(wine|beer|vodka|tequila|whiskey|cocktail|hard seltzer)\b/.test(normalized)) {
    return 'alcohol_hold'
  }
  if (category === 'household' || category === 'health & wellness') return 'non_food'
  if (/\b(electrolyte|protein powder|supplement|vitamin|collagen)\b/.test(normalized)) return 'review_only'
  if (/\b(pizza|sushi|poke|bowl|smoothie|sandwich|meal|kit|soup|salad|cookie|ice cream|bar)\b/.test(normalized)) {
    return 'needs_branded_product'
  }
  if (/\b(frozen|prepared|marinated|seasoned|sauce|dressing|dip|spread|cereal|cracker|chips)\b/.test(normalized)) {
    return 'needs_branded_product'
  }
  if (category === 'produce') return 'safe_alias_candidate'
  if (category === 'dairy & eggs' || category === 'baking' || category === 'grains & pasta') {
    return item.brand ? 'safe_alias_candidate' : 'needs_usda_anchor'
  }
  if (category === 'meat & seafood') return 'review_only'
  if (category === 'beverages' || category === 'frozen' || category === 'prepared foods') return 'needs_branded_product'
  return 'review_only'
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

async function main() {
  const args = parseArgs(process.argv)
  loadEnvLocal()
  const items = loadInstacartItems(args.csv)
  const supabase = supabaseFromEnv()

  const [{ data: productsData, error: productsError }, { data: aliasesData, error: aliasesError }] = await Promise.all([
    supabase.from('products').select('id,name,brand').order('name', { ascending: true }),
    supabase.from('food_identity_aliases').select('alias,normalized_alias,target_source_ref').eq('active', true),
  ])
  if (productsError) throw productsError
  if (aliasesError) throw aliasesError

  const products = (productsData ?? []) as ProductRow[]
  const aliases = (aliasesData ?? []) as AliasRow[]
  const productNames = new Map(products.map((product) => [normalizeFoodText(product.name), product]))
  const aliasNames = new Map(aliases.map((alias) => [alias.normalized_alias, alias]))

  const categoryCounts = new Map<string, number>()
  const coveredByCategory = new Map<string, number>()
  const actionCounts = new Map<ActionLane, number>()
  const coverageCounts = new Map<CoverageType, number>()
  const uncoveredByLane = new Map<ActionLane, InstacartItem[]>()
  const duplicateNames = new Map<string, number>()

  for (const item of items) {
    const normalized = normalizeFoodText(item.itemName)
    increment(duplicateNames, normalized)
    increment(categoryCounts, item.category || 'Uncategorized')

    let coverageType: CoverageType = 'uncovered'
    if (productNames.has(normalized)) coverageType = 'product'
    else if (aliasNames.has(normalized)) coverageType = 'alias'
    increment(coverageCounts, coverageType)
    if (coverageType !== 'uncovered') increment(coveredByCategory, item.category || 'Uncategorized')

    const lane = classifyAction(item, coverageType)
    increment(actionCounts, lane)
    if (coverageType === 'uncovered') {
      const list = uncoveredByLane.get(lane) ?? []
      list.push(item)
      uncoveredByLane.set(lane, list)
    }
  }

  const duplicates = [...duplicateNames.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0)
  const covered = (coverageCounts.get('product') ?? 0) + (coverageCounts.get('alias') ?? 0)

  console.log('# Instacart Pantry Coverage')
  console.log('')
  console.log(`csv: ${resolve(args.csv)}`)
  console.log(`items: ${items.length}`)
  console.log(`unique_item_names: ${duplicateNames.size}`)
  console.log(`exact_repeats: ${duplicates}`)
  console.log(`products_loaded: ${products.length}`)
  console.log(`active_aliases_loaded: ${aliases.length}`)
  console.log(`covered_exact: ${covered}/${items.length}`)
  console.log(`covered_by_product: ${coverageCounts.get('product') ?? 0}`)
  console.log(`covered_by_alias: ${coverageCounts.get('alias') ?? 0}`)
  console.log(`uncovered: ${coverageCounts.get('uncovered') ?? 0}`)
  console.log('')

  console.log('## Category Coverage')
  for (const [category, total] of [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const categoryCovered = coveredByCategory.get(category) ?? 0
    const pct = Math.round((categoryCovered / total) * 100)
    console.log(`- ${category}: ${categoryCovered}/${total} (${pct}%)`)
  }
  console.log('')

  console.log('## Action Lanes')
  for (const [lane, total] of [...actionCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`- ${lane}: ${total}`)
  }
  console.log('')

  console.log('## Uncovered Samples')
  const laneOrder: ActionLane[] = [
    'safe_alias_candidate',
    'needs_usda_anchor',
    'needs_branded_product',
    'review_only',
    'alcohol_hold',
    'non_food',
  ]
  for (const lane of laneOrder) {
    const list = uncoveredByLane.get(lane) ?? []
    if (list.length === 0) continue
    console.log(`### ${lane} (${list.length})`)
    for (const item of list.slice(0, args.limit)) {
      const brand = item.brand ? `; brand=${item.brand}` : ''
      const size = item.sizeVolume ? `; size=${item.sizeVolume}` : ''
      console.log(`- ${item.itemName} [${item.category}${brand}${size}]`)
    }
    console.log('')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
