// Read-only external product promotion report.
//
// Usage:
//   npx tsx scripts/report-external-product-promotion.ts
//   npx tsx scripts/report-external-product-promotion.ts --json
//
// This script finds saved foods backed by external source refs (`off:*`,
// `usda:*`) and decides whether they should be watched, reviewed for product
// promotion, or ignored for now. It does not write production data.

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
  unit_alternatives?: unknown
}

interface FoodLogEntryRow {
  id: string
  logged_at: string
  meal_label: string | null
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

interface ExternalGroup {
  source_ref: string
  source_kind: 'off' | 'usda'
  external_id: string
  observed_names: Record<string, number>
  entries: Array<{ entry: FoodLogEntryRow; food: FoodLike }>
  matchingProducts: ProductRow[]
  hasBarcodeLog: boolean
}

interface PromotionPacket {
  priority: 'P1' | 'P2' | 'P3'
  decision: 'already_promoted' | 'review_for_promotion' | 'watch'
  source_ref: string
  display_name: string
  plain_english: string
  evidence: string[]
  allowed_actions: string[]
  blocked_actions: string[]
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

function sourceRefParts(ref: string | null | undefined): { kind: 'off' | 'usda'; id: string } | null {
  if (!ref) return null
  if (ref.startsWith('off:')) return { kind: 'off', id: ref.slice('off:'.length) }
  if (ref.startsWith('usda:')) return { kind: 'usda', id: ref.slice('usda:'.length) }
  return null
}

function asFoods(value: unknown): FoodLike[] {
  return Array.isArray(value) ? (value as FoodLike[]) : []
}

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1
}

function mostCommonName(names: Record<string, number>): string {
  return Object.entries(names).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? '(unnamed external food)'
}

function foodSummary(food: FoodLike): string {
  return `${food.name ?? '(unnamed)'}${food.qty ? ` x${food.qty}` : ''}${food.unit ? ` ${food.unit}` : ''}${food.calories ? ` ${food.calories} cal` : ''}`
}

function hasUnitAlternatives(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

function buildGroups(entries: FoodLogEntryRow[], products: ProductRow[]): ExternalGroup[] {
  const productBySourceRef = new Map<string, ProductRow[]>()
  for (const product of products) {
    const keys = [
      product.barcode ? `off:${product.barcode}` : null,
      product.provenance_source_kind && product.provenance_external_id
        ? `${product.provenance_source_kind}:${product.provenance_external_id}`
        : null,
    ].filter((key): key is string => Boolean(key))
    for (const key of keys) {
      const list = productBySourceRef.get(key) ?? []
      list.push(product)
      productBySourceRef.set(key, list)
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
        observed_names: {},
        entries: [],
        matchingProducts: productBySourceRef.get(sourceRef) ?? [],
        hasBarcodeLog: false,
      }
      increment(group.observed_names, food.name ?? '(unnamed external food)')
      group.entries.push({ entry, food })
      if (entry.log_method === 'barcode') group.hasBarcodeLog = true
      groups.set(sourceRef, group)
    }
  }

  return [...groups.values()].sort((a, b) => b.entries.length - a.entries.length || a.source_ref.localeCompare(b.source_ref))
}

function packetForGroup(group: ExternalGroup): PromotionPacket {
  const displayName = mostCommonName(group.observed_names)
  const evidence = group.entries.slice(0, 5).map(({ entry, food }) =>
    `${entry.created_at} ${entry.log_method ?? '(method?)'}: ${foodSummary(food)}`,
  )
  const product = group.matchingProducts[0]
  if (product) {
    return {
      priority: hasUnitAlternatives(product.unit_alternatives) ? 'P3' : 'P2',
      decision: 'already_promoted',
      source_ref: group.source_ref,
      display_name: displayName,
      plain_english: 'A product row already appears to cover this external source ref; check unit quality if needed.',
      evidence: [`matching product: ${product.name ?? '(unnamed product)'} [lib:product:${product.id}]`, ...evidence],
      allowed_actions: ['repair product units if barcode/editor evidence shows friction'],
      blocked_actions: ['do not create a duplicate product for the same barcode/external id'],
    }
  }

  if (group.entries.length >= 2) {
    return {
      priority: 'P1',
      decision: 'review_for_promotion',
      source_ref: group.source_ref,
      display_name: displayName,
      plain_english: 'This external food has repeated saved evidence and may deserve a reviewed product row.',
      evidence,
      allowed_actions: ['verify label/OFF/USDA facts before product creation', 'preserve barcode or external id as provenance'],
      blocked_actions: ['do not promote without reviewed serving and unit facts'],
    }
  }

  return {
    priority: group.hasBarcodeLog ? 'P2' : 'P3',
    decision: 'watch',
    source_ref: group.source_ref,
    display_name: displayName,
    plain_english: group.hasBarcodeLog
      ? 'This external food came from barcode logging once. Watch for repeat clean saves or edits before promoting.'
      : 'This external food has one saved observation. Watch for repeats before promoting.',
    evidence,
    allowed_actions: ['keep as external evidence until it repeats or gets edited'],
    blocked_actions: ['do not create a product from one observation unless Luke explicitly asks'],
  }
}

function renderReport(groups: ExternalGroup[], packets: PromotionPacket[]): string {
  const counts = packets.reduce<Record<string, number>>((acc, packet) => {
    acc[packet.decision] = (acc[packet.decision] ?? 0) + 1
    return acc
  }, {})
  const lines: string[] = []
  lines.push('External Product Promotion Report')
  lines.push('')
  lines.push('Summary')
  lines.push(`- external_source_refs: ${groups.length}`)
  lines.push(`- already_promoted: ${counts.already_promoted ?? 0}`)
  lines.push(`- review_for_promotion: ${counts.review_for_promotion ?? 0}`)
  lines.push(`- watch: ${counts.watch ?? 0}`)
  lines.push('')
  lines.push('Promotion Packets')
  for (const [index, packet] of packets.entries()) {
    lines.push(`${index + 1}. [${packet.priority}] ${packet.display_name} (${packet.source_ref})`)
    lines.push(`   - decision: ${packet.decision}`)
    lines.push(`   - plain_english: ${packet.plain_english}`)
    lines.push(`   - evidence: ${packet.evidence.slice(0, 3).join(' | ')}`)
    lines.push(`   - allowed: ${packet.allowed_actions[0]}`)
    lines.push(`   - blocked: ${packet.blocked_actions[0]}`)
  }
  if (packets.length === 0) lines.push('- (none)')
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
      .select('id,logged_at,meal_label,log_method,raw_input_text,foods_json,created_at')
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
  const packets = groups.map(packetForGroup).sort((a, b) => {
    const priority = { P1: 3, P2: 2, P3: 1 }
    return priority[b.priority] - priority[a.priority] || a.display_name.localeCompare(b.display_name)
  })

  console.log(renderReport(groups, packets))
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ groups, packets }, null, 2))
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
