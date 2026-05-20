// Read-only product promotion review packet.
//
// Usage:
//   npx tsx scripts/report-product-promotion-review.ts
//   npx tsx scripts/report-product-promotion-review.ts --json
//
// This script reviews repeated saved foods backed by external refs (`off:*`,
// `usda:*`) and prepares human promotion packets. It does not create products
// or mutate production data.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createClient } from '@supabase/supabase-js'

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
  log_method: string | null
  raw_input_text: string | null
  foods_json: FoodLike[] | null
  created_at: string
}

interface ProductRow {
  id: string
  name: string | null
  barcode: string | null
  provenance_source_kind: string | null
  provenance_external_id: string | null
  unit_alternatives?: unknown
}

interface ExternalObservation {
  entry: FoodLogEntryRow
  food: FoodLike
}

interface ExternalGroup {
  source_ref: string
  source_kind: 'off' | 'usda'
  external_id: string
  names: Record<string, number>
  units: Record<string, number>
  observations: ExternalObservation[]
  matchingProducts: ProductRow[]
  hasBarcodeLog: boolean
}

interface PromotionReview {
  decision: 'already_promoted' | 'review_for_promotion' | 'watch'
  priority: 'P1' | 'P2' | 'P3'
  source_ref: string
  display_name: string
  plain_english: string
  confidence_notes: string[]
  observed_units: string[]
  observed_macros: string[]
  candidate_product_shape: {
    name: string
    provenance_source_kind: 'off' | 'usda'
    provenance_external_id: string
    barcode: string | null
    suggested_unit_alternatives: string[]
  } | null
  required_before_write: string[]
  stop_rules: string[]
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

function sourceRefParts(ref: string | null | undefined): { kind: 'off' | 'usda'; id: string } | null {
  if (!ref) return null
  if (ref.startsWith('off:')) return { kind: 'off', id: ref.slice('off:'.length) }
  if (ref.startsWith('usda:')) return { kind: 'usda', id: ref.slice('usda:'.length) }
  return null
}

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1
}

function sortedKeys(counts: Record<string, number>): string[] {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key]) => key)
}

function mostCommon(counts: Record<string, number>, fallback: string): string {
  return sortedKeys(counts)[0] ?? fallback
}

function productSourceKeys(product: ProductRow): string[] {
  return [
    product.barcode ? `off:${product.barcode}` : null,
    product.provenance_source_kind && product.provenance_external_id
      ? `${product.provenance_source_kind}:${product.provenance_external_id}`
      : null,
  ].filter((key): key is string => Boolean(key))
}

function foodMacroSummary(food: FoodLike): string {
  const parts = [
    typeof food.calories === 'number' ? `${food.calories} cal` : null,
    typeof food.protein_g === 'number' ? `${food.protein_g}P` : null,
    typeof food.carbs_g === 'number' ? `${food.carbs_g}C` : null,
    typeof food.fat_g === 'number' ? `${food.fat_g}F` : null,
  ].filter(Boolean)
  return `${food.qty ?? '?'} ${food.unit ?? 'unit'} -> ${parts.join(' / ') || 'macros missing'}`
}

function buildGroups(entries: FoodLogEntryRow[], products: ProductRow[]): ExternalGroup[] {
  const productsByExternalRef = new Map<string, ProductRow[]>()
  for (const product of products) {
    for (const key of productSourceKeys(product)) {
      const rows = productsByExternalRef.get(key) ?? []
      rows.push(product)
      productsByExternalRef.set(key, rows)
    }
  }

  const groups = new Map<string, ExternalGroup>()
  for (const entry of entries) {
    for (const food of asFoods(entry.foods_json)) {
      const parts = sourceRefParts(food.source_ref)
      if (!parts) continue
      const sourceRef = `${parts.kind}:${parts.id}`
      const group = groups.get(sourceRef) ?? {
        source_ref: sourceRef,
        source_kind: parts.kind,
        external_id: parts.id,
        names: {},
        units: {},
        observations: [],
        matchingProducts: productsByExternalRef.get(sourceRef) ?? [],
        hasBarcodeLog: false,
      }
      increment(group.names, food.name ?? '(unnamed external food)')
      increment(group.units, food.unit ?? '(no unit)')
      group.observations.push({ entry, food })
      if (entry.log_method === 'barcode') group.hasBarcodeLog = true
      groups.set(sourceRef, group)
    }
  }

  return [...groups.values()].sort((a, b) => b.observations.length - a.observations.length || a.source_ref.localeCompare(b.source_ref))
}

function reviewGroup(group: ExternalGroup): PromotionReview {
  const displayName = mostCommon(group.names, '(unnamed external food)')
  const units = sortedKeys(group.units)
  const macros = [...new Set(group.observations.map(({ food }) => foodMacroSummary(food)))].slice(0, 8)
  const matchingProduct = group.matchingProducts[0]
  if (matchingProduct) {
    return {
      decision: 'already_promoted',
      priority: Array.isArray(matchingProduct.unit_alternatives) && matchingProduct.unit_alternatives.length > 0 ? 'P3' : 'P2',
      source_ref: group.source_ref,
      display_name: displayName,
      plain_english: 'A product row already appears to cover this external ref. Review only if units or edits show friction.',
      confidence_notes: [`matching product: ${matchingProduct.name ?? '(unnamed product)'} [lib:product:${matchingProduct.id}]`],
      observed_units: units,
      observed_macros: macros,
      candidate_product_shape: null,
      required_before_write: ['Do not create a duplicate product row.'],
      stop_rules: ['Stop if the matching product already has correct units and provenance.'],
    }
  }

  const repeated = group.observations.length >= 2
  const decision = repeated ? 'review_for_promotion' : 'watch'
  const priority = repeated ? 'P1' : group.hasBarcodeLog ? 'P2' : 'P3'
  return {
    decision,
    priority,
    source_ref: group.source_ref,
    display_name: displayName,
    plain_english: repeated
      ? 'This external food repeats in saved logs and may deserve a reviewed durable product row.'
      : 'This external food has only one observation. Keep watching unless Luke explicitly asks for it.',
    confidence_notes: [
      `${group.observations.length} saved observation(s)`,
      group.hasBarcodeLog ? 'seen through barcode logging' : 'not seen through barcode logging',
      units.length > 1 ? `multiple observed units: ${units.join(', ')}` : `observed unit: ${units[0] ?? '(none)'}`,
    ],
    observed_units: units,
    observed_macros: macros,
    candidate_product_shape: repeated
      ? {
          name: displayName,
          provenance_source_kind: group.source_kind,
          provenance_external_id: group.external_id,
          barcode: group.source_kind === 'off' ? group.external_id : null,
          suggested_unit_alternatives: units.filter((unit) => unit !== '(no unit)'),
        }
      : null,
    required_before_write: [
      'Verify serving facts from a trusted label/source.',
      'Confirm the base serving unit and grams/milliliters when available.',
      'Confirm common Luke-facing units before adding unit alternatives.',
      'Route any production product insert through explicit approval.',
    ],
    stop_rules: [
      'Do not promote from repetition alone if serving facts conflict.',
      'Do not create a duplicate if a product already covers the same barcode/source.',
      'Do not turn a barcode observation into a saved meal.',
    ],
  }
}

function render(reviews: PromotionReview[]): string {
  const counts = reviews.reduce<Record<string, number>>((acc, review) => {
    acc[review.decision] = (acc[review.decision] ?? 0) + 1
    return acc
  }, {})
  const lines: string[] = []
  lines.push('Product Promotion Review Packet')
  lines.push('')
  lines.push('Summary')
  lines.push(`- external_refs_reviewed: ${reviews.length}`)
  lines.push(`- already_promoted: ${counts.already_promoted ?? 0}`)
  lines.push(`- review_for_promotion: ${counts.review_for_promotion ?? 0}`)
  lines.push(`- watch: ${counts.watch ?? 0}`)
  lines.push('')
  lines.push('Promotion Review')
  for (const [index, review] of reviews.entries()) {
    lines.push(`${index + 1}. [${review.priority}] ${review.display_name} (${review.source_ref})`)
    lines.push(`   - decision: ${review.decision}`)
    lines.push(`   - plain_english: ${review.plain_english}`)
    lines.push(`   - confidence: ${review.confidence_notes.join(' | ')}`)
    lines.push(`   - observed_units: ${review.observed_units.join(', ') || '(none)'}`)
    lines.push(`   - observed_macros: ${review.observed_macros.join(' | ')}`)
    if (review.candidate_product_shape) {
      lines.push(`   - candidate_name: ${review.candidate_product_shape.name}`)
      lines.push(`   - provenance: ${review.candidate_product_shape.provenance_source_kind}:${review.candidate_product_shape.provenance_external_id}`)
      lines.push(`   - suggested_units: ${review.candidate_product_shape.suggested_unit_alternatives.join(', ') || '(none)'}`)
    }
    lines.push(`   - required_before_write: ${review.required_before_write[0]}`)
    lines.push(`   - stop_rule: ${review.stop_rules[0]}`)
  }
  return lines.join('\n')
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')

  const supabase = createClient(url, key)
  const [entriesRes, productsRes] = await Promise.all([
    supabase
      .from('food_log_entries')
      .select('id,log_method,raw_input_text,foods_json,created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('products')
      .select('id,name,barcode,provenance_source_kind,provenance_external_id,unit_alternatives')
      .order('name', { ascending: true }),
  ])

  if (entriesRes.error) throw new Error(`food_log_entries query failed: ${entriesRes.error.message}`)
  if (productsRes.error) throw new Error(`products query failed: ${productsRes.error.message}`)

  const entries = (entriesRes.data ?? []) as FoodLogEntryRow[]
  const products = (productsRes.data ?? []) as ProductRow[]
  const groups = buildGroups(entries, products)
  const reviews = groups.map(reviewGroup).sort((a, b) => {
    const priority = { P1: 3, P2: 2, P3: 1 }
    return priority[b.priority] - priority[a.priority] || a.display_name.localeCompare(b.display_name)
  })

  console.log(render(reviews))
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ reviews }, null, 2))
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
