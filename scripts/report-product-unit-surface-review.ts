// Read-only product unit surface review.
//
// Usage:
//   npx tsx scripts/report-product-unit-surface-review.ts
//   npx tsx scripts/report-product-unit-surface-review.ts --json
//
// This script ranks product unit surfaces that may need review, especially
// barcode-backed products. It does not mutate production data.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createClient } from '@supabase/supabase-js'

interface ProductRow {
  id: string
  name: string | null
  brand: string | null
  unit: string | null
  serving_size_g: number | null
  barcode: string | null
  provenance_source_kind: string | null
  provenance_external_id: string | null
  unit_alternatives?: unknown
}

interface FoodLike {
  name?: string | null
  qty?: number | null
  unit?: string | null
  source_ref?: string | null
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
}

interface FoodLogEntryRow {
  id: string
  raw_input_text: string | null
  log_method: string | null
  foods_json: FoodLike[] | null
  created_at: string
}

interface UnitSurfacePacket {
  priority: 'P1' | 'P2' | 'P3'
  product_ref: string
  product_name: string
  plain_english: string
  evidence: string[]
  observed_units: string[]
  suggested_review_units: string[]
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

function asUnitAlternatives(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function productRef(product: ProductRow): string {
  return `lib:product:${product.id}`
}

function sourceRefId(ref: string | null | undefined): string | null {
  if (!ref?.startsWith('lib:product:')) return null
  return ref.slice('lib:product:'.length)
}

function normalizeUnit(unit: string | null | undefined): string {
  const normalized = (unit ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\d+(?:\.\d+)?\s+/, '')
    .replace(/\s+/g, ' ')
  if (!normalized) return '(none)'
  const singulars: Record<string, string> = {
    bars: 'bar',
    bottles: 'bottle',
    cans: 'can',
    chips: 'chip',
    cups: 'cup',
    dropperfuls: 'dropper',
    droppers: 'dropper',
    grams: 'g',
    gram: 'g',
    ounces: 'oz',
    ounce: 'oz',
    servings: 'serving',
    slices: 'slice',
    tablespoons: 'tbsp',
    tablespoon: 'tbsp',
    teaspoons: 'tsp',
    teaspoon: 'tsp',
  }
  return singulars[normalized] ?? normalized
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
}

function commonUnits(counts: Record<string, number>): string[] {
  return Object.keys(counts).filter((unit) => unit !== '(none)')
}

function unitNamesFromAlternatives(value: unknown): string[] {
  return asUnitAlternatives(value)
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'unit' in item) {
        const unit = (item as { unit?: unknown }).unit
        return typeof unit === 'string' ? unit : null
      }
      if (item && typeof item === 'object' && 'label' in item) {
        const label = (item as { label?: unknown }).label
        return typeof label === 'string' ? label : null
      }
      if (item && typeof item === 'object' && 'name' in item) {
        const name = (item as { name?: unknown }).name
        return typeof name === 'string' ? name : null
      }
      return null
    })
    .filter((unit): unit is string => Boolean(unit))
}

function buildPackets(products: ProductRow[], entries: FoodLogEntryRow[]): UnitSurfacePacket[] {
  const entriesByProductId = new Map<string, Array<{ entry: FoodLogEntryRow; food: FoodLike }>>()
  for (const entry of entries) {
    for (const food of asFoods(entry.foods_json)) {
      const id = sourceRefId(food.source_ref)
      if (!id) continue
      const rows = entriesByProductId.get(id) ?? []
      rows.push({ entry, food })
      entriesByProductId.set(id, rows)
    }
  }

  const packets: UnitSurfacePacket[] = []
  for (const product of products) {
    const observations = entriesByProductId.get(product.id) ?? []
    const observedUnitCounts = countBy(observations.map(({ food }) => normalizeUnit(food.unit)))
    const observedUnits = commonUnits(observedUnitCounts)
    const configuredUnits = new Set([normalizeUnit(product.unit), ...unitNamesFromAlternatives(product.unit_alternatives).map(normalizeUnit)])
    const missingObservedUnits = observedUnits.filter((unit) => !configuredUnits.has(unit))
    const unitAltCount = asUnitAlternatives(product.unit_alternatives).length
    const barcodeBacked = Boolean(product.barcode)

    if (!barcodeBacked && observations.length === 0 && unitAltCount > 0) continue
    if (unitAltCount > 0 && missingObservedUnits.length === 0 && observations.length < 2) continue

    const priority: UnitSurfacePacket['priority'] =
      observations.length >= 2 && missingObservedUnits.length > 0
        ? 'P1'
        : barcodeBacked && unitAltCount === 0
          ? 'P2'
          : 'P3'

    const evidence = [
      `base_unit=${product.unit ?? '(none)'}`,
      `serving_size_g=${product.serving_size_g ?? '(none)'}`,
      `unit_alternatives=${unitAltCount}`,
      barcodeBacked ? `barcode=${product.barcode}` : 'barcode=(none)',
      observations.length > 0
        ? `observed_units=${Object.entries(observedUnitCounts).map(([unit, count]) => `${unit}:${count}`).join(', ')}`
        : 'observed_units=(none)',
      ...observations.slice(0, 4).map(({ entry, food }) => `${entry.created_at}: ${food.name ?? product.name ?? '(unnamed)'} x${food.qty ?? '?'} ${food.unit ?? 'unit'} (${entry.log_method ?? 'method?'})`),
    ]

    packets.push({
      priority,
      product_ref: productRef(product),
      product_name: product.name ?? '(unnamed product)',
      plain_english: unitAltCount === 0
        ? 'This product has no unit alternatives, so logs may fall back to vague serving/count units.'
        : missingObservedUnits.length > 0
          ? 'Luke has used units that are not represented in this product surface yet.'
          : 'This product has a unit surface worth watching because it is barcode-backed or repeatedly logged.',
      evidence,
      observed_units: observedUnits,
      suggested_review_units: missingObservedUnits.length > 0 ? missingObservedUnits : observedUnits,
      next_action: 'Review label/package facts before adding unit alternatives such as can, bar, bottle, slice, gram, ounce, tbsp, or serving.',
      stop_rule: 'Do not guess package units or create separate products for each quantity.',
    })
  }

  return packets.sort((a, b) => {
    const priority = { P1: 3, P2: 2, P3: 1 }
    return priority[b.priority] - priority[a.priority] || a.product_name.localeCompare(b.product_name)
  })
}

function render(packets: UnitSurfacePacket[]): string {
  const counts = packets.reduce<Record<string, number>>((acc, packet) => {
    acc[packet.priority] = (acc[packet.priority] ?? 0) + 1
    return acc
  }, {})
  const lines: string[] = []
  lines.push('Product Unit Surface Review')
  lines.push('')
  lines.push('Summary')
  lines.push(`- packets: ${packets.length}`)
  lines.push(`- P1: ${counts.P1 ?? 0}`)
  lines.push(`- P2: ${counts.P2 ?? 0}`)
  lines.push(`- P3: ${counts.P3 ?? 0}`)
  lines.push('')
  lines.push('Unit Surface Packets')
  for (const [index, packet] of packets.entries()) {
    lines.push(`${index + 1}. [${packet.priority}] ${packet.product_name}`)
    lines.push(`   - ref: ${packet.product_ref}`)
    lines.push(`   - plain_english: ${packet.plain_english}`)
    lines.push(`   - observed_units: ${packet.observed_units.join(', ') || '(none)'}`)
    lines.push(`   - suggested_review_units: ${packet.suggested_review_units.join(', ') || '(none)'}`)
    lines.push(`   - next_action: ${packet.next_action}`)
    lines.push(`   - stop_rule: ${packet.stop_rule}`)
    lines.push(`   - evidence: ${packet.evidence.slice(0, 5).join(' | ')}`)
  }
  if (packets.length === 0) lines.push('- No unit-surface packets found.')
  return lines.join('\n')
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')

  const supabase = createClient(url, key)
  const [productsRes, entriesRes] = await Promise.all([
    supabase
      .from('products')
      .select('id,name,brand,unit,serving_size_g,barcode,provenance_source_kind,provenance_external_id,unit_alternatives')
      .order('name', { ascending: true }),
    supabase
      .from('food_log_entries')
      .select('id,raw_input_text,log_method,foods_json,created_at')
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  if (productsRes.error) throw new Error(`products query failed: ${productsRes.error.message}`)
  if (entriesRes.error) throw new Error(`food_log_entries query failed: ${entriesRes.error.message}`)

  const products = (productsRes.data ?? []) as ProductRow[]
  const entries = (entriesRes.data ?? []) as FoodLogEntryRow[]
  const packets = buildPackets(products, entries)
  console.log(render(packets))
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ packets }, null, 2))
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
