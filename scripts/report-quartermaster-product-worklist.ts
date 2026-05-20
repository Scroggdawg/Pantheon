// Read-only Quartermaster product worklist.
//
// Usage:
//   npx tsx scripts/report-quartermaster-product-worklist.ts
//   npx tsx scripts/report-quartermaster-product-worklist.ts --json
//
// This script consolidates the product identity, barcode quality, external
// promotion, and saved-meal source-ref lanes into one prioritized execution
// list. It does not write production data.

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

interface FoodLogEntryRow {
  id: string
  log_method: string | null
  raw_input_text: string | null
  foods_json: FoodLike[] | null
  created_at: string
}

interface FoodLogEventRow {
  id: string
  event_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

interface ProductRow {
  id: string
  name: string | null
  barcode: string | null
  provenance_source_kind: string | null
  provenance_external_id: string | null
  canonical_category: string | null
  unit_alternatives?: unknown
}

interface SavedMealRow {
  id: string
  name: string | null
  foods_json: FoodLike[] | null
  times_logged: number | null
  is_favorite: boolean | null
}

interface WorklistPacket {
  priority: 'P1' | 'P2' | 'P3'
  lane: 'data_repair' | 'pantry_forge' | 'parser_contract' | 'quartermaster_watch'
  title: string
  plain_english: string
  evidence: string[]
  next_action: string
  stop_rule: string
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

function asFoods(value: unknown): FoodLike[] {
  return Array.isArray(value) ? (value as FoodLike[]) : []
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function foodSummary(food: FoodLike): string {
  return `${food.name ?? '(unnamed)'}${food.qty ? ` x${food.qty}` : ''}${food.unit ? ` ${food.unit}` : ''}${food.source_ref ? ` [${food.source_ref}]` : ''}`
}

function sourceRefParts(ref: string | null | undefined): { kind: 'off' | 'usda'; id: string } | null {
  if (!ref) return null
  if (ref.startsWith('off:')) return { kind: 'off', id: ref.slice('off:'.length) }
  if (ref.startsWith('usda:')) return { kind: 'usda', id: ref.slice('usda:'.length) }
  return null
}

function productSourceKeys(product: ProductRow): string[] {
  return [
    product.barcode ? `off:${product.barcode}` : null,
    product.provenance_source_kind && product.provenance_external_id
      ? `${product.provenance_source_kind}:${product.provenance_external_id}`
      : null,
  ].filter((key): key is string => Boolean(key))
}

function hasUnitAlternatives(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

function displayName(counts: Record<string, number>): string {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? '(unnamed)'
}

function buildPackets(args: {
  entries: FoodLogEntryRow[]
  events: FoodLogEventRow[]
  products: ProductRow[]
  savedMeals: SavedMealRow[]
}): WorklistPacket[] {
  const packets: WorklistPacket[] = []
  const productsByExternalRef = new Map<string, ProductRow>()
  for (const product of args.products) {
    for (const key of productSourceKeys(product)) productsByExternalRef.set(key, product)
  }

  const hourlyRefs = args.savedMeals.flatMap((meal) =>
    asFoods(meal.foods_json)
      .filter((food) => food.source_ref?.startsWith('lib:hourly_go_to:'))
      .map((food) => `${meal.name ?? '(unnamed saved meal)'} -> ${foodSummary(food)}`),
  )
  if (hourlyRefs.length > 0) {
    packets.push({
      priority: 'P1',
      lane: 'data_repair',
      title: 'Retire hourly wrapper refs inside saved meals',
      plain_english: 'Some favorites still point at memory/recall wrappers instead of real product or saved-meal identities. That can confuse hearts and future learning.',
      evidence: hourlyRefs.slice(0, 6),
      next_action: 'Use the saved-meal source-ref repair dry run as the review queue; only write live repairs after integration approval.',
      stop_rule: 'Stop before production writes or any auto-map that points a saved meal back to itself.',
    })
  }

  const externalGroups = new Map<string, { names: Record<string, number>; foods: string[]; hasBarcode: boolean }>()
  for (const entry of args.entries) {
    for (const food of asFoods(entry.foods_json)) {
      const parts = sourceRefParts(food.source_ref)
      if (!parts) continue
      const key = `${parts.kind}:${parts.id}`
      const group = externalGroups.get(key) ?? { names: {}, foods: [], hasBarcode: false }
      const name = food.name ?? '(unnamed external food)'
      group.names[name] = (group.names[name] ?? 0) + 1
      group.foods.push(`${entry.created_at}: ${foodSummary(food)}`)
      if (entry.log_method === 'barcode') group.hasBarcode = true
      externalGroups.set(key, group)
    }
  }

  const reviewPromotions = [...externalGroups.entries()]
    .filter(([key, group]) => !productsByExternalRef.has(key) && group.foods.length >= 2)
    .sort((a, b) => b[1].foods.length - a[1].foods.length)
  if (reviewPromotions.length > 0) {
    const [sourceRef, group] = reviewPromotions[0]
    packets.push({
      priority: 'P1',
      lane: 'pantry_forge',
      title: `Review repeated external food for product promotion: ${displayName(group.names)}`,
      plain_english: 'A saved food has repeated clean usage while still living as an external OFF/USDA ref. That is the best kind of candidate for a reviewed product row.',
      evidence: [`source_ref: ${sourceRef}`, ...group.foods.slice(0, 4)],
      next_action: 'Verify label/source facts, serving units, and common display quantities before creating a durable product candidate.',
      stop_rule: 'Do not promote from repetition alone if serving facts or units are unclear.',
    })
  }

  const barcodeFailures = args.events.filter((event) => event.event_type === 'barcode_scan_failed')
  if (barcodeFailures.length > 0) {
    packets.push({
      priority: 'P2',
      lane: 'quartermaster_watch',
      title: 'Classify barcode scan failures',
      plain_english: 'Barcode misses show where scanning failed to save Luke time. These should become either product coverage work or scanner/system bug reports.',
      evidence: barcodeFailures.slice(0, 5).map((event) => `${event.created_at}: ${JSON.stringify(event.payload ?? {})}`),
      next_action: 'Split failures into no-product, incomplete-macros, camera/permission, and fallback-parse buckets.',
      stop_rule: 'Do not create broad aliases or products from a barcode failure without reviewed product facts.',
    })
  }

  const compositionProducts = args.products.filter((product) => {
    const name = normalize(product.name)
    return /\b(protein shake|with dextrose|half dextrose|no dextrose)\b/.test(name)
  })
  if (compositionProducts.length > 0) {
    packets.push({
      priority: 'P2',
      lane: 'parser_contract',
      title: 'Keep protein shakes from becoming saved-item sprawl',
      plain_english: 'Protein shakes are partly products and partly recipes. The app should support common shortcuts while still understanding custom scoops and dextrose amounts.',
      evidence: compositionProducts.slice(0, 6).map((product) => `${product.name ?? '(unnamed)'} [lib:product:${product.id}]`),
      next_action: 'Preserve common shake shortcuts, but route custom quantities toward ingredient math: Isopure protein plus Nutricost dextrose.',
      stop_rule: 'Do not add a new durable identity for every possible quantity combination.',
    })
  }

  const barcodeProductsMissingUnits = args.products.filter((product) => product.barcode && !hasUnitAlternatives(product.unit_alternatives))
  if (barcodeProductsMissingUnits.length > 0) {
    packets.push({
      priority: 'P3',
      lane: 'pantry_forge',
      title: 'Fill missing unit surfaces for barcode products',
      plain_english: 'Barcode products need good units so scans can be saved as cans, bars, bottles, grams, ounces, or servings without making duplicate identities.',
      evidence: barcodeProductsMissingUnits.slice(0, 8).map((product) => `${product.name ?? '(unnamed)'} barcode=${product.barcode}`),
      next_action: 'Add reviewed unit alternatives for products that repeat in scans or saved logs.',
      stop_rule: 'Do not guess package units when label evidence is missing.',
    })
  }

  return packets.sort((a, b) => {
    const priorityScore = { P1: 3, P2: 2, P3: 1 }
    return priorityScore[b.priority] - priorityScore[a.priority] || a.title.localeCompare(b.title)
  })
}

function render(args: {
  entries: FoodLogEntryRow[]
  events: FoodLogEventRow[]
  products: ProductRow[]
  savedMeals: SavedMealRow[]
  packets: WorklistPacket[]
}): string {
  const lines: string[] = []
  lines.push('Quartermaster Product Worklist')
  lines.push('')
  lines.push('Summary')
  lines.push(`- recent_food_logs_read: ${args.entries.length}`)
  lines.push(`- recent_events_read: ${args.events.length}`)
  lines.push(`- products_read: ${args.products.length}`)
  lines.push(`- saved_meals_read: ${args.savedMeals.length}`)
  lines.push(`- work_packets: ${args.packets.length}`)
  lines.push('')
  lines.push('Prioritized Execution Plan')
  for (const [index, packet] of args.packets.entries()) {
    lines.push(`${index + 1}. [${packet.priority}] ${packet.title}`)
    lines.push(`   - lane: ${packet.lane}`)
    lines.push(`   - plain_english: ${packet.plain_english}`)
    lines.push(`   - next_action: ${packet.next_action}`)
    lines.push(`   - stop_rule: ${packet.stop_rule}`)
    lines.push(`   - evidence: ${packet.evidence.slice(0, 3).join(' | ')}`)
  }
  if (args.packets.length === 0) lines.push('- No active packets found.')
  return lines.join('\n')
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')

  const supabase = createClient(url, key)
  const [entriesRes, eventsRes, productsRes, savedMealsRes] = await Promise.all([
    supabase
      .from('food_log_entries')
      .select('id,log_method,raw_input_text,foods_json,created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('food_log_events')
      .select('id,event_type,payload,created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('products')
      .select('id,name,barcode,provenance_source_kind,provenance_external_id,canonical_category,unit_alternatives')
      .order('name', { ascending: true }),
    supabase
      .from('saved_meals')
      .select('id,name,foods_json,times_logged,is_favorite')
      .order('name', { ascending: true }),
  ])

  if (entriesRes.error) throw new Error(`food_log_entries query failed: ${entriesRes.error.message}`)
  if (eventsRes.error) throw new Error(`food_log_events query failed: ${eventsRes.error.message}`)
  if (productsRes.error) throw new Error(`products query failed: ${productsRes.error.message}`)
  if (savedMealsRes.error) throw new Error(`saved_meals query failed: ${savedMealsRes.error.message}`)

  const entries = (entriesRes.data ?? []) as FoodLogEntryRow[]
  const events = (eventsRes.data ?? []) as FoodLogEventRow[]
  const products = (productsRes.data ?? []) as ProductRow[]
  const savedMeals = (savedMealsRes.data ?? []) as SavedMealRow[]
  const packets = buildPackets({ entries, events, products, savedMeals })

  console.log(render({ entries, events, products, savedMeals, packets }))
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({
      summary: {
        recent_food_logs_read: entries.length,
        recent_events_read: events.length,
        products_read: products.length,
        saved_meals_read: savedMeals.length,
        work_packets: packets.length,
      },
      packets,
    }, null, 2))
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
