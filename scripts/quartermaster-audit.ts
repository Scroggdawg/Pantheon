// Quartermaster v0: read-only food logging audit.
//
// This script reads Pantheon's visible food log history, compares original
// parse output to saved output, and emits local action packets. It does not
// write production data.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeFoodText } from '../lib/pantry-builder/normalize'

type Severity = 'low' | 'medium' | 'high'
type FindingType =
  | 'parse_slow'
  | 'llm_fallback_expensive'
  | 'low_confidence_saved'
  | 'llm_estimated_saved'
  | 'database_estimated_saved'
  | 'source_ref_stale'
  | 'source_ref_chained'
  | 'parse_saved_delta_calories'
  | 'parse_saved_delta_food_count'
  | 'parse_saved_name_changed'
  | 'parse_saved_unit_changed'
  | 'parse_saved_quantity_changed'
  | 'unit_missing_or_weak'
  | 'user_measurement_not_preserved'
  | 'joke_or_non_food'
  | 'save_failed_event'
  | 'parse_failed_event'
  | 'parse_abandoned_event'
  | 'edit_event'
  | 'telemetry_gap'

type ActionLane =
  | 'alias_add'
  | 'rejection_add'
  | 'pantry_product_add'
  | 'product_unit_add'
  | 'saved_meal_repair'
  | 'parser_bug'
  | 'native_ui_or_telemetry'
  | 'ignore_or_joke'
  | 'manual_review'

interface Args {
  since: string | null
  limit: number | null
  json: boolean
  markdown: boolean
  outputDir: string
}

interface TelemetrySnapshot {
  latency_ms?: number
  total_route_latency_ms?: number
  response_cache_hit?: boolean
  library_shortcut_hit?: boolean
  library_segmented_hit?: boolean
  library_segmented_partial_hit?: boolean
  library_candidates_hit?: boolean
  fallback_llm_hit?: boolean
  tool_calls?: number
  iters?: number
  cache_hits?: number
  whisper_latency_ms?: number
}

interface MatchConfidence {
  score?: number
  label?: string
  warnings?: string[]
}

interface FoodLike {
  name?: string
  qty?: number
  unit?: string
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  source?: string
  source_ref?: string | null
  match_confidence?: MatchConfidence
  unit_alternatives?: unknown[]
}

interface FoodLogRow {
  id: string
  user_id: string
  logged_at: string
  meal_label: string | null
  log_method: string | null
  raw_input_text: string | null
  foods_json: FoodLike[] | null
  total_calories: number | null
  total_protein_g: number | null
  total_carbs_g: number | null
  total_fat_g: number | null
  claude_parse_json: {
    foods?: FoodLike[]
    _telemetry?: TelemetrySnapshot
    error?: string
  } | null
  saved_meal_id?: string | null
  created_at: string
}

interface FoodLogEventRow {
  id: string
  user_id: string
  food_log_entry_id: string | null
  session_id: string | null
  event_type: string
  raw_input_text: string | null
  payload: Record<string, unknown> | null
  client_platform: string | null
  app_version: string | null
  created_at: string
}

interface Finding {
  id: string
  type: FindingType
  severity: Severity
  action_lane: ActionLane
  food_log_entry_id: string
  logged_at: string
  raw_input_text: string | null
  summary: string
  evidence: Record<string, unknown>
}

interface AuditReport {
  run_id: string
  generated_at: string
  args: Args
  summary: Record<string, number | string | null>
  path_counts: Record<string, number>
  finding_counts: Record<string, number>
  action_counts: Record<string, number>
  findings: Finding[]
  data_gaps: string[]
}

interface TranscriptMeasurement {
  text: string
  unit: string
  target: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    since: null,
    limit: null,
    json: true,
    markdown: true,
    outputDir: 'scripts/output',
  }

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--since=')) args.since = arg.slice('--since='.length)
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length))
    else if (arg === '--json-only') args.markdown = false
    else if (arg === '--markdown-only') args.json = false
    else if (arg.startsWith('--output-dir=')) args.outputDir = arg.slice('--output-dir='.length)
    else throw new Error(`Unknown arg: ${arg}`)
  }

  if (args.limit !== null && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error('--limit must be a positive integer')
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

function sinceToIso(since: string | null): string | null {
  if (!since) return null
  const days = /^(\d+)d$/.exec(since)
  if (days) {
    const ms = Number(days[1]) * 24 * 60 * 60 * 1000
    return new Date(Date.now() - ms).toISOString()
  }
  const parsed = new Date(since)
  if (Number.isNaN(parsed.getTime())) throw new Error('--since must be an ISO date or <N>d')
  return parsed.toISOString()
}

async function fetchAllFoodLogs(
  supabase: SupabaseClient,
  sinceIso: string | null,
  limit: number | null,
): Promise<FoodLogRow[]> {
  const rows: FoodLogRow[] = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    let query = supabase
      .from('food_log_entries')
      .select(
        'id,user_id,logged_at,meal_label,log_method,raw_input_text,foods_json,total_calories,total_protein_g,total_carbs_g,total_fat_g,claude_parse_json,saved_meal_id,created_at',
      )
      .order('created_at', { ascending: true })
      .range(from, to)

    if (sinceIso) query = query.gte('created_at', sinceIso)
    if (limit !== null) query = query.range(from, Math.min(to, limit - 1))

    const { data, error } = await query
    if (error) throw new Error(`food_log_entries query failed: ${error.message}`)
    rows.push(...((data ?? []) as FoodLogRow[]))
    if (!data || data.length < pageSize || (limit !== null && rows.length >= limit)) break
  }

  return limit === null ? rows : rows.slice(0, limit)
}

async function fetchAllFoodLogEvents(
  supabase: SupabaseClient,
  sinceIso: string | null,
  limit: number | null,
): Promise<{ rows: FoodLogEventRow[]; available: boolean; error: string | null }> {
  const rows: FoodLogEventRow[] = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    let query = supabase
      .from('food_log_events')
      .select('id,user_id,food_log_entry_id,session_id,event_type,raw_input_text,payload,client_platform,app_version,created_at')
      .order('created_at', { ascending: true })
      .range(from, to)

    if (sinceIso) query = query.gte('created_at', sinceIso)
    if (limit !== null) query = query.range(from, Math.min(to, limit - 1))

    const { data, error } = await query
    if (error) {
      if (/food_log_events|schema cache|does not exist/i.test(error.message)) {
        return { rows: [], available: false, error: error.message }
      }
      throw new Error(`food_log_events query failed: ${error.message}`)
    }

    rows.push(...((data ?? []) as FoodLogEventRow[]))
    if (!data || data.length < pageSize || (limit !== null && rows.length >= limit)) break
  }

  return { rows: limit === null ? rows : rows.slice(0, limit), available: true, error: null }
}

async function fetchLiveRefs(supabase: SupabaseClient) {
  const [{ data: savedMeals, error: savedMealsError }, { data: products, error: productsError }] =
    await Promise.all([
      supabase.from('saved_meals').select('id,name,total_calories,total_protein_g,total_carbs_g,total_fat_g,yield_servings,times_logged,last_logged_at'),
      supabase.from('products').select('id,name,brand,calories_per_serving,protein_g_per_serving,carbs_g_per_serving,fat_g_per_serving,unit,serving_size_g'),
    ])
  if (savedMealsError) throw new Error(`saved_meals query failed: ${savedMealsError.message}`)
  if (productsError) throw new Error(`products query failed: ${productsError.message}`)

  return {
    savedMealIds: new Set((savedMeals ?? []).map((row: { id: string }) => row.id)),
    productIds: new Set((products ?? []).map((row: { id: string }) => row.id)),
    savedMealCount: savedMeals?.length ?? 0,
    productCount: products?.length ?? 0,
  }
}

function telemetryPath(telemetry: TelemetrySnapshot | undefined): string {
  if (!telemetry) return 'missing_telemetry'
  if (telemetry.response_cache_hit) return 'response_cache'
  if (telemetry.library_shortcut_hit) return 'library_shortcut'
  if (telemetry.library_segmented_hit) return 'library_segmented_full'
  if (telemetry.library_segmented_partial_hit) return 'library_segmented_partial'
  if (telemetry.library_candidates_hit) return 'library_candidates'
  if (telemetry.fallback_llm_hit || (telemetry.tool_calls ?? 0) > 0 || (telemetry.iters ?? 0) > 0) return 'llm_fallback'
  return 'unknown_path'
}

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function displayFood(food: FoodLike | undefined): string {
  if (!food) return '(missing)'
  const qty = numeric(food.qty)
  const qtyText = qty === null ? '?' : String(qty)
  return `${food.name ?? '(unnamed)'} - ${qtyText} ${food.unit ?? '(no unit)'} - ${food.calories ?? '?'} cal`
}

function sourceRefKind(ref: string | null | undefined): { kind: 'saved_meal' | 'product' | 'other' | 'none'; id: string | null } {
  if (!ref) return { kind: 'none', id: null }
  if (ref.startsWith('lib:saved_meal:')) return { kind: 'saved_meal', id: ref.slice('lib:saved_meal:'.length) }
  if (ref.startsWith('lib:product:')) return { kind: 'product', id: ref.slice('lib:product:'.length) }
  return { kind: 'other', id: null }
}

function probablyNonFood(raw: string | null): boolean {
  if (!raw) return false
  const text = normalizeFoodText(raw)
  return /\b(plutonium|how many calories|calories are in|joke|lol|test test)\b/.test(text)
}

function transcriptMeasurements(raw: string | null): TranscriptMeasurement[] {
  if (!raw) return []
  const measurements: TranscriptMeasurement[] = []
  const matches = raw.matchAll(
    /\b(\d+(?:\.\d+)?)\s*(grams?|g|ounces?|oz|strawberries|berries|scoops?|bars?|cartons?|bottles?|cups?|servings?|shakes?)\b(?:\s+of\s+([a-zA-Z][a-zA-Z '\-]{0,50}))?/gi,
  )
  for (const match of matches) {
    const text = `${match[1]} ${match[2].toLowerCase()}`
    const target = normalizeFoodText(match[3] ?? '')
    const before = normalizeFoodText(raw.slice(Math.max(0, match.index - 30), match.index))
    const unit = normalizeFoodText(match[2])

    const isMacroFact =
      /\b(protein|fat|carbs?|carbohydrates?|fiber|sugar|sodium)\b/.test(target) ||
      /\b(protein|fat|carbs?|carbohydrates?|fiber|sugar|sodium)\s*$/.test(before)
    const isLabelServing =
      /\b(serving size|servings per container|per serving|says)\b/.test(before) &&
      !/\b(of|chicken|water|potato|potatoes|rice|steak|beef|turkey|egg|eggs)\b/.test(target)

    if (isMacroFact || isLabelServing) continue
    if ((unit === 'grams' || unit === 'gram' || unit === 'g' || unit === 'ounces' || unit === 'ounce' || unit === 'oz') && !target) continue
    measurements.push({ text, unit, target })
  }
  return measurements
}

function unitPreservesMeasurement(unit: string | undefined, measurement: TranscriptMeasurement): boolean {
  const normalizedUnit = normalizeFoodText(unit ?? '')
  const normalizedMeasurement = normalizeFoodText(measurement.text)
  if (!normalizedUnit) return false
  if (/\b(grams?|g)\b/.test(normalizedMeasurement)) return normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams'
  if (/\b(ounces?|oz)\b/.test(normalizedMeasurement)) return normalizedUnit === 'oz' || normalizedUnit === 'ounce' || normalizedUnit === 'ounces'
  if (/\bstrawberries\b/.test(normalizedMeasurement)) return normalizedUnit.includes('strawberr')
  if (/\bscoops?\b/.test(normalizedMeasurement)) return normalizedUnit.includes('scoop')
  if (/\bbars?\b/.test(normalizedMeasurement)) return normalizedUnit.includes('bar')
  if (/\bcartons?\b/.test(normalizedMeasurement)) return normalizedUnit.includes('carton')
  if (/\bbottles?\b/.test(normalizedMeasurement)) return normalizedUnit.includes('bottle')
  if (/\bcups?\b/.test(normalizedMeasurement)) return normalizedUnit.includes('cup')
  if (/\bshakes?\b/.test(normalizedMeasurement)) return normalizedUnit.includes('shake')
  return true
}

function pushFinding(findings: Finding[], row: FoodLogRow, partial: Omit<Finding, 'id' | 'food_log_entry_id' | 'logged_at' | 'raw_input_text'>) {
  findings.push({
    id: randomUUID(),
    food_log_entry_id: row.id,
    logged_at: row.logged_at,
    raw_input_text: row.raw_input_text,
    ...partial,
  })
}

function compareFoods(row: FoodLogRow, findings: Finding[]) {
  const parsedFoods = row.claude_parse_json?.foods ?? []
  const savedFoods = row.foods_json ?? []
  if (parsedFoods.length === 0 || savedFoods.length === 0) return

  if (parsedFoods.length !== savedFoods.length) {
    pushFinding(findings, row, {
      type: 'parse_saved_delta_food_count',
      severity: 'high',
      action_lane: 'manual_review',
      summary: `Parsed ${parsedFoods.length} foods but saved ${savedFoods.length}.`,
      evidence: { parsed_count: parsedFoods.length, saved_count: savedFoods.length },
    })
  }

  const count = Math.min(parsedFoods.length, savedFoods.length)
  for (let index = 0; index < count; index += 1) {
    const parsed = parsedFoods[index]
    const saved = savedFoods[index]
    const parsedName = normalizeFoodText(parsed.name ?? '')
    const savedName = normalizeFoodText(saved.name ?? '')
    if (parsedName && savedName && parsedName !== savedName) {
      pushFinding(findings, row, {
        type: 'parse_saved_name_changed',
        severity: 'medium',
        action_lane: 'alias_add',
        summary: `Food ${index + 1} name changed from "${parsed.name}" to "${saved.name}".`,
        evidence: { index, parsed: displayFood(parsed), saved: displayFood(saved) },
      })
    }

    if ((parsed.unit ?? '') !== (saved.unit ?? '')) {
      pushFinding(findings, row, {
        type: 'parse_saved_unit_changed',
        severity: 'medium',
        action_lane: 'product_unit_add',
        summary: `Food ${index + 1} unit changed from "${parsed.unit ?? '(missing)'}" to "${saved.unit ?? '(missing)'}".`,
        evidence: { index, parsed: displayFood(parsed), saved: displayFood(saved) },
      })
    }

    const parsedQty = numeric(parsed.qty)
    const savedQty = numeric(saved.qty)
    if (parsedQty !== null && savedQty !== null && Math.abs(parsedQty - savedQty) > 0.01) {
      pushFinding(findings, row, {
        type: 'parse_saved_quantity_changed',
        severity: 'medium',
        action_lane: 'product_unit_add',
        summary: `Food ${index + 1} quantity changed from ${parsedQty} to ${savedQty}.`,
        evidence: { index, parsed: displayFood(parsed), saved: displayFood(saved) },
      })
    }

    const parsedCalories = numeric(parsed.calories)
    const savedCalories = numeric(saved.calories)
    if (parsedCalories !== null && savedCalories !== null) {
      const delta = Math.abs(parsedCalories - savedCalories)
      const threshold = Math.max(25, parsedCalories * 0.15)
      if (delta >= threshold) {
        pushFinding(findings, row, {
          type: 'parse_saved_delta_calories',
          severity: delta >= Math.max(75, parsedCalories * 0.3) ? 'high' : 'medium',
          action_lane: 'manual_review',
          summary: `Food ${index + 1} calories changed by ${Math.round(delta)}.`,
          evidence: { index, parsed: displayFood(parsed), saved: displayFood(saved), delta },
        })
      }
    }
  }
}

function inspectFoodSources(
  row: FoodLogRow,
  findings: Finding[],
  savedMealIds: Set<string>,
  productIds: Set<string>,
) {
  const foods = [...(row.claude_parse_json?.foods ?? []), ...(row.foods_json ?? [])]
  for (const food of foods) {
    const ref = food.source_ref ?? null
    if (ref?.includes('lib:hourly_go_to:')) {
      pushFinding(findings, row, {
        type: 'source_ref_chained',
        severity: 'high',
        action_lane: 'parser_bug',
        summary: `Source ref is chained for "${food.name ?? '(unnamed food)'}".`,
        evidence: { source_ref: ref, food: displayFood(food) },
      })
    }

    const kind = sourceRefKind(ref)
    if (kind.kind === 'saved_meal' && kind.id && !savedMealIds.has(kind.id)) {
      pushFinding(findings, row, {
        type: 'source_ref_stale',
        severity: 'high',
        action_lane: 'saved_meal_repair',
        summary: `Saved-meal source ref no longer exists for "${food.name ?? '(unnamed food)'}".`,
        evidence: { source_ref: ref, food: displayFood(food) },
      })
    }
    if (kind.kind === 'product' && kind.id && !productIds.has(kind.id)) {
      pushFinding(findings, row, {
        type: 'source_ref_stale',
        severity: 'high',
        action_lane: 'pantry_product_add',
        summary: `Product source ref no longer exists for "${food.name ?? '(unnamed food)'}".`,
        evidence: { source_ref: ref, food: displayFood(food) },
      })
    }

    const confidence = food.match_confidence
    if (confidence?.label === 'low' || (typeof confidence?.score === 'number' && confidence.score < 0.65)) {
      pushFinding(findings, row, {
        type: 'low_confidence_saved',
        severity: 'medium',
        action_lane: 'manual_review',
        summary: `Low-confidence food was saved: "${food.name ?? '(unnamed food)'}".`,
        evidence: { food: displayFood(food), match_confidence: confidence },
      })
    }

    if (food.source === 'llm_estimated') {
      pushFinding(findings, row, {
        type: 'llm_estimated_saved',
        severity: 'high',
        action_lane: 'pantry_product_add',
        summary: `LLM-estimated food reached the saved plate: "${food.name ?? '(unnamed food)'}".`,
        evidence: { food: displayFood(food), source_ref: ref },
      })
    }

    if (food.source === 'database_estimated') {
      pushFinding(findings, row, {
        type: 'database_estimated_saved',
        severity: 'medium',
        action_lane: 'pantry_product_add',
        summary: `Database-estimated food reached the saved plate: "${food.name ?? '(unnamed food)'}".`,
        evidence: { food: displayFood(food), source_ref: ref },
      })
    }

    if (!food.unit || food.unit === 'serving' || !Array.isArray(food.unit_alternatives) || food.unit_alternatives.length === 0) {
      pushFinding(findings, row, {
        type: 'unit_missing_or_weak',
        severity: 'low',
        action_lane: 'product_unit_add',
        summary: `Food has a weak or generic unit surface: "${food.name ?? '(unnamed food)'}".`,
        evidence: { food: displayFood(food), unit_alternatives_count: Array.isArray(food.unit_alternatives) ? food.unit_alternatives.length : 0 },
      })
    }
  }
}

function inspectTelemetry(row: FoodLogRow, findings: Finding[]) {
  const telemetry = row.claude_parse_json?._telemetry
  if (!telemetry && row.log_method !== 'quick') {
    pushFinding(findings, row, {
      type: 'telemetry_gap',
      severity: 'medium',
      action_lane: 'native_ui_or_telemetry',
      summary: 'No parse telemetry was stored for this non-quick food log.',
      evidence: { log_method: row.log_method },
    })
    return
  }

  const latency = telemetry?.total_route_latency_ms ?? telemetry?.latency_ms
  if (typeof latency === 'number' && latency > 10000) {
    pushFinding(findings, row, {
      type: 'parse_slow',
      severity: latency > 20000 ? 'high' : 'medium',
      action_lane: 'parser_bug',
      summary: `Parse was slow: ${latency}ms.`,
      evidence: { telemetry, path: telemetryPath(telemetry) },
    })
  }

  if (telemetryPath(telemetry) === 'llm_fallback') {
    pushFinding(findings, row, {
      type: 'llm_fallback_expensive',
      severity: 'medium',
      action_lane: 'parser_bug',
      summary: 'Parse used the expensive LLM fallback path.',
      evidence: { telemetry },
    })
  }
}

function inspectTranscript(row: FoodLogRow, findings: Finding[]) {
  if (probablyNonFood(row.raw_input_text)) {
    pushFinding(findings, row, {
      type: 'joke_or_non_food',
      severity: 'low',
      action_lane: 'ignore_or_joke',
      summary: 'Transcript appears to be a joke, non-food, or calorie question rather than a real log.',
      evidence: { raw_input_text: row.raw_input_text },
    })
  }

  const measurements = transcriptMeasurements(row.raw_input_text)
  if (measurements.length === 0) return
  const foods = row.foods_json ?? row.claude_parse_json?.foods ?? []
  for (const measurement of measurements) {
    if (foods.length > 0 && !foods.some((food) => unitPreservesMeasurement(food.unit, measurement))) {
      pushFinding(findings, row, {
        type: 'user_measurement_not_preserved',
        severity: 'high',
        action_lane: 'native_ui_or_telemetry',
        summary: `User said "${measurement.text}", but no displayed food preserved that unit.`,
        evidence: {
          measurement,
          foods: foods.map(displayFood),
        },
      })
    }
  }
}

function inspectEvents(events: FoodLogEventRow[], findings: Finding[]) {
  for (const event of events) {
    const row: FoodLogRow = {
      id: event.food_log_entry_id ?? event.id,
      user_id: event.user_id,
      logged_at: event.created_at,
      meal_label: null,
      log_method: null,
      raw_input_text: event.raw_input_text,
      foods_json: null,
      total_calories: null,
      total_protein_g: null,
      total_carbs_g: null,
      total_fat_g: null,
      claude_parse_json: null,
      saved_meal_id: null,
      created_at: event.created_at,
    }

    if (event.event_type === 'save_failed') {
      pushFinding(findings, row, {
        type: 'save_failed_event',
        severity: 'high',
        action_lane: 'native_ui_or_telemetry',
        summary: 'Native reported a failed save.',
        evidence: { event },
      })
    } else if (event.event_type === 'parse_failed') {
      pushFinding(findings, row, {
        type: 'parse_failed_event',
        severity: 'high',
        action_lane: 'parser_bug',
        summary: 'Native reported a failed parse.',
        evidence: { event },
      })
    } else if (event.event_type === 'parse_abandoned') {
      pushFinding(findings, row, {
        type: 'parse_abandoned_event',
        severity: 'medium',
        action_lane: 'native_ui_or_telemetry',
        summary: 'Native reported a parse or plate was abandoned.',
        evidence: { event },
      })
    } else if (
      event.event_type === 'food_item_edited' ||
      event.event_type === 'food_item_deleted' ||
      event.event_type === 'food_item_added' ||
      event.event_type === 'disambiguation_selected'
    ) {
      pushFinding(findings, row, {
        type: 'edit_event',
        severity: 'medium',
        action_lane: event.event_type === 'disambiguation_selected' ? 'alias_add' : 'product_unit_add',
        summary: `Native reported ${event.event_type.replaceAll('_', ' ')}.`,
        evidence: { event },
      })
    }
  }
}

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1
}

function renderMarkdown(report: AuditReport) {
  const topFindings = [...report.findings]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 40)

  const lines: string[] = []
  lines.push(`# Quartermaster Audit ${report.run_id}`)
  lines.push('')
  lines.push(`Generated: ${report.generated_at}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  for (const [key, value] of Object.entries(report.summary)) lines.push(`- ${key}: ${value}`)
  lines.push('')
  lines.push('## Parser Paths')
  lines.push('')
  for (const [key, value] of sortedEntries(report.path_counts)) lines.push(`- ${key}: ${value}`)
  lines.push('')
  lines.push('## Finding Counts')
  lines.push('')
  for (const [key, value] of sortedEntries(report.finding_counts)) lines.push(`- ${key}: ${value}`)
  lines.push('')
  lines.push('## Action Lanes')
  lines.push('')
  for (const [key, value] of sortedEntries(report.action_counts)) lines.push(`- ${key}: ${value}`)
  lines.push('')
  lines.push('## Top Findings')
  lines.push('')
  for (const finding of topFindings) {
    lines.push(`### ${finding.severity.toUpperCase()} - ${finding.type}`)
    lines.push('')
    lines.push(`- transcript: ${finding.raw_input_text ?? '(none)'}`)
    lines.push(`- summary: ${finding.summary}`)
    lines.push(`- action lane: ${finding.action_lane}`)
    lines.push(`- log id: ${finding.food_log_entry_id}`)
    lines.push(`- logged at: ${finding.logged_at}`)
    lines.push('')
  }
  if (topFindings.length === 0) lines.push('No findings.')
  lines.push('')
  lines.push('## Data Gaps')
  lines.push('')
  for (const gap of report.data_gaps) lines.push(`- ${gap}`)
  return `${lines.join('\n')}\n`
}

function severityRank(severity: Severity) {
  if (severity === 'high') return 3
  if (severity === 'medium') return 2
  return 1
}

function sortedEntries(record: Record<string, number>) {
  return Object.entries(record).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function dedupeFindings(findings: Finding[]) {
  const seen = new Set<string>()
  const deduped: Finding[] = []
  for (const finding of findings) {
    const key = [
      finding.type,
      finding.severity,
      finding.action_lane,
      finding.food_log_entry_id,
      finding.summary,
      JSON.stringify(finding.evidence),
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(finding)
  }
  return deduped
}

async function main() {
  const args = parseArgs(process.argv)
  loadEnvLocal()
  const supabase = supabaseFromEnv()
  const runId = randomUUID()
  const generatedAt = new Date().toISOString()
  const sinceIso = sinceToIso(args.since)

  const [rows, eventResult, refs] = await Promise.all([
    fetchAllFoodLogs(supabase, sinceIso, args.limit),
    fetchAllFoodLogEvents(supabase, sinceIso, args.limit),
    fetchLiveRefs(supabase),
  ])
  const events = eventResult.rows

  const findings: Finding[] = []
  const pathCounts: Record<string, number> = {}
  let rowsWithRawInput = 0
  let rowsWithParseFoods = 0
  let rowsWithSavedFoods = 0
  let comparableRows = 0
  let likelyAcceptedUnchanged = 0

  for (const row of rows) {
    if (row.raw_input_text) rowsWithRawInput += 1
    if ((row.claude_parse_json?.foods?.length ?? 0) > 0) rowsWithParseFoods += 1
    if ((row.foods_json?.length ?? 0) > 0) rowsWithSavedFoods += 1
    if ((row.claude_parse_json?.foods?.length ?? 0) > 0 && (row.foods_json?.length ?? 0) > 0) {
      comparableRows += 1
      if (JSON.stringify(row.claude_parse_json?.foods) === JSON.stringify(row.foods_json)) {
        likelyAcceptedUnchanged += 1
      }
    }

    increment(pathCounts, telemetryPath(row.claude_parse_json?._telemetry))
    inspectTelemetry(row, findings)
    inspectTranscript(row, findings)
    compareFoods(row, findings)
    inspectFoodSources(row, findings, refs.savedMealIds, refs.productIds)
  }
  inspectEvents(events, findings)

  const dedupedFindings = dedupeFindings(findings)
  const findingCounts: Record<string, number> = {}
  const actionCounts: Record<string, number> = {}
  for (const finding of dedupedFindings) {
    increment(findingCounts, finding.type)
    increment(actionCounts, finding.action_lane)
  }

  const report: AuditReport = {
    run_id: runId,
    generated_at: generatedAt,
    args,
    summary: {
      rows_read: rows.length,
      rows_with_raw_input: rowsWithRawInput,
      event_rows_read: events.length,
      event_table_available: eventResult.available ? 'yes' : 'no',
      rows_with_parse_foods: rowsWithParseFoods,
      rows_with_saved_foods: rowsWithSavedFoods,
      parse_vs_save_comparable_rows: comparableRows,
      likely_accepted_unchanged_rows: likelyAcceptedUnchanged,
      live_saved_meals: refs.savedMealCount,
      live_products: refs.productCount,
      findings: dedupedFindings.length,
      since: args.since,
    },
    path_counts: pathCounts,
    finding_counts: findingCounts,
    action_counts: actionCounts,
    findings: dedupedFindings,
    data_gaps: [
      eventResult.available
        ? 'food_log_events is available. Failed saves, abandoned parses, and edit gestures depend on native clients sending events.'
        : `food_log_events is not available yet: ${eventResult.error ?? 'unknown error'}`,
      'Rows before Quartermaster v1 native telemetry still lack exact edit gestures, so parse-vs-save corrections remain inferred for historical logs.',
      'The app does not currently store a dedicated event when displayed units are unreadable or truncated; Quartermaster infers this from transcript units and saved units unless Luke reports it directly.',
    ],
  }

  const outputDir = resolve(args.outputDir)
  mkdirSync(outputDir, { recursive: true })
  const basePath = join(outputDir, `quartermaster-${runId}`)
  if (args.json) writeFileSync(`${basePath}.json`, JSON.stringify(report, null, 2))
  if (args.markdown) writeFileSync(`${basePath}.md`, renderMarkdown(report))

  console.log('Quartermaster Audit')
  console.log('')
  console.log(`run_id: ${runId}`)
  console.log(`rows_read: ${rows.length}`)
  console.log(`events_read: ${events.length}`)
  console.log(`findings: ${dedupedFindings.length}`)
  console.log(`json: ${args.json ? `${basePath}.json` : 'skipped'}`)
  console.log(`markdown: ${args.markdown ? `${basePath}.md` : 'skipped'}`)
}

main().catch((error) => {
  console.error('Quartermaster audit failed:', error)
  process.exit(1)
})
