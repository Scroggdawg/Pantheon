// Read-only barcode failure review packet.
//
// Usage:
//   npx tsx scripts/report-barcode-failure-review.ts
//   npx tsx scripts/report-barcode-failure-review.ts --json
//
// This script classifies barcode telemetry failures into useful repair lanes.
// It does not mutate production data.

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

interface FoodLogEventRow {
  id: string
  event_type: string
  raw_input_text: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

interface FoodLogEntryRow {
  id: string
  log_method: string | null
  raw_input_text: string | null
  foods_json: FoodLike[] | null
  created_at: string
}

interface BarcodeFailurePacket {
  priority: 'P1' | 'P2' | 'P3'
  bucket: 'missing_product_coverage' | 'incomplete_macros' | 'camera_or_permission' | 'fallback_parse' | 'unknown'
  barcode: string | null
  plain_english: string
  evidence: string[]
  likely_owner: 'pantry_forge' | 'native_ui' | 'backend_lookup' | 'quartermaster_watch'
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

function payloadString(payload: Record<string, unknown> | null, key: string): string | null {
  const value = payload?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function payloadNumber(payload: Record<string, unknown> | null, key: string): number | null {
  const value = payload?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function barcodeFromText(value: string | null | undefined): string | null {
  const match = /\[BARCODE:\s*([^\]\s]+)\]/i.exec(value ?? '')
  return match?.[1] ?? null
}

function asFoods(value: unknown): FoodLike[] {
  return Array.isArray(value) ? (value as FoodLike[]) : []
}

function sourceRefs(entry: FoodLogEntryRow): string[] {
  return asFoods(entry.foods_json)
    .map((food) => food.source_ref)
    .filter((ref): ref is string => Boolean(ref))
}

function classifyFailure(event: FoodLogEventRow, savedEntries: FoodLogEntryRow[]): BarcodeFailurePacket {
  const barcode = payloadString(event.payload, 'barcode') ?? barcodeFromText(event.raw_input_text)
  const error = payloadString(event.payload, 'error')
  const source = payloadString(event.payload, 'source')
  const lookupMs = payloadNumber(event.payload, 'lookup_ms')
  const httpStatus = payloadNumber(event.payload, 'http_status')
  const candidateCount = payloadNumber(event.payload, 'candidate_count')
  const entriesForBarcode = barcode
    ? savedEntries.filter((entry) => barcodeFromText(entry.raw_input_text) === barcode)
    : []
  const savedRefs = entriesForBarcode.flatMap(sourceRefs)
  const evidence = [
    `${event.created_at}: error=${error ?? '(none)'}`,
    `source=${source ?? '(none)'} http_status=${httpStatus ?? '(none)'} lookup_ms=${lookupMs ?? '(none)'} candidate_count=${candidateCount ?? '(none)'}`,
    entriesForBarcode.length > 0 ? `eventual saved refs: ${savedRefs.join(', ') || '(none)'}` : 'no saved barcode log found after this failure',
  ]

  if (error?.includes('permission') || error?.includes('camera')) {
    return {
      priority: 'P1',
      bucket: 'camera_or_permission',
      barcode,
      plain_english: 'The scanner likely failed before product lookup. This is a native UX or permission issue, not a pantry issue.',
      evidence,
      likely_owner: 'native_ui',
      next_action: 'Ask native UI lane to verify permission/camera empty-state handling and telemetry fields.',
      stop_rule: 'Do not create product rows for camera or permission failures.',
    }
  }

  if (error === 'no_barcode_product_with_complete_macros') {
    return {
      priority: entriesForBarcode.length > 0 ? 'P2' : 'P1',
      bucket: 'incomplete_macros',
      barcode,
      plain_english: 'Lookup found no durable product with complete macros. If the user saved an external result afterward, this becomes a product coverage candidate.',
      evidence,
      likely_owner: 'pantry_forge',
      next_action: 'Review the eventual external saved food, verify label facts, then decide whether to promote it to a product.',
      stop_rule: 'Do not auto-promote from one scan or incomplete macro result.',
    }
  }

  if (source === 'not_found' || candidateCount === 0) {
    return {
      priority: 'P2',
      bucket: 'missing_product_coverage',
      barcode,
      plain_english: 'The barcode did not match usable local/OFF/USDA coverage. Repeats should become product coverage work.',
      evidence,
      likely_owner: 'pantry_forge',
      next_action: 'Watch for repeat scans or Luke confirmation before adding product coverage.',
      stop_rule: 'Do not create broad aliases from barcode misses.',
    }
  }

  if (entriesForBarcode.some((entry) => entry.log_method === 'barcode' || (entry.raw_input_text ?? '').includes('[BARCODE:'))) {
    return {
      priority: 'P3',
      bucket: 'fallback_parse',
      barcode,
      plain_english: 'The barcode path had a failure event, but a barcode-backed log still saved. Treat this as quality telemetry, not a user-blocking failure.',
      evidence,
      likely_owner: 'quartermaster_watch',
      next_action: 'Compare displayed and saved food facts if edit telemetry exists.',
      stop_rule: 'Do not file a blocking bug unless saves fail or edits repeat.',
    }
  }

  return {
    priority: 'P3',
    bucket: 'unknown',
    barcode,
    plain_english: 'Quartermaster does not yet have enough detail to route this failure confidently.',
    evidence,
    likely_owner: 'quartermaster_watch',
    next_action: 'Improve barcode failure telemetry fields if this repeats.',
    stop_rule: 'Do not guess a product or parser repair from unknown telemetry.',
  }
}

function render(packets: BarcodeFailurePacket[]): string {
  const counts = packets.reduce<Record<string, number>>((acc, packet) => {
    acc[packet.bucket] = (acc[packet.bucket] ?? 0) + 1
    return acc
  }, {})
  const lines: string[] = []
  lines.push('Barcode Failure Review Packet')
  lines.push('')
  lines.push('Summary')
  lines.push(`- failures_reviewed: ${packets.length}`)
  lines.push(`- missing_product_coverage: ${counts.missing_product_coverage ?? 0}`)
  lines.push(`- incomplete_macros: ${counts.incomplete_macros ?? 0}`)
  lines.push(`- camera_or_permission: ${counts.camera_or_permission ?? 0}`)
  lines.push(`- fallback_parse: ${counts.fallback_parse ?? 0}`)
  lines.push(`- unknown: ${counts.unknown ?? 0}`)
  lines.push('')
  lines.push('Failure Review')
  for (const [index, packet] of packets.entries()) {
    lines.push(`${index + 1}. [${packet.priority}] ${packet.bucket}${packet.barcode ? ` (${packet.barcode})` : ''}`)
    lines.push(`   - owner: ${packet.likely_owner}`)
    lines.push(`   - plain_english: ${packet.plain_english}`)
    lines.push(`   - next_action: ${packet.next_action}`)
    lines.push(`   - stop_rule: ${packet.stop_rule}`)
    lines.push(`   - evidence: ${packet.evidence.join(' | ')}`)
  }
  if (packets.length === 0) lines.push('- No barcode failures found.')
  return lines.join('\n')
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')

  const supabase = createClient(url, key)
  const [eventsRes, entriesRes] = await Promise.all([
    supabase
      .from('food_log_events')
      .select('id,event_type,raw_input_text,payload,created_at')
      .eq('event_type', 'barcode_scan_failed')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('food_log_entries')
      .select('id,log_method,raw_input_text,foods_json,created_at')
      .or('log_method.eq.barcode,raw_input_text.ilike.%[BARCODE:%')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  if (eventsRes.error) throw new Error(`food_log_events query failed: ${eventsRes.error.message}`)
  if (entriesRes.error) throw new Error(`food_log_entries query failed: ${entriesRes.error.message}`)

  const events = (eventsRes.data ?? []) as FoodLogEventRow[]
  const entries = (entriesRes.data ?? []) as FoodLogEntryRow[]
  const packets = events.map((event) => classifyFailure(event, entries)).sort((a, b) => {
    const priority = { P1: 3, P2: 2, P3: 1 }
    return priority[b.priority] - priority[a.priority] || (a.barcode ?? '').localeCompare(b.barcode ?? '')
  })

  console.log(render(packets))
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ packets }, null, 2))
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
