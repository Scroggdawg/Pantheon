// Read-only barcode quality report for Quartermaster.
//
// Usage:
//   npx tsx scripts/report-barcode-quality.ts
//   npx tsx scripts/report-barcode-quality.ts --json
//
// This script joins barcode telemetry and barcode-backed saved food logs
// where possible. It does not write production data.

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
  logged_at: string
  meal_label: string | null
  log_method: string | null
  raw_input_text: string | null
  foods_json: FoodLike[] | null
  total_calories: number | null
  created_at: string
}

interface FoodLogEventRow {
  id: string
  food_log_entry_id: string | null
  session_id: string | null
  event_type: string
  raw_input_text: string | null
  payload: Record<string, unknown> | null
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

interface BarcodeSession {
  key: string
  barcode: string | null
  events: FoodLogEventRow[]
  savedEntries: FoodLogEntryRow[]
}

interface WorkPacket {
  priority: 'P1' | 'P2' | 'P3'
  title: string
  plain_english: string
  evidence: string[]
  allowed_actions: string[]
  blocked_actions: string[]
}

const BARCODE_EVENTS = new Set([
  'barcode_scan_started',
  'barcode_scan_resolved',
  'barcode_scan_failed',
  'barcode_product_selected',
  'barcode_product_edited',
  'barcode_log_saved',
])

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

function payloadString(payload: Record<string, unknown> | null, key: string): string | null {
  const value = payload?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function barcodeFromEvent(event: FoodLogEventRow): string | null {
  return payloadString(event.payload, 'barcode')
}

function barcodeFromText(value: string | null | undefined): string | null {
  const match = /\[BARCODE:\s*([^\]\s]+)\]/i.exec(value ?? '')
  return match?.[1] ?? null
}

function sourceRefKind(ref: string | null | undefined): 'product' | 'off' | 'usda' | 'saved_meal' | 'none' | 'other' {
  if (!ref) return 'none'
  if (ref.startsWith('lib:product:')) return 'product'
  if (ref.startsWith('off:')) return 'off'
  if (ref.startsWith('usda:')) return 'usda'
  if (ref.startsWith('lib:saved_meal:')) return 'saved_meal'
  return 'other'
}

function countBy<T>(rows: T[], keyFn: (row: T) => string | null | undefined): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const key = keyFn(row) || '(none)'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
}

function asFoods(value: unknown): FoodLike[] {
  return Array.isArray(value) ? (value as FoodLike[]) : []
}

function sessionKeyForEvent(event: FoodLogEventRow): string {
  const barcode = barcodeFromEvent(event)
  return event.session_id || event.food_log_entry_id || (barcode ? `barcode:${barcode}` : `event:${event.id}`)
}

function sessionKeyForEntry(entry: FoodLogEntryRow): string {
  const barcode = barcodeFromText(entry.raw_input_text)
  return barcode ? `barcode:${barcode}` : `entry:${entry.id}`
}

function foodSummary(food: FoodLike): string {
  return `${food.name ?? '(unnamed)'}${food.qty ? ` x${food.qty}` : ''}${food.unit ? ` ${food.unit}` : ''}${food.source_ref ? ` [${food.source_ref}]` : ''}`
}

function buildSessions(events: FoodLogEventRow[], entries: FoodLogEntryRow[]): BarcodeSession[] {
  const map = new Map<string, BarcodeSession>()
  for (const event of events) {
    const barcode = barcodeFromEvent(event)
    const key = barcode ? `barcode:${barcode}` : sessionKeyForEvent(event)
    const existing = map.get(key) ?? { key, barcode: barcodeFromEvent(event), events: [], savedEntries: [] }
    existing.events.push(event)
    existing.barcode = existing.barcode ?? barcodeFromEvent(event)
    map.set(key, existing)
  }
  for (const entry of entries) {
    const key = sessionKeyForEntry(entry)
    const existing = map.get(key) ?? { key, barcode: barcodeFromText(entry.raw_input_text), events: [], savedEntries: [] }
    existing.savedEntries.push(entry)
    existing.barcode = existing.barcode ?? barcodeFromText(entry.raw_input_text)
    map.set(key, existing)
  }
  return [...map.values()].sort((a, b) => {
    const aTime = a.events[0]?.created_at ?? a.savedEntries[0]?.created_at ?? ''
    const bTime = b.events[0]?.created_at ?? b.savedEntries[0]?.created_at ?? ''
    return bTime.localeCompare(aTime)
  })
}

function buildWorkPackets(args: {
  sessions: BarcodeSession[]
  failedEvents: FoodLogEventRow[]
  editedEvents: FoodLogEventRow[]
  entriesWithExternalRefs: FoodLogEntryRow[]
  productsMissingUnits: ProductRow[]
}): WorkPacket[] {
  const packets: WorkPacket[] = []
  if (args.failedEvents.length > 0) {
    packets.push({
      priority: 'P1',
      title: 'Review barcode scan failures',
      plain_english: 'Barcode misses or scanner failures show where scanning did not save time.',
      evidence: args.failedEvents.slice(0, 5).map((event) => `${event.created_at}: barcode=${barcodeFromEvent(event) ?? '(none)'} error=${payloadString(event.payload, 'error') ?? '(none)'}`),
      allowed_actions: [
        'classify failures as camera, lookup miss, permission, or fallback parse',
        'feed repeated lookup misses into reviewed product coverage',
      ],
      blocked_actions: [
        'do not auto-promote weak OFF rows from one failure',
        'do not block user logging if telemetry insert fails',
      ],
    })
  }
  if (args.editedEvents.length > 0) {
    packets.push({
      priority: 'P1',
      title: 'Review barcode-backed product edits',
      plain_english: 'Edits after a scan are high-signal evidence that product facts, units, or display quantity need repair.',
      evidence: args.editedEvents.slice(0, 5).map((event) => `${event.created_at}: barcode=${barcodeFromEvent(event) ?? '(none)'} selected=${payloadString(event.payload, 'selected_name') ?? '(unknown)'}`),
      allowed_actions: [
        'compare displayed quantity/unit to final quantity/unit',
        'repair product unit alternatives when edits repeat',
      ],
      blocked_actions: [
        'do not create saved-meal variants for barcode quantities',
      ],
    })
  }
  if (args.entriesWithExternalRefs.length > 0) {
    packets.push({
      priority: 'P2',
      title: 'Review external barcode refs for product promotion',
      plain_english: 'Some barcode logs may still be OFF/USDA-backed instead of durable product-backed identities.',
      evidence: args.entriesWithExternalRefs.slice(0, 5).map((entry) => {
        const foods = asFoods(entry.foods_json).map(foodSummary).join('; ')
        return `${entry.created_at}: ${foods}`
      }),
      allowed_actions: [
        'promote external barcode hits only after review or repeated clean saves',
        'prefer existing products.barcode when available',
      ],
      blocked_actions: [
        'do not create one saved meal per barcode',
        'do not treat OFF data as perfect without serving review',
      ],
    })
  }
  if (args.productsMissingUnits.length > 0) {
    packets.push({
      priority: 'P3',
      title: 'Improve barcode product unit surfaces',
      plain_english: 'Barcode-backed products without unit alternatives can parse but still be awkward to verify or edit.',
      evidence: args.productsMissingUnits.slice(0, 8).map((product) => `${product.name ?? '(unnamed product)'} barcode=${product.barcode ?? '(none)'}`),
      allowed_actions: [
        'add reviewed unit alternatives from labels or trusted sources',
      ],
      blocked_actions: [
        'do not guess serving conversions for branded products',
      ],
    })
  }
  if (packets.length === 0) {
    packets.push({
      priority: 'P3',
      title: 'Keep watching barcode quality',
      plain_english: 'No barcode quality blockers were visible in the current read-only report.',
      evidence: [`sessions=${args.sessions.length}`],
      allowed_actions: ['continue joining scan events to saves and edits'],
      blocked_actions: ['do not make product changes without repeated evidence'],
    })
  }
  return packets
}

function renderReport(args: {
  events: FoodLogEventRow[]
  entries: FoodLogEntryRow[]
  products: ProductRow[]
  sessions: BarcodeSession[]
  packets: WorkPacket[]
}): string {
  const eventCounts = countBy(args.events, (event) => event.event_type)
  const savedFoods = args.entries.flatMap((entry) => asFoods(entry.foods_json))
  const sourceCounts = countBy(savedFoods, (food) => sourceRefKind(food.source_ref))
  const barcodeProductsWithUnits = args.products.filter((product) => Array.isArray(product.unit_alternatives) && product.unit_alternatives.length > 0)

  const lines: string[] = []
  lines.push('Barcode Quality Report')
  lines.push('')
  lines.push('Summary')
  lines.push(`- barcode_events: ${args.events.length}`)
  lines.push(`- barcode_sessions: ${args.sessions.length}`)
  lines.push(`- barcode_saved_entries: ${args.entries.length}`)
  lines.push(`- products_with_barcode: ${args.products.length}`)
  lines.push(`- barcode_products_with_unit_alternatives: ${barcodeProductsWithUnits.length}`)
  lines.push('')
  lines.push('Event Counts')
  for (const [key, count] of Object.entries(eventCounts)) lines.push(`- ${key}: ${count}`)
  if (Object.keys(eventCounts).length === 0) lines.push('- (none)')
  lines.push('')
  lines.push('Saved Barcode Food Source Refs')
  for (const [key, count] of Object.entries(sourceCounts)) lines.push(`- ${key}: ${count}`)
  if (Object.keys(sourceCounts).length === 0) lines.push('- (none)')
  lines.push('')
  lines.push('Recent Sessions')
  for (const session of args.sessions.slice(0, 10)) {
    const events = session.events.map((event) => event.event_type).join(', ') || '(no events)'
    const foods = session.savedEntries.flatMap((entry) => asFoods(entry.foods_json)).map(foodSummary).join('; ') || '(no saved foods)'
    lines.push(`- ${session.key} | barcode=${session.barcode ?? '(none)'} | events=${events} | saved=${foods}`)
  }
  if (args.sessions.length === 0) lines.push('- (none)')
  lines.push('')
  lines.push('Work Packets')
  for (const [index, packet] of args.packets.entries()) {
    lines.push(`${index + 1}. [${packet.priority}] ${packet.title}`)
    lines.push(`   - plain_english: ${packet.plain_english}`)
    lines.push(`   - evidence: ${packet.evidence.slice(0, 3).join(' | ') || '(none)'}`)
    lines.push(`   - allowed: ${packet.allowed_actions[0]}`)
    lines.push(`   - blocked: ${packet.blocked_actions[0]}`)
  }
  return lines.join('\n')
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')

  const supabase = createClient(url, key)
  const [eventsRes, entriesRes, productsRes] = await Promise.all([
    supabase
      .from('food_log_events')
      .select('id,food_log_entry_id,session_id,event_type,raw_input_text,payload,created_at')
      .in('event_type', [...BARCODE_EVENTS])
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('food_log_entries')
      .select('id,logged_at,meal_label,log_method,raw_input_text,foods_json,total_calories,created_at')
      .or('log_method.eq.barcode,raw_input_text.ilike.%[BARCODE:%')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('products')
      .select('id,name,barcode,provenance_source_kind,provenance_external_id,unit_alternatives')
      .not('barcode', 'is', null)
      .order('name', { ascending: true }),
  ])

  if (eventsRes.error) throw new Error(`food_log_events query failed: ${eventsRes.error.message}`)
  if (entriesRes.error) throw new Error(`food_log_entries query failed: ${entriesRes.error.message}`)
  if (productsRes.error) throw new Error(`products query failed: ${productsRes.error.message}`)

  const events = (eventsRes.data ?? []) as FoodLogEventRow[]
  const entries = (entriesRes.data ?? []) as FoodLogEntryRow[]
  const products = (productsRes.data ?? []) as ProductRow[]
  const sessions = buildSessions(events, entries)
  const editedEvents = events.filter((event) => event.event_type === 'barcode_product_edited')
  const failedEvents = events.filter((event) => event.event_type === 'barcode_scan_failed')
  const entriesWithExternalRefs = entries.filter((entry) =>
    asFoods(entry.foods_json).some((food) => {
      const kind = sourceRefKind(food.source_ref)
      return kind === 'off' || kind === 'usda'
    }),
  )
  const productsMissingUnits = products.filter((product) => !Array.isArray(product.unit_alternatives) || product.unit_alternatives.length === 0)
  const packets = buildWorkPackets({ sessions, failedEvents, editedEvents, entriesWithExternalRefs, productsMissingUnits })

  const report = renderReport({ events, entries, products, sessions, packets })
  console.log(report)
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({
      barcode_events: events.length,
      barcode_sessions: sessions.length,
      barcode_saved_entries: entries.length,
      products_with_barcode: products.length,
      barcode_product_edits: editedEvents.length,
      barcode_scan_failures: failedEvents.length,
      external_ref_saved_entries: entriesWithExternalRefs.length,
      barcode_products_missing_units: productsMissingUnits.length,
      packets,
    }, null, 2))
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
