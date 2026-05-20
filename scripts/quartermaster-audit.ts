// Quartermaster: read-only food logging audit and work-packet generator.
//
// This script reads Pantheon's visible food log history, compares original
// parse output to saved output, and emits local action packets. It does not
// write production data.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeFoodText } from '../lib/pantry-builder/normalize'

type Severity = 'low' | 'medium' | 'high'
type Priority = 'P0' | 'P1' | 'P2' | 'P3'
type Confidence = 'low' | 'medium' | 'high'
type ThemeUrgency = 'fix_now' | 'fix_next' | 'watch' | 'defer'
type ThemeMaturity = 'strong_pattern' | 'emerging_pattern' | 'single_incident' | 'too_broad'
type ThemeExecutionMode = 'observe_only' | 'plan_only' | 'narrow_repair' | 'human_review_required'
type ThemeKind =
  | 'protein_shake_composition'
  | 'quantity_display_trust'
  | 'stale_library_identity'
  | 'identity_fracture'
  | 'duplicate_food_rows'
  | 'slow_parse_missing_knowledge'
  | 'pantry_unit_surface'
  | 'human_review_delta'
  | 'save_path_reliability'
  | 'telemetry_observability'
  | 'manual_review'
type FindingType =
  | 'parse_slow'
  | 'llm_fallback_expensive'
  | 'low_confidence_saved'
  | 'llm_estimated_saved'
  | 'database_estimated_saved'
  | 'source_ref_stale'
  | 'source_ref_chained'
  | 'duplicate_food_row'
  | 'parse_saved_delta_calories'
  | 'parse_saved_delta_food_count'
  | 'parse_saved_name_changed'
  | 'parse_saved_unit_changed'
  | 'parse_saved_quantity_changed'
  | 'unit_missing_or_weak'
  | 'user_measurement_not_preserved'
  | 'identity_fracture'
  | 'joke_or_non_food'
  | 'save_failed_event'
  | 'parse_failed_event'
  | 'parse_abandoned_event'
  | 'edit_event'
  | 'barcode_scan_failed_event'
  | 'barcode_scan_edited'
  | 'orphan_save_event'
  | 'telemetry_gap'

type OutcomeType =
  | 'clean_success'
  | 'slow_success'
  | 'edited_success'
  | 'identity_failure'
  | 'quantity_unit_failure'
  | 'coverage_failure'
  | 'confidently_wrong'
  | 'save_path_failure'
  | 'joke_or_non_log'
  | 'ambiguous_review'

type ActionLane =
  | 'alias_add'
  | 'rejection_add'
  | 'pantry_product_add'
  | 'product_unit_add'
  | 'saved_meal_repair'
  | 'parser_bug'
  | 'backend_bug'
  | 'native_ui_or_telemetry'
  | 'ignore_or_joke'
  | 'manual_review'

interface Args {
  since: string | null
  limit: number | null
  json: boolean
  markdown: boolean
  outputDir: string
  cycle: boolean
  stateFile: string | null
  writeState: boolean
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

interface SavedMealRefRow {
  id: string
  name: string | null
  foods_json: FoodLike[] | null
  total_calories: number | null
  total_protein_g: number | null
  total_carbs_g: number | null
  total_fat_g: number | null
  yield_servings: number | null
  times_logged: number | null
  last_logged_at: string | null
  is_favorite: boolean | null
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
  score: number
  food_log_entry_id: string
  logged_at: string
  raw_input_text: string | null
  summary: string
  evidence: Record<string, unknown>
}

interface InteractionOutcome {
  id: string
  outcome: OutcomeType
  grade: 'pass' | 'warn' | 'fail' | 'unknown'
  action_lane: ActionLane
  score: number
  session_id: string | null
  food_log_entry_id: string | null
  raw_input_text: string | null
  started_at: string
  ended_at: string
  summary: string
  evidence: Record<string, unknown>
}

interface WorkPacket {
  id: string
  stable_key: string
  priority: Priority
  score: number
  confidence: Confidence
  action_lane: ActionLane
  owner: string
  title: string
  recommended_action: string
  why_it_matters: string
  root_cause_hypothesis: string
  likely_surfaces: string[]
  acceptance_criteria: string[]
  regression_tests: string[]
  do_not_do: string
  expected_metric: string
  evidence_count: number
  finding_types: FindingType[]
  example_transcripts: string[]
  finding_ids: string[]
}

interface ThemeExecutionPlan {
  goal: string
  grouping_scope: string
  execution_mode: ThemeExecutionMode
  ordered_steps: string[]
  safety_gates: string[]
  allowed_actions: string[]
  blocked_actions: string[]
  acceptance_criteria: string[]
  regression_tests: string[]
  do_not_do: string[]
  expected_metrics: string[]
}

interface LearningTheme {
  id: string
  stable_key: string
  kind: ThemeKind
  title: string
  priority: Priority
  score: number
  confidence: Confidence
  action_lanes: ActionLane[]
  owner: string
  summary: string
  luke_summary: string
  urgency: ThemeUrgency
  maturity: ThemeMaturity
  why_this_is_one_theme: string
  subtheme_hints: string[]
  next_checkpoint: string
  doctrine: string
  durable_fix: string
  avoid: string
  evidence_count: number
  finding_types: FindingType[]
  example_transcripts: string[]
  finding_ids: string[]
  related_packet_ids: string[]
  strongest_packet_ids: string[]
  strongest_packet_titles: string[]
  execution_plan: ThemeExecutionPlan
}

interface CycleState {
  version: 2
  last_successful_run_at: string
  last_run_id: string
  last_rows_read: number
  last_events_read: number
  last_findings: number
  last_learning_themes: number
  last_work_packets: number
  last_theme_keys: string[]
  last_packet_keys: string[]
  last_finding_keys: string[]
  updated_at: string
}

interface CycleMemory {
  available: boolean
  previous_run_at: string | null
  previous_run_id: string | null
  theme_new: string[]
  theme_repeated: string[]
  theme_resolved: string[]
  packet_new: string[]
  packet_repeated: string[]
  packet_resolved: string[]
  finding_new_count: number
  finding_repeated_count: number
  finding_resolved_count: number
  plain_english: string
}

interface QuartermasterReadiness {
  status: 'blocked' | 'active_repair' | 'checkpoint_ready'
  grade: string
  plain_english: string
  stop_conditions_met: string[]
  remaining_risks: string[]
  next_best_step: string
}

interface AuditReport {
  run_id: string
  generated_at: string
  args: Args
  cycle: {
    enabled: boolean
    state_file: string | null
    previous_run_at: string | null
    effective_since: string | null
    since_source: string
    state_written: boolean
  }
  summary: Record<string, number | string | null>
  scoreboard: Record<string, number | string | null>
  path_counts: Record<string, number>
  outcome_counts: Record<string, number>
  finding_counts: Record<string, number>
  action_counts: Record<string, number>
  cycle_memory: CycleMemory
  readiness: QuartermasterReadiness
  learning_themes: LearningTheme[]
  work_packets: WorkPacket[]
  interaction_outcomes: InteractionOutcome[]
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
    cycle: false,
    stateFile: null,
    writeState: true,
  }

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--since=')) args.since = arg.slice('--since='.length)
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length))
    else if (arg === '--json-only') args.markdown = false
    else if (arg === '--markdown-only') args.json = false
    else if (arg.startsWith('--output-dir=')) args.outputDir = arg.slice('--output-dir='.length)
    else if (arg === '--cycle') args.cycle = true
    else if (arg === '--no-state-write') args.writeState = false
    else if (arg.startsWith('--state-file=')) args.stateFile = arg.slice('--state-file='.length)
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

function defaultStateFile(args: Args): string {
  return resolve(args.stateFile ?? join(args.outputDir, 'quartermaster-cycle-state.json'))
}

function readCycleState(stateFile: string): CycleState | null {
  if (!existsSync(stateFile)) return null
  try {
    const parsed = JSON.parse(readFileSync(stateFile, 'utf8')) as Partial<Omit<CycleState, 'version'>> & { version?: number }
    if ((parsed.version !== 1 && parsed.version !== 2) || typeof parsed.last_successful_run_at !== 'string') return null
    return {
      version: 2,
      last_successful_run_at: parsed.last_successful_run_at,
      last_run_id: typeof parsed.last_run_id === 'string' ? parsed.last_run_id : 'unknown',
      last_rows_read: typeof parsed.last_rows_read === 'number' ? parsed.last_rows_read : 0,
      last_events_read: typeof parsed.last_events_read === 'number' ? parsed.last_events_read : 0,
      last_findings: typeof parsed.last_findings === 'number' ? parsed.last_findings : 0,
      last_learning_themes: typeof parsed.last_learning_themes === 'number' ? parsed.last_learning_themes : 0,
      last_work_packets: typeof parsed.last_work_packets === 'number' ? parsed.last_work_packets : 0,
      last_theme_keys: Array.isArray(parsed.last_theme_keys) ? parsed.last_theme_keys.filter((value): value is string => typeof value === 'string') : [],
      last_packet_keys: Array.isArray(parsed.last_packet_keys) ? parsed.last_packet_keys.filter((value): value is string => typeof value === 'string') : [],
      last_finding_keys: Array.isArray(parsed.last_finding_keys) ? parsed.last_finding_keys.filter((value): value is string => typeof value === 'string') : [],
      updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : parsed.last_successful_run_at,
    }
  } catch {
    return null
  }
}

function writeCycleState(stateFile: string, state: CycleState) {
  mkdirSync(dirname(stateFile), { recursive: true })
  writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`)
}

function resolveSinceForRun(args: Args, state: CycleState | null): { sinceIso: string | null; source: string } {
  if (args.since) return { sinceIso: sinceToIso(args.since), source: 'arg' }
  if (args.cycle && state?.last_successful_run_at) {
    return { sinceIso: state.last_successful_run_at, source: 'cycle_state' }
  }
  return { sinceIso: null, source: args.cycle ? 'cycle_no_prior_state' : 'all_history' }
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
      supabase.from('saved_meals').select('id,name,foods_json,total_calories,total_protein_g,total_carbs_g,total_fat_g,yield_servings,times_logged,last_logged_at,is_favorite'),
      supabase.from('products').select('id,name,brand,calories_per_serving,protein_g_per_serving,carbs_g_per_serving,fat_g_per_serving,unit,serving_size_g'),
    ])
  if (savedMealsError) throw new Error(`saved_meals query failed: ${savedMealsError.message}`)
  if (productsError) throw new Error(`products query failed: ${productsError.message}`)

  return {
    savedMealIds: new Set((savedMeals ?? []).map((row: { id: string }) => row.id)),
    productIds: new Set((products ?? []).map((row: { id: string }) => row.id)),
    savedMeals: (savedMeals ?? []) as SavedMealRefRow[],
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

function foodIdentitySignature(food: FoodLike): string {
  return [
    normalizeFoodText(food.name ?? ''),
    normalizeFoodText(food.unit ?? ''),
    numeric(food.qty) ?? '?',
    numeric(food.calories) ?? '?',
  ].join('|')
}

function singleFoodSavedMealSourceRef(row: SavedMealRefRow): string | null {
  const foods = row.foods_json
  if (!Array.isArray(foods) || foods.length !== 1) return null
  return foods[0]?.source_ref ?? null
}

function buildSavedMealSourceRefIndex(savedMeals: SavedMealRefRow[]): Map<string, SavedMealRefRow[]> {
  const index = new Map<string, SavedMealRefRow[]>()
  for (const row of savedMeals) {
    const ref = singleFoodSavedMealSourceRef(row)
    if (!ref) continue
    const list = index.get(ref) ?? []
    list.push(row)
    index.set(ref, list)
  }
  return index
}

function savedMealWrapperSummary(row: SavedMealRefRow): Record<string, unknown> {
  const food = Array.isArray(row.foods_json) ? row.foods_json[0] : undefined
  return {
    saved_meal_id: row.id,
    name: row.name,
    is_favorite: row.is_favorite === true,
    times_logged: row.times_logged,
    last_logged_at: row.last_logged_at,
    food: displayFood(food),
    source_ref: food?.source_ref ?? null,
  }
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

function findingScore(type: FindingType, severity: Severity, lane: ActionLane): number {
  let score = severityRank(severity) * 20
  if (type === 'save_failed_event') score += 35
  if (type === 'barcode_scan_failed_event' || type === 'barcode_scan_edited') score += 18
  if (type === 'source_ref_stale' || type === 'user_measurement_not_preserved' || type === 'identity_fracture') score += 25
  if (type === 'duplicate_food_row') score += 30
  if (type === 'parse_failed_event' || type === 'parse_abandoned_event') score += 20
  if (type === 'llm_estimated_saved' || type === 'parse_saved_delta_calories') score += 15
  if (type === 'parse_slow' || type === 'llm_fallback_expensive') score += 10
  if (lane === 'backend_bug' || lane === 'saved_meal_repair') score += 10
  if (lane === 'ignore_or_joke') score -= 20
  return Math.max(1, Math.min(100, score))
}

function pushFinding(
  findings: Finding[],
  row: FoodLogRow,
  partial: Omit<Finding, 'id' | 'food_log_entry_id' | 'logged_at' | 'raw_input_text' | 'score'>,
) {
  findings.push({
    id: randomUUID(),
    food_log_entry_id: row.id,
    logged_at: row.logged_at,
    raw_input_text: row.raw_input_text,
    score: findingScore(partial.type, partial.severity, partial.action_lane),
    ...partial,
  })
}

function inspectDuplicateFoodRows(row: FoodLogRow, findings: Finding[]) {
  const foods = row.foods_json ?? []
  if (foods.length < 2) return

  const groups = new Map<string, FoodLike[]>()
  for (const food of foods) {
    const name = normalizeFoodText(food.name ?? '')
    if (!name) continue
    const unit = normalizeFoodText(food.unit ?? '')
    const calories = numeric(food.calories)
    const protein = numeric(food.protein_g)
    const carbs = numeric(food.carbs_g)
    const fat = numeric(food.fat_g)
    const macroKey = [calories, protein, carbs, fat]
      .map((value) => (value === null ? '?' : Math.round(value * 100) / 100))
      .join('/')
    const key = `${name}|${unit}|${macroKey}`
    const list = groups.get(key) ?? []
    list.push(food)
    groups.set(key, list)
  }

  for (const duplicates of groups.values()) {
    if (duplicates.length < 2) continue
    const name = duplicates[0]?.name ?? '(unnamed food)'
    const raw = normalizeFoodText(row.raw_input_text ?? '')
    const normalizedName = normalizeFoodText(name)
    const transcriptSaysOne =
      raw.includes(`one ${normalizedName}`) ||
      raw.includes(`1 ${normalizedName}`) ||
      (normalizedName.includes('protein shake') && /\b(one|1)\s+protein shake\b/.test(raw))

    pushFinding(findings, row, {
      type: 'duplicate_food_row',
      severity: transcriptSaysOne ? 'high' : 'medium',
      action_lane: 'parser_bug',
      summary: `Saved plate contains ${duplicates.length} duplicate rows for "${name}".`,
      evidence: {
        duplicate_count: duplicates.length,
        transcript_says_one: transcriptSaysOne,
        foods: duplicates.map(displayFood),
      },
    })
  }
}

function compareFoods(row: FoodLogRow, findings: Finding[]) {
  const parsedFoods = row.claude_parse_json?.foods ?? []
  const savedFoods = row.foods_json ?? []
  inspectDuplicateFoodRows(row, findings)
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
    const likelyUserQuantityCorrection = isLikelyUserQuantityCorrection(row, parsed, saved)
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
        severity: likelyUserQuantityCorrection ? 'low' : 'medium',
        action_lane: likelyUserQuantityCorrection ? 'manual_review' : 'product_unit_add',
        summary: likelyUserQuantityCorrection
          ? `Food ${index + 1} quantity changed from ${parsedQty} to ${savedQty}; macros scaled cleanly, so this is likely a user quantity correction.`
          : `Food ${index + 1} quantity changed from ${parsedQty} to ${savedQty}.`,
        evidence: {
          index,
          parsed: displayFood(parsed),
          saved: displayFood(saved),
          likely_user_quantity_correction: likelyUserQuantityCorrection,
        },
      })
    }

    const parsedCalories = numeric(parsed.calories)
    const savedCalories = numeric(saved.calories)
    if (parsedCalories !== null && savedCalories !== null) {
      const delta = Math.abs(parsedCalories - savedCalories)
      const threshold = Math.max(25, parsedCalories * 0.15)
      if (delta >= threshold && !likelyUserQuantityCorrection) {
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

function hasExplicitQuantity(text: string | null): boolean {
  const normalized = normalizeFoodText(text ?? '')
  return /\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|half|double|triple)\b/.test(normalized)
}

function scaledClose(parsedValue: number | null, savedValue: number | null, ratio: number, tolerance: number): boolean {
  if (parsedValue === null || savedValue === null) return true
  return Math.abs(savedValue - parsedValue * ratio) <= tolerance
}

function isLikelyUserQuantityCorrection(row: FoodLogRow, parsed: FoodLike, saved: FoodLike): boolean {
  if (hasExplicitQuantity(row.raw_input_text)) return false
  const parsedQty = numeric(parsed.qty)
  const savedQty = numeric(saved.qty)
  if (parsedQty === null || savedQty === null || parsedQty <= 0 || savedQty <= 0) return false
  const ratio = savedQty / parsedQty
  if (!Number.isFinite(ratio) || ratio <= 0 || Math.abs(ratio - 1) < 0.01) return false
  if (Math.abs(ratio - Math.round(ratio * 2) / 2) > 0.01) return false
  if (normalizeFoodText(parsed.name ?? '') !== normalizeFoodText(saved.name ?? '')) return false
  if ((parsed.unit ?? '') !== (saved.unit ?? '')) return false
  if ((parsed.source_ref ?? null) !== (saved.source_ref ?? null)) return false
  return (
    scaledClose(numeric(parsed.calories), numeric(saved.calories), ratio, 5) &&
    scaledClose(numeric(parsed.protein_g), numeric(saved.protein_g), ratio, 0.5) &&
    scaledClose(numeric(parsed.carbs_g), numeric(saved.carbs_g), ratio, 0.5) &&
    scaledClose(numeric(parsed.fat_g), numeric(saved.fat_g), ratio, 0.5)
  )
}

function inspectFoodSources(
  row: FoodLogRow,
  findings: Finding[],
  savedMealIds: Set<string>,
  productIds: Set<string>,
  savedMealsBySourceRef: Map<string, SavedMealRefRow[]>,
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

    if (ref) {
      const wrappers = savedMealsBySourceRef.get(ref) ?? []
      const favoriteWrappers = wrappers.filter((wrapper) => wrapper.is_favorite === true)
      const wrapperSignatures = new Set(
        wrappers
          .map((wrapper) => (Array.isArray(wrapper.foods_json) ? wrapper.foods_json[0] : null))
          .filter((wrapperFood): wrapperFood is FoodLike => Boolean(wrapperFood))
          .map(foodIdentitySignature),
      )
      const loggedSignature = foodIdentitySignature(food)
      const hasDifferentFavoriteWrapper = favoriteWrappers.some((wrapper) => {
        const wrapperFood = Array.isArray(wrapper.foods_json) ? wrapper.foods_json[0] : null
        return wrapperFood ? foodIdentitySignature(wrapperFood) !== loggedSignature : false
      })

      if (wrappers.length > 1 || wrapperSignatures.size > 1 || hasDifferentFavoriteWrapper) {
        pushFinding(findings, row, {
          type: 'identity_fracture',
          severity: favoriteWrappers.length > 0 || wrappers.length > 1 ? 'medium' : 'low',
          action_lane: 'saved_meal_repair',
          summary: `Canonical identity has ${wrappers.length} saved-meal wrapper${wrappers.length === 1 ? '' : 's'} that may drift across quantity or display name for "${food.name ?? '(unnamed food)'}".`,
          evidence: {
            source_ref: ref,
            logged_food: displayFood(food),
            wrapper_count: wrappers.length,
            favorite_wrapper_count: favoriteWrappers.length,
            distinct_wrapper_shapes: wrapperSignatures.size,
            wrappers: wrappers.slice(0, 5).map(savedMealWrapperSummary),
          },
        })
      }
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

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function foodsFromEventPayload(payload: Record<string, unknown> | null): FoodLike[] {
  const plateItems = payload?.plateItems
  if (Array.isArray(plateItems)) return plateItems as FoodLike[]
  const foods = payload?.foods
  if (Array.isArray(foods)) return foods as FoodLike[]
  const parsed = recordFromUnknown(payload?.parsed)
  if (Array.isArray(parsed?.foods)) return parsed.foods as FoodLike[]
  return []
}

function telemetryFromEventPayload(payload: Record<string, unknown> | null): TelemetrySnapshot | undefined {
  const telemetry = recordFromUnknown(payload?.telemetry)
  return telemetry ? (telemetry as TelemetrySnapshot) : undefined
}

function failureText(event: FoodLogEventRow): string {
  const payload = event.payload ?? {}
  return [payload.error, payload.message, payload.errorMessage, payload.saveError, payload.httpStatus]
    .filter((value) => value !== null && value !== undefined)
    .map(String)
    .join(' ')
}

function savedLogEntryIdFromEvent(event: FoodLogEventRow): string | null {
  if (event.food_log_entry_id) return event.food_log_entry_id
  const response = recordFromUnknown(event.payload?.response)
  const bodyResponse = recordFromUnknown(recordFromUnknown(event.payload?.body)?.response)
  const responseId = response?.food_log_entry_id ?? bodyResponse?.food_log_entry_id
  return typeof responseId === 'string' && responseId.length > 0 ? responseId : null
}

function saveFailureLane(event: FoodLogEventRow): ActionLane {
  const text = failureText(event).toLowerCase()
  if (/\bforeign key\b|constraint|invalid input syntax|type integer|food_log_entries|database|postgres|supabase/.test(text)) {
    return 'backend_bug'
  }
  return 'native_ui_or_telemetry'
}

function eventPseudoRow(event: FoodLogEventRow, foods: FoodLike[] = [], telemetry?: TelemetrySnapshot): FoodLogRow {
  return {
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
    claude_parse_json: foods.length > 0 || telemetry ? { foods, _telemetry: telemetry } : null,
    saved_meal_id: null,
    created_at: event.created_at,
  }
}

function inspectEvents(
  events: FoodLogEventRow[],
  findings: Finding[],
  savedMealIds: Set<string>,
  productIds: Set<string>,
  savedMealsBySourceRef: Map<string, SavedMealRefRow[]>,
  visibleFoodLogIds: Set<string>,
) {
  for (const event of events) {
    const foods = foodsFromEventPayload(event.payload)
    const telemetry = telemetryFromEventPayload(event.payload)
    const row = eventPseudoRow(event, foods, telemetry)

    if (event.event_type === 'parse_returned') {
      inspectTelemetry(row, findings)
      inspectTranscript(row, findings)
      inspectFoodSources(row, findings, savedMealIds, productIds, savedMealsBySourceRef)
      continue
    }

    if (event.event_type === 'save_succeeded') {
      const savedLogId = savedLogEntryIdFromEvent(event)
      if (savedLogId && !visibleFoodLogIds.has(savedLogId)) {
        pushFinding(findings, row, {
          type: 'orphan_save_event',
          severity: 'low',
          action_lane: 'native_ui_or_telemetry',
          summary: 'Native reported a successful save, but the saved food log row is no longer visible.',
          evidence: {
            event_id: event.id,
            session_id: event.session_id,
            saved_food_log_entry_id: savedLogId,
            likely_meaning: 'The row was deleted or this was a QA/test save. Keep the event as evidence, but do not count it as a current accepted food log.',
          },
        })
      }
    } else if (event.event_type === 'save_failed') {
      const lane = saveFailureLane(event)
      pushFinding(findings, row, {
        type: 'save_failed_event',
        severity: 'high',
        action_lane: lane,
        summary: 'Native reported a failed save.',
        evidence: { event, failure_text: failureText(event) },
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
    } else if (event.event_type === 'barcode_scan_failed') {
      const payload = event.payload ?? {}
      const source = typeof payload.source === 'string' ? payload.source : 'unknown'
      const error = typeof payload.error === 'string' ? payload.error : null
      const notFound = source === 'not_found'
      pushFinding(findings, row, {
        type: 'barcode_scan_failed_event',
        severity: notFound ? 'medium' : 'high',
        action_lane: notFound ? 'pantry_product_add' : 'native_ui_or_telemetry',
        summary: notFound
          ? 'Native reported a barcode lookup miss.'
          : 'Native reported a barcode scan failure or fallback.',
        evidence: {
          event_id: event.id,
          session_id: event.session_id,
          barcode: payload.barcode ?? null,
          source,
          error,
          lookup_ms: payload.lookup_ms ?? null,
          candidate_count: payload.candidate_count ?? null,
          likely_meaning: notFound
            ? 'This may be a real product Pantheon should learn through a reviewed product promotion path.'
            : 'The scanner or lookup path had friction before a barcode-backed plate could be saved.',
        },
      })
    } else if (event.event_type === 'barcode_product_edited') {
      const payload = event.payload ?? {}
      pushFinding(findings, row, {
        type: 'barcode_scan_edited',
        severity: 'medium',
        action_lane: 'product_unit_add',
        summary: 'Native reported that Luke edited a barcode-backed product before save.',
        evidence: {
          event_id: event.id,
          session_id: event.session_id,
          barcode: payload.barcode ?? null,
          source: payload.source ?? null,
          source_ref: payload.source_ref ?? null,
          selected_name: payload.selected_name ?? null,
          displayed_qty: payload.displayed_qty ?? null,
          displayed_unit: payload.displayed_unit ?? null,
          final_qty: payload.final_qty ?? null,
          final_unit: payload.final_unit ?? null,
          beforeFood: payload.beforeFood ?? null,
          afterFood: payload.afterFood ?? null,
          likely_meaning: 'A scan succeeded, but the displayed product, unit, or quantity needed human correction.',
        },
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
    .sort((a, b) => b.score - a.score || severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 40)
  const topOutcomes = [...report.interaction_outcomes].slice(0, 25)
  const topThemes = [...report.learning_themes].slice(0, 12)
  const topPackets = [...report.work_packets].slice(0, 20)

  const lines: string[] = []
  lines.push(`# Quartermaster Audit ${report.run_id}`)
  lines.push('')
  lines.push(`Generated: ${report.generated_at}`)
  lines.push('')
  lines.push('## Cycle')
  lines.push('')
  lines.push(`- enabled: ${report.cycle.enabled ? 'yes' : 'no'}`)
  lines.push(`- effective_since: ${report.cycle.effective_since ?? '(all history)'}`)
  lines.push(`- since_source: ${report.cycle.since_source}`)
  lines.push(`- previous_run_at: ${report.cycle.previous_run_at ?? '(none)'}`)
  lines.push(`- state_file: ${report.cycle.state_file ?? '(none)'}`)
  lines.push(`- state_written: ${report.cycle.state_written ? 'yes' : 'no'}`)
  lines.push('')
  lines.push('## Cycle Memory')
  lines.push('')
  lines.push(`- available: ${report.cycle_memory.available ? 'yes' : 'no'}`)
  lines.push(`- previous_run_at: ${report.cycle_memory.previous_run_at ?? '(none)'}`)
  lines.push(`- previous_run_id: ${report.cycle_memory.previous_run_id ?? '(none)'}`)
  lines.push(`- plain_english: ${report.cycle_memory.plain_english}`)
  lines.push(`- finding_new_count: ${report.cycle_memory.finding_new_count}`)
  lines.push(`- finding_repeated_count: ${report.cycle_memory.finding_repeated_count}`)
  lines.push(`- finding_resolved_count: ${report.cycle_memory.finding_resolved_count}`)
  lines.push('- new_themes:')
  for (const theme of report.cycle_memory.theme_new.slice(0, 10)) lines.push(`  - ${theme}`)
  if (report.cycle_memory.theme_new.length === 0) lines.push('  - (none)')
  lines.push('- repeated_themes:')
  for (const theme of report.cycle_memory.theme_repeated.slice(0, 10)) lines.push(`  - ${theme}`)
  if (report.cycle_memory.theme_repeated.length === 0) lines.push('  - (none)')
  lines.push('- resolved_themes:')
  for (const theme of report.cycle_memory.theme_resolved.slice(0, 10)) lines.push(`  - ${theme}`)
  if (report.cycle_memory.theme_resolved.length === 0) lines.push('  - (none)')
  lines.push('- new_packets:')
  for (const packet of report.cycle_memory.packet_new.slice(0, 10)) lines.push(`  - ${packet}`)
  if (report.cycle_memory.packet_new.length === 0) lines.push('  - (none)')
  lines.push('- repeated_packets:')
  for (const packet of report.cycle_memory.packet_repeated.slice(0, 10)) lines.push(`  - ${packet}`)
  if (report.cycle_memory.packet_repeated.length === 0) lines.push('  - (none)')
  lines.push('- resolved_packets:')
  for (const packet of report.cycle_memory.packet_resolved.slice(0, 10)) lines.push(`  - ${packet}`)
  if (report.cycle_memory.packet_resolved.length === 0) lines.push('  - (none)')
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  for (const [key, value] of Object.entries(report.summary)) lines.push(`- ${key}: ${value}`)
  lines.push('')
  lines.push('## Scoreboard')
  lines.push('')
  for (const [key, value] of Object.entries(report.scoreboard)) lines.push(`- ${key}: ${value}`)
  lines.push('')
  lines.push('## Readiness')
  lines.push('')
  lines.push(`- status: ${report.readiness.status}`)
  lines.push(`- grade: ${report.readiness.grade}`)
  lines.push(`- plain_english: ${report.readiness.plain_english}`)
  lines.push(`- next_best_step: ${report.readiness.next_best_step}`)
  lines.push('- stop_conditions_met:')
  for (const item of report.readiness.stop_conditions_met) lines.push(`  - ${item}`)
  if (report.readiness.stop_conditions_met.length === 0) lines.push('  - (none)')
  lines.push('- remaining_risks:')
  for (const item of report.readiness.remaining_risks) lines.push(`  - ${item}`)
  if (report.readiness.remaining_risks.length === 0) lines.push('  - (none)')
  lines.push('')
  lines.push('## Parser Paths')
  lines.push('')
  for (const [key, value] of sortedEntries(report.path_counts)) lines.push(`- ${key}: ${value}`)
  lines.push('')
  lines.push('## Outcomes')
  lines.push('')
  for (const [key, value] of sortedEntries(report.outcome_counts)) lines.push(`- ${key}: ${value}`)
  lines.push('')
  lines.push('## Finding Counts')
  lines.push('')
  for (const [key, value] of sortedEntries(report.finding_counts)) lines.push(`- ${key}: ${value}`)
  lines.push('')
  lines.push('## Action Lanes')
  lines.push('')
  for (const [key, value] of sortedEntries(report.action_counts)) lines.push(`- ${key}: ${value}`)
  lines.push('')
  const topTheme = topThemes[0]
  if (topTheme) {
    lines.push('## Top Theme Execution Plan')
    lines.push('')
    lines.push(`### ${topTheme.priority} / ${topTheme.score} - ${topTheme.title}`)
    lines.push('')
    lines.push(`- goal: ${topTheme.execution_plan.goal}`)
    lines.push(`- grouping_scope: ${topTheme.execution_plan.grouping_scope}`)
    lines.push(`- execution_mode: ${topTheme.execution_plan.execution_mode}`)
    lines.push(`- owner: ${topTheme.owner}`)
    lines.push(`- urgency: ${topTheme.urgency}`)
    lines.push(`- maturity: ${topTheme.maturity}`)
    lines.push(`- strongest_packets:`)
    for (const title of topTheme.strongest_packet_titles) lines.push(`  - ${title}`)
    lines.push(`- ordered_steps:`)
    for (const step of topTheme.execution_plan.ordered_steps) lines.push(`  - ${step}`)
    lines.push(`- safety_gates:`)
    for (const gate of topTheme.execution_plan.safety_gates) lines.push(`  - ${gate}`)
    lines.push(`- allowed_actions:`)
    for (const action of topTheme.execution_plan.allowed_actions) lines.push(`  - ${action}`)
    lines.push(`- blocked_actions:`)
    for (const action of topTheme.execution_plan.blocked_actions) lines.push(`  - ${action}`)
    lines.push(`- acceptance_criteria:`)
    for (const criterion of topTheme.execution_plan.acceptance_criteria) lines.push(`  - ${criterion}`)
    lines.push(`- regression_tests:`)
    for (const test of topTheme.execution_plan.regression_tests) lines.push(`  - ${test}`)
    lines.push(`- do_not_do:`)
    for (const item of topTheme.execution_plan.do_not_do) lines.push(`  - ${item}`)
    lines.push(`- expected_metrics:`)
    for (const metric of topTheme.execution_plan.expected_metrics) lines.push(`  - ${metric}`)
    lines.push('')
  }
  lines.push('## Learning Themes')
  lines.push('')
  for (const theme of topThemes) {
    lines.push(`### ${theme.priority} / ${theme.score} - ${theme.title}`)
    lines.push('')
    lines.push(`- owner: ${theme.owner}`)
    lines.push(`- lanes: ${theme.action_lanes.join(', ')}`)
    lines.push(`- confidence: ${theme.confidence}`)
    lines.push(`- evidence_count: ${theme.evidence_count}`)
    lines.push(`- finding_types: ${theme.finding_types.join(', ')}`)
    lines.push(`- summary: ${theme.summary}`)
    lines.push(`- luke_summary: ${theme.luke_summary}`)
    lines.push(`- urgency: ${theme.urgency}`)
    lines.push(`- maturity: ${theme.maturity}`)
    lines.push(`- why_this_is_one_theme: ${theme.why_this_is_one_theme}`)
    lines.push(`- subtheme_hints: ${theme.subtheme_hints.join(', ')}`)
    lines.push(`- next_checkpoint: ${theme.next_checkpoint}`)
    lines.push(`- doctrine: ${theme.doctrine}`)
    lines.push(`- durable_fix: ${theme.durable_fix}`)
    lines.push(`- avoid: ${theme.avoid}`)
    lines.push(`- strongest_packets:`)
    for (const title of theme.strongest_packet_titles) lines.push(`  - ${title}`)
    lines.push(`- execution_goal: ${theme.execution_plan.goal}`)
    lines.push(`- grouping_scope: ${theme.execution_plan.grouping_scope}`)
    lines.push(`- execution_mode: ${theme.execution_plan.execution_mode}`)
    lines.push(`- safety_gates:`)
    for (const gate of theme.execution_plan.safety_gates.slice(0, 5)) lines.push(`  - ${gate}`)
    lines.push(`- execution_next_steps:`)
    for (const step of theme.execution_plan.ordered_steps.slice(0, 5)) lines.push(`  - ${step}`)
    for (const transcript of theme.example_transcripts) lines.push(`- example: ${transcript}`)
    lines.push('')
  }
  if (topThemes.length === 0) lines.push('No learning themes.')
  lines.push('')
  lines.push('## Work Packets')
  lines.push('')
  for (const packet of topPackets) {
    lines.push(`### ${packet.priority} / ${packet.score} - ${packet.title}`)
    lines.push('')
    lines.push(`- owner: ${packet.owner}`)
    lines.push(`- lane: ${packet.action_lane}`)
    lines.push(`- confidence: ${packet.confidence}`)
    lines.push(`- evidence_count: ${packet.evidence_count}`)
    lines.push(`- finding_types: ${packet.finding_types.join(', ')}`)
    lines.push(`- recommended_action: ${packet.recommended_action}`)
    lines.push(`- why_it_matters: ${packet.why_it_matters}`)
    lines.push(`- root_cause_hypothesis: ${packet.root_cause_hypothesis}`)
    lines.push(`- likely_surfaces: ${packet.likely_surfaces.join(', ')}`)
    lines.push(`- acceptance_criteria:`)
    for (const criterion of packet.acceptance_criteria) lines.push(`  - ${criterion}`)
    lines.push(`- regression_tests:`)
    for (const test of packet.regression_tests) lines.push(`  - ${test}`)
    lines.push(`- do_not_do: ${packet.do_not_do}`)
    lines.push(`- expected_metric: ${packet.expected_metric}`)
    for (const transcript of packet.example_transcripts) lines.push(`- example: ${transcript}`)
    lines.push('')
  }
  if (topPackets.length === 0) lines.push('No work packets.')
  lines.push('')
  lines.push('## Top Outcomes')
  lines.push('')
  for (const outcome of topOutcomes) {
    lines.push(`### ${outcome.grade.toUpperCase()} / ${outcome.score} - ${outcome.outcome}`)
    lines.push('')
    lines.push(`- transcript: ${outcome.raw_input_text ?? '(none)'}`)
    lines.push(`- summary: ${outcome.summary}`)
    lines.push(`- lane: ${outcome.action_lane}`)
    lines.push(`- session: ${outcome.session_id ?? '(none)'}`)
    lines.push(`- log id: ${outcome.food_log_entry_id ?? '(none)'}`)
    lines.push(`- window: ${outcome.started_at} -> ${outcome.ended_at}`)
    lines.push('')
  }
  if (topOutcomes.length === 0) lines.push('No interaction outcomes.')
  lines.push('')
  lines.push('## Top Findings')
  lines.push('')
  for (const finding of topFindings) {
    lines.push(`### ${finding.severity.toUpperCase()} / ${finding.score} - ${finding.type}`)
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

function highestSeverity(findings: Finding[]): Severity {
  if (findings.some((finding) => finding.severity === 'high')) return 'high'
  if (findings.some((finding) => finding.severity === 'medium')) return 'medium'
  return 'low'
}

function gradeForOutcome(outcome: OutcomeType): InteractionOutcome['grade'] {
  if (outcome === 'clean_success') return 'pass'
  if (outcome === 'ambiguous_review') return 'unknown'
  if (outcome === 'save_path_failure' || outcome === 'coverage_failure' || outcome === 'confidently_wrong') return 'fail'
  return 'warn'
}

function outcomeScore(outcome: OutcomeType, relatedFindings: Finding[]): number {
  const maxFinding = relatedFindings.reduce((max, finding) => Math.max(max, finding.score), 0)
  const base: Record<OutcomeType, number> = {
    clean_success: 5,
    slow_success: 35,
    edited_success: 45,
    identity_failure: 70,
    quantity_unit_failure: 75,
    coverage_failure: 65,
    confidently_wrong: 85,
    save_path_failure: 95,
    joke_or_non_log: 10,
    ambiguous_review: 30,
  }
  return Math.max(base[outcome], maxFinding)
}

function laneForOutcome(outcome: OutcomeType, relatedFindings: Finding[]): ActionLane {
  const strongest = [...relatedFindings].sort((a, b) => b.score - a.score)[0]
  if (strongest) return strongest.action_lane
  if (outcome === 'save_path_failure') return 'backend_bug'
  if (outcome === 'quantity_unit_failure') return 'product_unit_add'
  if (outcome === 'identity_failure' || outcome === 'confidently_wrong') return 'alias_add'
  if (outcome === 'joke_or_non_log') return 'ignore_or_joke'
  return 'manual_review'
}

function outcomeFromFindings(row: FoodLogRow, relatedFindings: Finding[]): OutcomeType {
  const materialFindings = relatedFindings.filter(
    (finding) =>
      finding.type !== 'telemetry_gap' &&
      !(finding.type === 'unit_missing_or_weak' && finding.severity === 'low'),
  )
  const types = new Set(materialFindings.map((finding) => finding.type))
  if (probablyNonFood(row.raw_input_text)) return 'joke_or_non_log'
  if (types.has('save_failed_event')) return 'save_path_failure'
  if (types.has('duplicate_food_row')) return 'identity_failure'
  if (
    materialFindings.length > 0 &&
    materialFindings.every(
      (finding) =>
        finding.type === 'parse_saved_quantity_changed' &&
        finding.evidence.likely_user_quantity_correction === true,
    )
  ) {
    return 'ambiguous_review'
  }
  if (types.has('user_measurement_not_preserved') || types.has('parse_saved_unit_changed') || types.has('parse_saved_quantity_changed')) {
    return 'quantity_unit_failure'
  }
  if (types.has('parse_saved_name_changed') || types.has('parse_saved_delta_food_count')) return 'identity_failure'
  if (types.has('source_ref_stale') || types.has('llm_estimated_saved') || types.has('database_estimated_saved') || types.has('low_confidence_saved')) {
    return 'coverage_failure'
  }
  if (types.has('parse_slow') || types.has('llm_fallback_expensive')) return 'slow_success'
  if (types.size > 0) return 'ambiguous_review'
  return 'clean_success'
}

function eventSessionKey(event: FoodLogEventRow): string {
  if (event.session_id) return `session:${event.session_id}`
  if (event.food_log_entry_id) return `log:${event.food_log_entry_id}`
  const raw = normalizeFoodText(event.raw_input_text ?? '').slice(0, 80)
  const minute = event.created_at.slice(0, 16)
  return `raw:${raw}:${minute}`
}

function eventOutcome(events: FoodLogEventRow[], relatedFindings: Finding[]): OutcomeType {
  const types = new Set(events.map((event) => event.event_type))
  const findingTypes = new Set(relatedFindings.map((finding) => finding.type))
  const raw = events.find((event) => event.raw_input_text)?.raw_input_text ?? null
  if (probablyNonFood(raw)) return 'joke_or_non_log'
  if (types.has('save_failed')) return 'save_path_failure'
  if (types.has('parse_failed')) return 'coverage_failure'
  if (types.has('food_item_deleted')) return 'confidently_wrong'
  if (types.has('disambiguation_selected')) return 'identity_failure'
  if (types.has('barcode_log_saved') && types.has('barcode_product_edited')) return 'edited_success'
  if (types.has('barcode_log_saved')) return 'clean_success'
  if (types.has('barcode_scan_failed')) return 'coverage_failure'
  if (types.has('food_item_edited') || types.has('food_item_added')) return 'edited_success'
  if (types.has('parse_abandoned')) return 'ambiguous_review'
  if (findingTypes.has('orphan_save_event')) return 'ambiguous_review'
  if (types.has('save_succeeded')) return 'clean_success'
  if (relatedFindings.some((finding) => finding.type === 'parse_slow' || finding.type === 'llm_fallback_expensive')) return 'slow_success'
  if (types.has('parse_returned')) return 'ambiguous_review'
  return 'ambiguous_review'
}

function buildInteractionOutcomes(
  rows: FoodLogRow[],
  events: FoodLogEventRow[],
  findings: Finding[],
): InteractionOutcome[] {
  const findingsByLogId = new Map<string, Finding[]>()
  for (const finding of findings) {
    const list = findingsByLogId.get(finding.food_log_entry_id) ?? []
    list.push(finding)
    findingsByLogId.set(finding.food_log_entry_id, list)
  }

  const outcomes: InteractionOutcome[] = []
  for (const row of rows) {
    const related = findingsByLogId.get(row.id) ?? []
    const outcome = outcomeFromFindings(row, related)
    outcomes.push({
      id: randomUUID(),
      outcome,
      grade: gradeForOutcome(outcome),
      action_lane: laneForOutcome(outcome, related),
      score: outcomeScore(outcome, related),
      session_id: null,
      food_log_entry_id: row.id,
      raw_input_text: row.raw_input_text,
      started_at: row.created_at,
      ended_at: row.logged_at,
      summary: `Saved log classified as ${outcome.replaceAll('_', ' ')}.`,
      evidence: {
        related_finding_ids: related.map((finding) => finding.id),
        related_finding_types: [...new Set(related.map((finding) => finding.type))],
        foods_count: row.foods_json?.length ?? 0,
        parser_path: telemetryPath(row.claude_parse_json?._telemetry),
      },
    })
  }

  const eventsBySession = new Map<string, FoodLogEventRow[]>()
  for (const event of events) {
    const key = eventSessionKey(event)
    const list = eventsBySession.get(key) ?? []
    list.push(event)
    eventsBySession.set(key, list)
  }
  for (const sessionEvents of eventsBySession.values()) {
    sessionEvents.sort((a, b) => a.created_at.localeCompare(b.created_at))
    const first = sessionEvents[0]
    const last = sessionEvents[sessionEvents.length - 1]
    const related = sessionEvents.flatMap((event) => findingsByLogId.get(event.food_log_entry_id ?? event.id) ?? [])
    const outcome = eventOutcome(sessionEvents, related)
    outcomes.push({
      id: randomUUID(),
      outcome,
      grade: gradeForOutcome(outcome),
      action_lane: laneForOutcome(outcome, related),
      score: outcomeScore(outcome, related),
      session_id: first.session_id,
      food_log_entry_id: first.food_log_entry_id,
      raw_input_text: first.raw_input_text ?? sessionEvents.find((event) => event.raw_input_text)?.raw_input_text ?? null,
      started_at: first.created_at,
      ended_at: last.created_at,
      summary: `Event session classified as ${outcome.replaceAll('_', ' ')}.`,
      evidence: {
        event_types: sessionEvents.map((event) => event.event_type),
        event_count: sessionEvents.length,
        related_finding_ids: related.map((finding) => finding.id),
      },
    })
  }

  return outcomes.sort((a, b) => b.score - a.score || b.ended_at.localeCompare(a.ended_at))
}

function packetPriority(score: number): Priority {
  if (score >= 90) return 'P0'
  if (score >= 70) return 'P1'
  if (score >= 45) return 'P2'
  return 'P3'
}

function ownerForLane(lane: ActionLane): string {
  switch (lane) {
    case 'alias_add':
    case 'rejection_add':
      return 'Matcher / Pantry Forge'
    case 'pantry_product_add':
    case 'product_unit_add':
      return 'Pantry Forge'
    case 'saved_meal_repair':
      return 'Library Identity'
    case 'parser_bug':
      return 'Parser'
    case 'backend_bug':
      return 'Backend'
    case 'native_ui_or_telemetry':
      return 'Native UX / Telemetry'
    case 'ignore_or_joke':
      return 'Intent Classifier'
    case 'manual_review':
      return 'Human Review'
  }
}

function packetTitle(lane: ActionLane, type: FindingType, transcript: string | null): string {
  const phrase = transcript ? `: "${transcript.slice(0, 80)}${transcript.length > 80 ? '...' : ''}"` : ''
  switch (type) {
    case 'save_failed_event':
      return `Fix save failure${phrase}`
    case 'user_measurement_not_preserved':
      return `Preserve user quantity/unit${phrase}`
    case 'source_ref_stale':
      return `Repair stale library identity${phrase}`
    case 'identity_fracture':
      return `Repair fractured favorite identity${phrase}`
    case 'duplicate_food_row':
      return `Stop duplicate food rows${phrase}`
    case 'parse_slow':
    case 'llm_fallback_expensive':
      return `Move slow parse onto a fast path${phrase}`
    case 'parse_saved_name_changed':
      return `Investigate identity correction${phrase}`
    case 'parse_saved_unit_changed':
    case 'parse_saved_quantity_changed':
      return `Investigate unit or portion correction${phrase}`
    case 'joke_or_non_food':
      return `Classify non-log intent${phrase}`
    case 'barcode_scan_failed_event':
      return `Review barcode scan failure${phrase}`
    case 'barcode_scan_edited':
      return `Review barcode product edit${phrase}`
    case 'orphan_save_event':
      return `Review deleted or QA save event${phrase}`
    default:
      return `${ownerForLane(lane)} packet for ${type.replaceAll('_', ' ')}${phrase}`
  }
}

function recommendedAction(type: FindingType, lane: ActionLane): string {
  if (type === 'save_failed_event') return 'Reproduce the save, inspect backend error text, and add a regression test before changing user-facing behavior.'
  if (type === 'user_measurement_not_preserved') return 'Preserve the unit Luke said in the displayed plate and ensure unit alternatives support the conversion.'
  if (type === 'duplicate_food_row') return 'Reproduce the parse path and prevent one spoken item from becoming multiple saved plate rows.'
  if (type === 'source_ref_stale') return 'Resolve the stale source_ref to a live identity or strip it before save/search surfaces reuse it.'
  if (type === 'identity_fracture') return 'Collapse favorite and saved-meal behavior around the canonical source_ref so quantities and display names do not create separate food identities.'
  if (type === 'parse_slow' || type === 'llm_fallback_expensive') return 'Add pantry identity, alias, or parser guard so this phrase resolves before the LLM fallback.'
  if (type === 'parse_saved_name_changed') return 'Treat the saved name as a correction signal; consider alias/rejection proposals after confirming intent.'
  if (type === 'parse_saved_unit_changed' || type === 'parse_saved_quantity_changed') return 'Compare parsed versus saved quantity and add missing unit conversion or UI preservation rule.'
  if (type === 'barcode_scan_failed_event') return 'Classify whether the scan missed because of camera/lookup failure or because the product needs reviewed barcode coverage.'
  if (type === 'barcode_scan_edited') return 'Compare the scanned product display to the saved correction and improve product facts, units, or barcode identity.'
  if (lane === 'pantry_product_add') return 'Create a reviewed product candidate with source, macros, aliases, and unit alternatives.'
  if (lane === 'alias_add') return 'Create a narrow alias proposal only if the target identity is unambiguous.'
  if (lane === 'rejection_add') return 'Create a negative match rule so this phrase stops resolving to the wrong identity.'
  return 'Review the evidence and route the smallest safe fix to the owning lane.'
}

function whyItMatters(type: FindingType): string {
  if (type === 'save_failed_event') return 'Save failures break trust completely: the user did the work and still loses the log.'
  if (type === 'user_measurement_not_preserved') return 'The displayed unit is how Luke confirms Pantheon heard him correctly.'
  if (type === 'duplicate_food_row') return 'Duplicate rows silently inflate calories and macros even when the visible parse looks plausible.'
  if (type === 'parse_slow' || type === 'llm_fallback_expensive') return 'Slow parses are usually missing pantry or matcher knowledge.'
  if (type === 'source_ref_stale') return 'Stale identities can resurrect deleted meals or trip database constraints.'
  if (type === 'identity_fracture') return 'Favorite state and learning memory should attach to the food identity, not to one logged quantity or saved-meal wrapper.'
  if (type === 'barcode_scan_failed_event') return 'Barcode scanning should save time; misses and fallbacks show where product coverage or scanner reliability is still weak.'
  if (type === 'barcode_scan_edited') return 'A corrected scan is high-quality feedback about product units, quantities, or identity.'
  if (type === 'parse_abandoned_event') return 'Abandonment is often the clearest sign that the result was not worth saving.'
  return 'This is real user-behavior evidence, not theoretical parser hygiene.'
}

function rootCauseHypothesis(type: FindingType, lane: ActionLane): string {
  if (type === 'duplicate_food_row') return 'A parse segment or candidate merge path is allowing one intended item to survive as multiple saved plate rows.'
  if (type === 'user_measurement_not_preserved') return 'The parse may know the spoken quantity, but display/save normalization is replacing it with a generic unit surface.'
  if (type === 'source_ref_stale') return 'Historical library evidence is being reused as a live parent identity without verifying the referenced saved meal still exists.'
  if (type === 'identity_fracture') return 'The same canonical food is represented by saved/favorite wrappers whose names, units, or quantities differ enough to make the app treat one food as several identities.'
  if (type === 'parse_slow' || type === 'llm_fallback_expensive') return 'The fast pantry/library path lacks enough identity, alias, unit, or segmentation knowledge for this phrase.'
  if (type === 'parse_saved_delta_calories') return 'Parsed and saved nutrition diverged; this may be a user correction, a bad match, or a unit conversion issue.'
  if (type === 'parse_saved_delta_food_count') return 'The parse and saved plate disagree about how many foods belong on the plate.'
  if (type === 'parse_saved_name_changed') return 'The selected/saved identity differs from the parsed identity, which may indicate correction or alias mismatch.'
  if (type === 'parse_saved_unit_changed' || type === 'parse_saved_quantity_changed') return 'The portion representation changed between parse and save, likely through unit normalization or edit flow.'
  if (type === 'save_failed_event') return 'The native save payload or backend insert path rejected a value that should degrade gracefully.'
  if (type === 'barcode_scan_failed_event') return 'The barcode lookup did not produce a confident product-backed plate, or camera permissions blocked the scan.'
  if (type === 'barcode_scan_edited') return 'The barcode lookup found a product, but the selected quantity, unit, or identity still needed user correction.'
  if (type === 'parse_failed_event') return 'The parser failed before producing a usable plate.'
  if (type === 'parse_abandoned_event') return 'The user left the flow before save; the result may have been confusing, wrong, too slow, or interrupted.'
  if (type === 'edit_event') return 'The user took a corrective action that Quartermaster should preserve as intent evidence.'
  if (type === 'unit_missing_or_weak') return 'The product exists but lacks natural logging units or unit alternatives.'
  if (type === 'llm_estimated_saved' || type === 'database_estimated_saved') return 'An estimated item reached the saved plate where a reviewed pantry/product identity would be stronger.'
  if (type === 'low_confidence_saved') return 'A low-confidence match was accepted or saved without enough certainty.'
  if (type === 'source_ref_chained') return 'A derived/history source ref is being emitted as though it were a durable canonical identity.'
  if (type === 'joke_or_non_food') return 'The utterance likely was not intended as a nutrition log.'
  if (lane === 'pantry_product_add') return 'The pantry lacks a reviewed product or ingredient identity for this real user phrase.'
  return 'The evidence points to a real user-facing mismatch, but the root cause still needs review.'
}

function likelySurfaces(type: FindingType, lane: ActionLane): string[] {
  if (type === 'duplicate_food_row') return ['parser segmentation', 'candidate merge/dedupe', 'plate normalization', 'parser regression tests']
  if (type === 'user_measurement_not_preserved') return ['native plate display', 'parser unit output', 'unit alternatives', 'save payload']
  if (type === 'source_ref_stale') return ['library search', 'hourly/recent history', 'saved meal refs', 'backend save guard']
  if (type === 'identity_fracture') return ['favorites lookup', 'saved_meals wrappers', 'canonical source_ref', 'native heart display', 'library ranking']
  if (type === 'source_ref_chained') return ['library search', 'history evidence', 'source_ref emission', 'parser response shaping']
  if (type === 'parse_slow' || type === 'llm_fallback_expensive') return ['pantry aliases', 'library shortcut', 'segmented resolver', 'parser guards']
  if (type === 'parse_saved_delta_calories' || type === 'parse_saved_delta_food_count' || type === 'parse_saved_name_changed') return ['parse output', 'candidate selection', 'native edits', 'saved foods_json']
  if (type === 'parse_saved_unit_changed' || type === 'parse_saved_quantity_changed' || type === 'unit_missing_or_weak') return ['product units', 'unit alternatives', 'native edit flow', 'portion conversion']
  if (type === 'save_failed_event') return ['native save payload', '/api/meals/log', 'food_log_entries insert', 'backend validation']
  if (type === 'parse_failed_event') return ['parse route', 'transcription payload', 'fallback parser', 'error telemetry']
  if (type === 'parse_abandoned_event' || type === 'edit_event') return ['native telemetry', 'edit/delete actions', 'session join', 'Quartermaster event grouping']
  if (type === 'barcode_scan_failed_event') return ['barcode lookup endpoint', 'native scanner telemetry', 'product barcode coverage', 'camera permissions']
  if (type === 'barcode_scan_edited') return ['product units', 'barcode product identity', 'native edit flow', 'Quartermaster scan quality']
  if (lane === 'pantry_product_add') return ['products table', 'pantry aliases', 'unit alternatives', 'Pantry Forge']
  return [ownerForLane(lane)]
}

function acceptanceCriteria(type: FindingType): string[] {
  if (type === 'duplicate_food_row') return ['The original phrase produces one row for the intended single food.', 'Total calories/macros no longer include duplicated rows.', 'A regression test fails if the duplicate returns.']
  if (type === 'user_measurement_not_preserved') return ['The visible plate preserves the spoken unit and quantity.', 'The saved row keeps enough unit metadata for Quartermaster to verify it.', 'The user can visually confirm what they said.']
  if (type === 'source_ref_stale') return ['No live parse/candidate/save payload emits the stale source_ref.', 'Historical evidence can still rank results without acting as a live parent.', 'Saving succeeds even if stale refs appear in old logs.']
  if (type === 'identity_fracture') return ['A product-backed favorite remains hearted across quantity changes.', 'The same source_ref does not accumulate duplicate favorite wrappers for different counts.', 'Library ranking prefers the canonical product/saved-meal identity without quantity-shaped clutter.']
  if (type === 'source_ref_chained') return ['Derived history refs are stripped, downgraded, or mapped before reaching saved plate output.', 'Canonical product/saved meal refs remain intact.', 'Quartermaster no longer reports the chained ref for the replay phrase.']
  if (type === 'parse_slow' || type === 'llm_fallback_expensive') return ['The replay phrase resolves without slow fallback where practical.', 'Parse latency improves on the replay phrase.', 'The chosen identity remains nutritionally correct.']
  if (type === 'parse_saved_delta_calories' || type === 'parse_saved_delta_food_count' || type === 'parse_saved_name_changed') return ['The delta is classified as user correction, parser bug, or acceptable ambiguity.', 'Only confirmed bugs become code/data changes.', 'A replay or review artifact documents the decision.']
  if (type === 'parse_saved_unit_changed' || type === 'parse_saved_quantity_changed') return ['The intended portion survives parse, display, and save.', 'Unit conversion math is checked against the product facts.', 'Quartermaster no longer flags the same replay phrase.']
  if (type === 'save_failed_event') return ['The exact failing payload saves or degrades gracefully.', 'Backend returns a useful warning instead of blocking the log when possible.', 'A regression test covers the failure class.']
  if (type === 'parse_failed_event') return ['The phrase returns a usable plate or a clear non-food/error classification.', 'The parser records enough telemetry to diagnose any future failure.']
  if (type === 'barcode_scan_failed_event') return ['Scanner failures are classified as camera, lookup, missing product, or fallback parse.', 'Real missing products become reviewed product candidates instead of saved-meal clutter.', 'Telemetry failures never block logging.']
  if (type === 'barcode_scan_edited') return ['The same barcode replays with the corrected unit and quantity.', 'The barcode remains tied to one product identity.', 'Quartermaster can tell whether future scans save cleanly without edits.']
  if (type === 'unit_missing_or_weak') return ['The food has natural units Luke uses.', 'Unit alternatives include conversions needed for the phrase.', 'The pantry item remains reviewed and non-estimated where possible.']
  return ['The replay evidence no longer produces this finding.', 'The fix is covered by the smallest relevant regression check.']
}

function regressionTests(type: FindingType, examples: string[]): string[] {
  const replay = examples.slice(0, 3).map((example) => `Replay: ${example}`)
  if (type === 'duplicate_food_row') return [...replay, 'Assert duplicate row count is zero for same name/unit/macros.']
  if (type === 'user_measurement_not_preserved') return [...replay, 'Assert spoken unit appears in displayed/saved food evidence.']
  if (type === 'source_ref_stale' || type === 'source_ref_chained') return [...replay, 'Assert emitted source_ref is live canonical ref or null, not stale/history-derived.']
  if (type === 'identity_fracture') return [...replay, 'Assert same source_ref keeps one favorite identity across quantity/name variations.']
  if (type === 'parse_slow' || type === 'llm_fallback_expensive') return [...replay, 'Assert parser path is deterministic fast path when product coverage exists.']
  if (type === 'save_failed_event') return [...replay, 'Post the original save payload to /api/meals/log and assert success or graceful degradation.']
  if (type === 'barcode_scan_failed_event') return [...replay, 'Replay the barcode lookup and assert the scanner records miss/fallback evidence without blocking logging.']
  if (type === 'barcode_scan_edited') return [...replay, 'Replay the barcode-backed product and assert corrected unit/quantity survives display and save.']
  if (type === 'unit_missing_or_weak') return [...replay, 'Assert unit alternatives contain Luke-spoken unit.']
  return replay.length > 0 ? replay : ['Add a regression around the strongest example transcript.']
}

function doNotDo(type: FindingType, lane: ActionLane): string {
  if (type === 'duplicate_food_row') return 'Do not hide the problem by changing calories or merging totals after the fact.'
  if (type === 'user_measurement_not_preserved') return 'Do not replace a concrete spoken unit with "serving" unless the app explicitly explains the conversion.'
  if (type === 'source_ref_stale') return 'Do not recreate deleted saved meals just to satisfy old historical refs.'
  if (type === 'identity_fracture') return 'Do not create separate saved/favorite foods just because the user logged a different quantity.'
  if (type === 'source_ref_chained') return 'Do not treat hourly/recent-history refs as durable canonical IDs.'
  if (type === 'parse_slow' || type === 'llm_fallback_expensive') return 'Do not accept repeated daily foods staying on the expensive fallback path.'
  if (type === 'parse_saved_delta_calories' || type === 'parse_saved_delta_food_count' || type === 'parse_saved_name_changed') return 'Do not create aliases or product writes until the delta is understood.'
  if (type === 'save_failed_event') return 'Do not make the user lose a log because strict backend metadata failed.'
  if (lane === 'pantry_product_add') return 'Do not add unreviewed branded/composite rows as generic pantry truth.'
  return 'Do not turn one ambiguous symptom into broad doctrine without replay evidence.'
}

function expectedMetric(type: FindingType, lane: ActionLane): string {
  if (type === 'duplicate_food_row') return 'duplicate_food_row count decreases; accepted unchanged rate increases for replay phrases'
  if (type === 'user_measurement_not_preserved') return 'user_measurement_not_preserved count decreases; unit preservation rate increases'
  if (type === 'source_ref_stale') return 'source_ref_stale count decreases; save failures from stale refs remain zero'
  if (type === 'identity_fracture') return 'identity_fracture count decreases; repeated product-backed foods keep stable favorite state'
  if (type === 'source_ref_chained') return 'source_ref_chained count decreases'
  if (type === 'parse_slow' || type === 'llm_fallback_expensive') return 'average parse latency and LLM fallback rate decrease for repeated phrases'
  if (type === 'save_failed_event') return 'save_failed_events decrease; save success rate increases'
  if (type === 'unit_missing_or_weak') return 'unit_missing_or_weak count decreases for repeated foods'
  if (lane === 'pantry_product_add') return 'coverage failures and estimated saved items decrease'
  return 'repeat findings for the same transcript decrease in the next cycle'
}

function packetClusterKey(finding: Finding): string {
  const measurement = recordFromUnknown(finding.evidence.measurement)
  const sourceRef = typeof finding.evidence.source_ref === 'string' ? finding.evidence.source_ref : null
  const failure = typeof finding.evidence.failure_text === 'string' ? normalizeFoodText(finding.evidence.failure_text).slice(0, 80) : null
  const target = typeof measurement?.target === 'string' ? measurement.target : null
  const normalizedRaw = normalizeFoodText(finding.raw_input_text ?? '').slice(0, 80)
  return [
    finding.action_lane,
    finding.type,
    sourceRef ?? failure ?? target ?? normalizedRaw,
  ].join('|')
}

function findingStableKey(finding: Finding): string {
  return [
    finding.action_lane,
    finding.type,
    packetClusterKey(finding),
  ].join('|')
}

function buildWorkPackets(findings: Finding[]): WorkPacket[] {
  const groups = new Map<string, Finding[]>()
  for (const finding of findings) {
    if (finding.type === 'telemetry_gap') continue
    const key = packetClusterKey(finding)
    const list = groups.get(key) ?? []
    list.push(finding)
    groups.set(key, list)
  }

  const packets: WorkPacket[] = []
  for (const [stableKey, group] of groups) {
    const sorted = [...group].sort((a, b) => b.score - a.score)
    const lead = sorted[0]
    const severity = highestSeverity(sorted)
    const score = Math.min(100, lead.score + Math.min(25, (sorted.length - 1) * 5))
    const confidence: Confidence = sorted.length >= 2 || severity === 'high' ? 'high' : lead.action_lane === 'manual_review' ? 'low' : 'medium'
    const exampleTranscripts = [
      ...new Set(sorted.map((finding) => finding.raw_input_text).filter((value): value is string => Boolean(value))),
    ].slice(0, 3)
    packets.push({
      id: randomUUID(),
      stable_key: stableKey,
      priority: packetPriority(score),
      score,
      confidence,
      action_lane: lead.action_lane,
      owner: ownerForLane(lead.action_lane),
      title: packetTitle(lead.action_lane, lead.type, lead.raw_input_text),
      recommended_action: recommendedAction(lead.type, lead.action_lane),
      why_it_matters: whyItMatters(lead.type),
      root_cause_hypothesis: rootCauseHypothesis(lead.type, lead.action_lane),
      likely_surfaces: likelySurfaces(lead.type, lead.action_lane),
      acceptance_criteria: acceptanceCriteria(lead.type),
      regression_tests: regressionTests(lead.type, exampleTranscripts),
      do_not_do: doNotDo(lead.type, lead.action_lane),
      expected_metric: expectedMetric(lead.type, lead.action_lane),
      evidence_count: sorted.length,
      finding_types: [...new Set(sorted.map((finding) => finding.type))],
      example_transcripts: exampleTranscripts,
      finding_ids: sorted.map((finding) => finding.id),
    })
  }

  return packets.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
}

function findingText(finding: Finding): string {
  return normalizeFoodText(
    [
      finding.raw_input_text,
      finding.summary,
      JSON.stringify(finding.evidence),
    ].filter(Boolean).join(' '),
  )
}

function themeKindsForFinding(finding: Finding): ThemeKind[] {
  const raw = normalizeFoodText(finding.raw_input_text ?? '')
  const text = findingText(finding)
  const kinds: ThemeKind[] = []
  if (finding.type === 'orphan_save_event') return ['telemetry_observability']
  if (
    raw.includes('protein shake') ||
    raw.includes('isopure') ||
    raw.includes('dextrose') ||
    (!raw && (text.includes('protein shake') || text.includes('dextrose')))
  ) {
    kinds.push('protein_shake_composition')
  }
  if (
    finding.type === 'user_measurement_not_preserved' ||
    ((finding.type === 'parse_saved_unit_changed' || finding.type === 'parse_saved_quantity_changed') &&
      transcriptMeasurements(finding.raw_input_text).length > 0)
  ) {
    kinds.push('quantity_display_trust')
  }
  if (finding.type === 'source_ref_stale') kinds.push('stale_library_identity')
  if (finding.type === 'identity_fracture') kinds.push('identity_fracture')
  if (finding.type === 'duplicate_food_row') kinds.push('duplicate_food_rows')
  if (finding.type === 'parse_slow' || finding.type === 'llm_fallback_expensive') kinds.push('slow_parse_missing_knowledge')
  if (
    finding.type === 'unit_missing_or_weak' ||
    finding.type === 'llm_estimated_saved' ||
    finding.type === 'database_estimated_saved'
  ) {
    kinds.push('pantry_unit_surface')
  }
  if (finding.type === 'save_failed_event' || finding.type === 'parse_failed_event') kinds.push('save_path_reliability')
  if (finding.type === 'barcode_scan_failed_event') kinds.push('pantry_unit_surface', 'telemetry_observability')
  if (finding.type === 'barcode_scan_edited') kinds.push('pantry_unit_surface', 'human_review_delta')
  if (finding.type === 'telemetry_gap' || finding.type === 'parse_abandoned_event' || finding.type === 'edit_event') {
    kinds.push('telemetry_observability')
  }
  if (finding.type === 'parse_saved_delta_calories' || finding.type === 'parse_saved_delta_food_count' || finding.type === 'parse_saved_name_changed') {
    kinds.push('human_review_delta')
  }
  return kinds.length > 0 ? [...new Set(kinds)] : ['manual_review']
}

function themeOwner(kind: ThemeKind): string {
  switch (kind) {
    case 'protein_shake_composition':
      return 'Parser / Library Identity'
    case 'quantity_display_trust':
      return 'Native UX / Pantry Forge'
    case 'stale_library_identity':
      return 'Library Identity'
    case 'identity_fracture':
      return 'Library Identity / Native UX'
    case 'duplicate_food_rows':
      return 'Parser'
    case 'slow_parse_missing_knowledge':
      return 'Parser / Pantry Forge'
    case 'pantry_unit_surface':
      return 'Pantry Forge'
    case 'human_review_delta':
      return 'Human Review'
    case 'save_path_reliability':
      return 'Backend'
    case 'telemetry_observability':
      return 'Native UX / Telemetry'
    case 'manual_review':
      return 'Human Review'
  }
}

function themeTitle(kind: ThemeKind): string {
  switch (kind) {
    case 'protein_shake_composition':
      return 'Protein Shake Composition Failure'
    case 'quantity_display_trust':
      return 'User Quantity Display Trust Failure'
    case 'stale_library_identity':
      return 'Stale Library Identity Failure'
    case 'identity_fracture':
      return 'Favorite Identity Fracture'
    case 'duplicate_food_rows':
      return 'Duplicate Food Row Failure'
    case 'slow_parse_missing_knowledge':
      return 'Slow Parse / Missing Knowledge Failure'
    case 'pantry_unit_surface':
      return 'Pantry Unit Surface Gap'
    case 'human_review_delta':
      return 'Parse Versus Saved Result Delta'
    case 'save_path_reliability':
      return 'Save Path Reliability Failure'
    case 'telemetry_observability':
      return 'Telemetry / Observability Gap'
    case 'manual_review':
      return 'Manual Review Theme'
  }
}

function themeSummary(kind: ThemeKind): string {
  switch (kind) {
    case 'protein_shake_composition':
      return 'Protein shake evidence is clustering around one modeling problem: shakes are being treated as opaque identities when Luke is speaking ingredient quantities.'
    case 'quantity_display_trust':
      return 'Luke spoke a concrete amount, but the visible plate did not preserve that amount clearly enough for trust.'
    case 'stale_library_identity':
      return 'Historical or deleted library identities are still influencing live candidate or save surfaces.'
    case 'identity_fracture':
      return 'The same real food identity is appearing through quantity-shaped or display-shaped wrappers, so favorites and learning memory can drift.'
    case 'duplicate_food_rows':
      return 'One intended food can appear more than once, silently inflating calories and macros.'
    case 'slow_parse_missing_knowledge':
      return 'The parser is falling onto slower paths where pantry, alias, or matcher knowledge should handle the phrase.'
    case 'pantry_unit_surface':
      return 'Foods exist but do not expose strong enough units, alternatives, or reviewed product facts for Luke-style logging.'
    case 'human_review_delta':
      return 'The parsed result and saved result differ enough that human review should decide whether this was correction, ambiguity, or a bug.'
    case 'save_path_reliability':
      return 'The app failed before or during save, which is a trust-breaking logging failure.'
    case 'telemetry_observability':
      return 'Quartermaster can see friction, but not enough detail yet to grade intent confidently.'
    case 'manual_review':
      return 'Evidence is real but not yet specific enough for an automatic lane.'
  }
}

function themeLukeSummary(kind: ThemeKind): string {
  switch (kind) {
    case 'protein_shake_composition':
      return 'Pantheon is still confused about what a protein shake means. It needs to treat the shake as ingredients, not guess between old shake names.'
    case 'quantity_display_trust':
      return 'When you say a real amount like grams or scoops, the app needs to show that same amount back to you.'
    case 'stale_library_identity':
      return 'Old deleted saved meals are still sneaking into live behavior.'
    case 'identity_fracture':
      return 'The same real food can look like separate foods because quantity, saved-meal wrappers, or display names are splitting the identity.'
    case 'duplicate_food_rows':
      return 'The app can accidentally count one food twice.'
    case 'slow_parse_missing_knowledge':
      return 'Some normal foods you say still require the slow smart path because the fast pantry path does not know them well enough.'
    case 'pantry_unit_surface':
      return 'Some foods exist, but they are not useful enough because their units are too generic.'
    case 'human_review_delta':
      return 'The app changed between parse and save; we need to decide whether that was you correcting it or the system drifting.'
    case 'save_path_reliability':
      return 'Saving must never fail after you already did the work of logging.'
    case 'telemetry_observability':
      return 'Quartermaster needs a clearer trail of what you did in the app before it can judge confidently.'
    case 'manual_review':
      return 'This evidence is real, but Quartermaster should ask for review instead of guessing.'
  }
}

function themeUrgency(kind: ThemeKind, findings: Finding[]): ThemeUrgency {
  const hasHigh = findings.some((finding) => finding.severity === 'high')
  const hasSaveFailure = findings.some((finding) => finding.type === 'save_failed_event' || finding.type === 'parse_failed_event')
  if (hasSaveFailure) return 'fix_now'
  switch (kind) {
    case 'protein_shake_composition':
    case 'quantity_display_trust':
    case 'duplicate_food_rows':
    case 'stale_library_identity':
    case 'identity_fracture':
      return hasHigh ? 'fix_now' : 'fix_next'
    case 'slow_parse_missing_knowledge':
    case 'pantry_unit_surface':
      return findings.length >= 10 ? 'fix_next' : 'watch'
    case 'human_review_delta':
    case 'telemetry_observability':
      return findings.length >= 5 ? 'fix_next' : 'watch'
    case 'save_path_reliability':
      return 'fix_now'
    case 'manual_review':
      return 'watch'
  }
}

function themeMaturity(kind: ThemeKind, findings: Finding[]): ThemeMaturity {
  const distinctTypes = new Set(findings.map((finding) => finding.type)).size
  if (kind === 'pantry_unit_surface' && findings.length > 75) return 'too_broad'
  if (findings.length === 1) return 'single_incident'
  if (findings.length >= 3 || distinctTypes >= 2) return 'strong_pattern'
  return 'emerging_pattern'
}

function whyThisIsOneTheme(kind: ThemeKind, findings: Finding[]): string {
  const types = [...new Set(findings.map((finding) => finding.type))]
  switch (kind) {
    case 'protein_shake_composition':
      return `Multiple symptoms point to the same modeling issue: ${types.join(', ')} all involve shake identity, ingredients, or stale shake history.`
    case 'quantity_display_trust':
      return `The shared user-facing failure is that Luke spoke a concrete measurement but the saved/displayed plate did not preserve that measurement.`
    case 'stale_library_identity':
      return `These findings all involve source refs that point to deleted or unavailable library parents.`
    case 'identity_fracture':
      return `These findings all involve one canonical source_ref being represented through multiple wrapper shapes, which can split favorite state and learning memory.`
    case 'duplicate_food_rows':
      return `The shared failure is duplicated saved rows for one intended food, which changes totals without an obvious crash.`
    case 'slow_parse_missing_knowledge':
      return `These parses all needed slow or fallback work where pantry, alias, or matcher knowledge should eventually make them fast.`
    case 'pantry_unit_surface':
      return `These findings all mean the food may exist, but its reviewed facts or natural unit surfaces are not strong enough yet.`
    case 'human_review_delta':
      return `These findings all compare one system result to another and need intent review before becoming permanent rules.`
    case 'save_path_reliability':
      return `These findings all block the final save path, which is the highest-trust part of logging.`
    case 'telemetry_observability':
      return `These events show user friction, but Quartermaster lacks enough joined context to grade the cause.`
    case 'manual_review':
      return `These findings are grouped because they are ambiguous and should remain review-first.`
  }
}

function themeSubthemeHints(kind: ThemeKind): string[] {
  switch (kind) {
    case 'protein_shake_composition':
      return ['ingredient composition', 'saved shortcut cleanup', 'stale shake history', 'duplicate segment merge']
    case 'quantity_display_trust':
      return ['grams and ounces', 'count units', 'scoops and servings', 'native display labels']
    case 'stale_library_identity':
      return ['saved meal refs', 'history surfaces', 'candidate filtering']
    case 'identity_fracture':
      return ['favorite source_ref matching', 'quantity-shaped saved meals', 'display-name drift', 'canonical product identity']
    case 'duplicate_food_rows':
      return ['segmentation ownership', 'candidate merge', 'saved plate dedupe']
    case 'slow_parse_missing_knowledge':
      return ['missing pantry staples', 'missing aliases', 'missing unit conversions', 'restaurant/composite fallback']
    case 'pantry_unit_surface':
      return ['weak serving units', 'package/count units', 'gram conversions', 'reviewed product facts']
    case 'human_review_delta':
      return ['user correction', 'parser drift', 'macro mismatch', 'food count mismatch']
    case 'save_path_reliability':
      return ['type mismatch', 'stale foreign key', 'backend validation', 'native payload shape']
    case 'telemetry_observability':
      return ['event joins', 'edit intent', 'delete intent', 'save lifecycle']
    case 'manual_review':
      return ['needs Luke meaning', 'needs nutrition review', 'needs source review']
  }
}

function themeNextCheckpoint(kind: ThemeKind, urgency: ThemeUrgency, maturity: ThemeMaturity): string {
  if (maturity === 'too_broad') return 'split this theme into smaller subthemes before using it to drive repairs'
  if (urgency === 'fix_now') {
    switch (kind) {
      case 'protein_shake_composition':
        return 'write one composition repair packet with regression phrases'
      case 'quantity_display_trust':
        return 'verify exactly where spoken units are lost between parse, display, and save'
      case 'duplicate_food_rows':
        return 'reproduce one duplicate-row parse and add a regression guard'
      case 'stale_library_identity':
        return 'identify every live surface still emitting stale saved meal refs'
      case 'identity_fracture':
        return 'collapse the strongest fractured food identity around its canonical source_ref'
      default:
        return 'turn this theme into an execution-ready repair packet'
    }
  }
  if (urgency === 'fix_next') return 'rank the examples and convert the strongest one into a repair packet'
  if (urgency === 'watch') return 'keep collecting evidence until the root cause is clearer'
  return 'do not spend implementation time here yet'
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function themeExecutionGoal(kind: ThemeKind): string {
  switch (kind) {
    case 'protein_shake_composition':
      return 'Make protein shake logging ingredient-based, fast, and free of stale saved-meal identities.'
    case 'quantity_display_trust':
      return 'Preserve Luke-spoken quantities in the visible and saved plate evidence.'
    case 'stale_library_identity':
      return 'Stop deleted or stale saved-meal refs from appearing in live parse, candidate, or save payloads.'
    case 'identity_fracture':
      return 'Keep favorite state and learning memory attached to canonical food identity instead of quantity-shaped wrappers.'
    case 'duplicate_food_rows':
      return 'Prevent one spoken food from becoming multiple saved rows.'
    case 'slow_parse_missing_knowledge':
      return 'Move repeated Luke phrases from slow fallback to deterministic pantry/parser paths.'
    case 'pantry_unit_surface':
      return 'Split broad weak-unit evidence into focused pantry unit repair batches.'
    case 'human_review_delta':
      return 'Classify parse/save deltas before turning them into permanent data or parser changes.'
    case 'save_path_reliability':
      return 'Make save failures degrade gracefully and become regression-tested.'
    case 'telemetry_observability':
      return 'Make event evidence complete enough for Quartermaster to grade user intent.'
    case 'manual_review':
      return 'Keep ambiguous evidence review-first until intent is clear.'
  }
}

function themeOrderedSteps(kind: ThemeKind, packets: WorkPacket[]): string[] {
  const packetSteps = packets.slice(0, 3).map((packet) => `Packet: ${packet.title}: ${packet.recommended_action}`)
  switch (kind) {
    case 'protein_shake_composition':
      return [
        '1. Verify the ingredient facts and canonical homes for Isopure protein and NutriCost dextrose.',
        '2. Remove stale/deleted shake identities from live candidate and source_ref surfaces.',
        '3. Add parser composition behavior so shake phrases resolve to protein powder plus dextrose quantities.',
        '4. Replay no/half/full/double dextrose phrases and the sweet potato mixed plate.',
        ...packetSteps,
      ]
    case 'quantity_display_trust':
      return [
        '1. Trace one failing phrase from transcript to parser food to native display to saved foods_json.',
        '2. Preserve the user-spoken unit when a conversion is known.',
        '3. Add a regression that fails when grams/ounces/counts collapse to serving.',
        ...packetSteps,
      ]
    case 'pantry_unit_surface':
      return [
        '1. Split this broad theme into unit subthemes before implementing.',
        '2. Rank repeated foods by real usage and friction.',
        '3. Add natural units only for the highest-value repeated foods.',
        ...packetSteps,
      ]
    case 'identity_fracture':
      return [
        '1. Pick the highest-use canonical source_ref with multiple saved/favorite shapes.',
        '2. Decide the canonical home: product identity, saved-meal shortcut, or true recipe.',
        '3. Make heart display, heart API lookup, and library ranking prefer the canonical source_ref.',
        '4. Avoid creating saved foods for each quantity; quantity belongs in the measurement layer.',
        ...packetSteps,
      ]
    case 'human_review_delta':
      return [
        '1. Pick the highest-score delta and inspect parsed versus saved artifacts.',
        '2. Decide whether it was user correction, parser drift, or acceptable ambiguity.',
        '3. Route only confirmed bugs into parser/pantry/native repairs.',
        ...packetSteps,
      ]
    default:
      return packetSteps.length > 0 ? packetSteps : [`1. ${themeNextCheckpoint(kind, 'fix_next', 'emerging_pattern')}`]
  }
}

function themeSortScore(theme: LearningTheme): number {
  const urgencyScore: Record<ThemeUrgency, number> = {
    fix_now: 400,
    fix_next: 300,
    watch: 150,
    defer: 0,
  }
  const maturityScore: Record<ThemeMaturity, number> = {
    strong_pattern: 80,
    emerging_pattern: 40,
    single_incident: 10,
    too_broad: -120,
  }
  return urgencyScore[theme.urgency] + maturityScore[theme.maturity] + theme.score
}

function themeGroupingScope(kind: ThemeKind, maturity: ThemeMaturity): string {
  if (maturity === 'too_broad') return 'Group only for diagnosis. Split into smaller subthemes before any repair work.'
  switch (kind) {
    case 'protein_shake_composition':
      return 'Group all shake symptoms together for root-cause planning, then repair ingredient composition and stale identity paths in small tested steps.'
    case 'quantity_display_trust':
      return 'Group grams, ounces, counts, scoops, and servings as one measurement-trust family, but fix one unit surface at a time with replay evidence.'
    case 'stale_library_identity':
      return 'Group stale refs across history, candidates, and save payloads because the shared safety rule is live refs must be verified before reuse.'
    case 'identity_fracture':
      return 'Group same-source identity splits together when they share a canonical source_ref; repair one canonical identity at a time.'
    case 'duplicate_food_rows':
      return 'Group duplicate-row symptoms by parser merge/segmentation cause, then reproduce one phrase before changing parser behavior.'
    case 'slow_parse_missing_knowledge':
      return 'Group repeated slow phrases as a coverage problem, then split by missing food, alias, unit, or parser guard.'
    case 'pantry_unit_surface':
      return 'Group weak units as pantry ergonomics, then split by food family and user-spoken unit before adding conversions.'
    case 'human_review_delta':
      return 'Group as review evidence only; each delta still needs intent classification before repair.'
    case 'save_path_reliability':
      return 'Group save blockers together because every save failure is trust-critical, but patch exact error classes separately.'
    case 'telemetry_observability':
      return 'Group missing evidence as observability work, then add the smallest event field needed to remove ambiguity.'
    case 'manual_review':
      return 'Group only to keep ambiguous evidence visible; do not infer a shared fix yet.'
  }
}

function themeExecutionMode(kind: ThemeKind, urgency: ThemeUrgency, maturity: ThemeMaturity): ThemeExecutionMode {
  if (maturity === 'too_broad') return 'plan_only'
  if (kind === 'manual_review' || kind === 'human_review_delta') return 'human_review_required'
  if (urgency === 'defer' || urgency === 'watch') return 'observe_only'
  return 'narrow_repair'
}

function themeSafetyGates(kind: ThemeKind, maturity: ThemeMaturity): string[] {
  const gates = [
    'Use the theme for root-cause grouping, not as permission for broad mutation.',
    'Start from the strongest packet and replay at least one original Luke phrase before changing behavior.',
    'Add or run the smallest relevant regression check before treating the repair as done.',
    'Prefer reversible code or routing changes before production data cleanup.',
  ]
  if (maturity === 'too_broad') {
    gates.push('Do not implement repairs until the theme is split into narrower subthemes.')
  }
  switch (kind) {
    case 'protein_shake_composition':
      gates.push('Verify ingredient facts for protein powder and dextrose before creating or changing shake identities.')
      gates.push('Keep old shake names out of live candidates before trusting repeat parse behavior.')
      break
    case 'quantity_display_trust':
      gates.push('Confirm the math still uses the correct canonical food while the display preserves Luke-spoken quantity.')
      gates.push('Do not call the fix successful unless the visible row shows the amount Luke said.')
      break
    case 'stale_library_identity':
      gates.push('Check that a saved-meal ref exists for the user before treating it as a live parent.')
      break
    case 'identity_fracture':
      gates.push('Only collapse identities when source_ref or reviewed evidence proves they are the same food.')
      gates.push('Do not merge recipes, composites, or branded products just because their names look similar.')
      break
    case 'duplicate_food_rows':
      gates.push('Prove the duplicate comes from one spoken item, not Luke intentionally logging two portions or two foods.')
      break
    case 'slow_parse_missing_knowledge':
      gates.push('Do not add broad aliases to improve speed unless the target identity is unambiguous.')
      break
    case 'pantry_unit_surface':
      gates.push('Use reviewed product facts or reliable source data before adding new unit conversions.')
      break
    case 'save_path_reliability':
      gates.push('Backend should degrade gracefully for metadata errors but must not silently corrupt nutrition totals.')
      break
    case 'telemetry_observability':
      gates.push('Add telemetry fields without exposing secrets or increasing user-visible friction.')
      break
    case 'human_review_delta':
    case 'manual_review':
      gates.push('Ask for or preserve human context before writing aliases, rejections, or identity repairs.')
      break
  }
  return uniqueStrings(gates)
}

function themeAllowedActions(kind: ThemeKind): string[] {
  const common = [
    'write or update regression tests',
    'improve read-only Quartermaster diagnosis',
    'make narrow code-path hardening changes',
    'produce reviewable repair packets',
  ]
  switch (kind) {
    case 'protein_shake_composition':
      return [...common, 'create ingredient-first parser behavior after facts are verified', 'add narrow shortcut aliases for confirmed common shakes']
    case 'quantity_display_trust':
      return [...common, 'preserve user-spoken quantity in display/save metadata', 'add reviewed unit alternatives for repeated foods']
    case 'stale_library_identity':
      return [...common, 'strip, downgrade, or remap stale refs after live-ref checks']
    case 'identity_fracture':
      return [...common, 'match favorites by canonical source_ref', 'repair one confirmed canonical identity at a time']
    case 'duplicate_food_rows':
      return [...common, 'add parser merge or dedupe guards for replayed phrases']
    case 'slow_parse_missing_knowledge':
      return [...common, 'add reviewed pantry coverage or narrow aliases for repeated phrases']
    case 'pantry_unit_surface':
      return [...common, 'add reviewed natural units for high-use pantry items']
    case 'save_path_reliability':
      return [...common, 'add defensive backend validation and graceful fallback']
    case 'telemetry_observability':
      return [...common, 'add non-sensitive event fields that close evidence gaps']
    case 'human_review_delta':
    case 'manual_review':
      return ['summarize evidence', 'ask for confirmation', 'create review-only packets']
  }
}

function themeBlockedActions(kind: ThemeKind): string[] {
  const common = [
    'destructive cleanup without explicit approval',
    'production data mutation from a dry-run report',
    'broad aliases without replay evidence',
    'hiding failures by changing totals after the fact',
  ]
  switch (kind) {
    case 'protein_shake_composition':
      return [...common, 'adding opaque saved meals for every shake quantity combination']
    case 'quantity_display_trust':
      return [...common, 'normalizing concrete grams, ounces, counts, or scoops to generic serving labels without explanation']
    case 'stale_library_identity':
      return [...common, 'recreating deleted saved meals solely to satisfy old history refs']
    case 'identity_fracture':
      return [...common, 'merging different products or recipes based only on name similarity']
    case 'duplicate_food_rows':
      return [...common, 'silently dividing calories to compensate for duplicate rows']
    case 'slow_parse_missing_knowledge':
      return [...common, 'adding speed aliases that weaken nutrition accuracy']
    case 'pantry_unit_surface':
      return [...common, 'inventing unit conversions for branded products without source facts']
    case 'human_review_delta':
    case 'manual_review':
      return [...common, 'treating uncertain user intent as doctrine']
    case 'save_path_reliability':
      return [...common, 'dropping required nutrition fields just to make insert errors disappear']
    case 'telemetry_observability':
      return [...common, 'recording secret values or unnecessary personal data']
  }
}

function buildThemeExecutionPlan(
  kind: ThemeKind,
  packets: WorkPacket[],
  urgency: ThemeUrgency,
  maturity: ThemeMaturity,
): ThemeExecutionPlan {
  return {
    goal: themeExecutionGoal(kind),
    grouping_scope: themeGroupingScope(kind, maturity),
    execution_mode: themeExecutionMode(kind, urgency, maturity),
    ordered_steps: uniqueStrings(themeOrderedSteps(kind, packets)),
    safety_gates: themeSafetyGates(kind, maturity),
    allowed_actions: uniqueStrings(themeAllowedActions(kind)).slice(0, 8),
    blocked_actions: uniqueStrings(themeBlockedActions(kind)).slice(0, 8),
    acceptance_criteria: uniqueStrings(packets.flatMap((packet) => packet.acceptance_criteria)).slice(0, 6),
    regression_tests: uniqueStrings(packets.flatMap((packet) => packet.regression_tests)).slice(0, 6),
    do_not_do: uniqueStrings([themeAvoid(kind), ...packets.map((packet) => packet.do_not_do)]).slice(0, 5),
    expected_metrics: uniqueStrings(packets.map((packet) => packet.expected_metric)).slice(0, 5),
  }
}

function themeDoctrine(kind: ThemeKind): string {
  switch (kind) {
    case 'protein_shake_composition':
      return 'Composition beats alias sprawl: protein shake should resolve from protein powder quantity plus dextrose quantity, with saved shortcuts only for common defaults.'
    case 'quantity_display_trust':
      return 'User-spoken quantity is display truth unless the system explicitly tells Luke why it cannot preserve it.'
    case 'stale_library_identity':
      return 'Historical deleted identities are evidence, not live parent identities.'
    case 'identity_fracture':
      return 'Favorites and learning memory belong to stable food identity; quantity and display wording are measurement/display layers.'
    case 'duplicate_food_rows':
      return 'A single spoken food should not become multiple saved rows unless Luke clearly asked for multiple portions or separate items.'
    case 'slow_parse_missing_knowledge':
      return 'Common Luke phrases should move toward deterministic pantry/parser paths and away from expensive fallback.'
    case 'pantry_unit_surface':
      return 'A food is not fully useful until it has the units Luke naturally speaks.'
    case 'human_review_delta':
      return 'Parse/save disagreement is user-behavior evidence; inspect it before converting it into aliases or product writes.'
    case 'save_path_reliability':
      return 'Saving must degrade gracefully; stale refs and type mismatches should not block logging.'
    case 'telemetry_observability':
      return 'If Quartermaster cannot see the event story, it cannot learn the right lesson.'
    case 'manual_review':
      return 'Ambiguous evidence should become a question or review packet, not an automatic fix.'
  }
}

function themeDurableFix(kind: ThemeKind): string {
  switch (kind) {
    case 'protein_shake_composition':
      return 'Create/verify ingredient identities for Isopure protein and NutriCost dextrose, parse shake utterances into components, retire stale shake identities from live candidates, then add regression phrases.'
    case 'quantity_display_trust':
      return 'Preserve the spoken unit in the visible plate and add unit alternatives/conversions only where needed to support that display.'
    case 'stale_library_identity':
      return 'Filter or remap stale lib:saved_meal refs before they reach candidate, parse, or save paths.'
    case 'identity_fracture':
      return 'Use canonical source_ref matching for hearts and library memory, then clean or downgrade duplicate saved-meal wrappers that exist only because quantity/display drift created them.'
    case 'duplicate_food_rows':
      return 'Reproduce the segmentation/merge path and add a dedupe or segment ownership guard with regression coverage.'
    case 'slow_parse_missing_knowledge':
      return 'Promote repeated slow phrases into pantry identities, aliases, unit conversions, or parser guards.'
    case 'pantry_unit_surface':
      return 'Add reviewed product facts and natural unit alternatives for repeated foods before adding broad aliases.'
    case 'human_review_delta':
      return 'Compare parse and save artifacts, decide whether Luke corrected the result, then route the smallest safe fix.'
    case 'save_path_reliability':
      return 'Add backend/native defensive handling and regression tests for the exact failing payload class.'
    case 'telemetry_observability':
      return 'Add or repair event fields so Quartermaster can join parse, display, edit, save, and delete into one session story.'
    case 'manual_review':
      return 'Keep this as a review packet until intent is clear.'
  }
}

function themeAvoid(kind: ThemeKind): string {
  switch (kind) {
    case 'protein_shake_composition':
      return 'Do not solve this by piling more opaque protein shake aliases onto old saved meals.'
    case 'quantity_display_trust':
      return 'Do not hide concrete grams/ounces/counts behind generic serving labels.'
    case 'stale_library_identity':
      return 'Do not resurrect deleted identities just because historical logs mention them.'
    case 'identity_fracture':
      return 'Do not create one favorite or saved-meal identity per serving count, bar count, bottle count, or display-name variant.'
    case 'duplicate_food_rows':
      return 'Do not compensate by changing macros; remove the duplicate cause.'
    case 'slow_parse_missing_knowledge':
      return 'Do not accept slow fallback as normal for repeated everyday foods.'
    case 'pantry_unit_surface':
      return 'Do not add products that cannot be logged in Luke’s natural units.'
    case 'human_review_delta':
      return 'Do not turn every delta into an alias without understanding whether it was a correction.'
    case 'save_path_reliability':
      return 'Do not let database strictness make Luke lose a log.'
    case 'telemetry_observability':
      return 'Do not infer user intent from screenshots alone when app events can capture it.'
    case 'manual_review':
      return 'Do not automate ambiguous nutrition decisions.'
  }
}

function buildLearningThemes(findings: Finding[], packets: WorkPacket[]): LearningTheme[] {
  const groups = new Map<ThemeKind, Finding[]>()
  for (const finding of findings) {
    if (finding.type === 'telemetry_gap') continue
    for (const kind of themeKindsForFinding(finding)) {
      const group = groups.get(kind) ?? []
      group.push(finding)
      groups.set(kind, group)
    }
  }

  const themes: LearningTheme[] = []
  for (const [kind, group] of groups) {
    const sorted = [...group].sort((a, b) => b.score - a.score)
    const lead = sorted[0]
    const score = Math.min(100, lead.score + Math.min(30, (sorted.length - 1) * 3))
    const actionLanes = [...new Set(sorted.map((finding) => finding.action_lane))]
    const findingIds = sorted.map((finding) => finding.id)
    const relatedPackets = packets
      .filter((packet) => packet.finding_ids.some((id) => findingIds.includes(id)))
      .sort((a, b) => b.score - a.score || b.evidence_count - a.evidence_count || a.title.localeCompare(b.title))
    const strongestPackets = relatedPackets.slice(0, 5)
    const urgency = themeUrgency(kind, sorted)
    const maturity = themeMaturity(kind, sorted)
    themes.push({
      id: randomUUID(),
      stable_key: kind,
      kind,
      title: themeTitle(kind),
      priority: packetPriority(score),
      score,
      confidence: sorted.length >= 3 || highestSeverity(sorted) === 'high' ? 'high' : 'medium',
      action_lanes: actionLanes,
      owner: themeOwner(kind),
      summary: themeSummary(kind),
      luke_summary: themeLukeSummary(kind),
      urgency,
      maturity,
      why_this_is_one_theme: whyThisIsOneTheme(kind, sorted),
      subtheme_hints: themeSubthemeHints(kind),
      next_checkpoint: themeNextCheckpoint(kind, urgency, maturity),
      doctrine: themeDoctrine(kind),
      durable_fix: themeDurableFix(kind),
      avoid: themeAvoid(kind),
      evidence_count: sorted.length,
      finding_types: [...new Set(sorted.map((finding) => finding.type))],
      example_transcripts: [
        ...new Set(sorted.map((finding) => finding.raw_input_text).filter((value): value is string => Boolean(value))),
      ].slice(0, 5),
      finding_ids: findingIds,
      related_packet_ids: relatedPackets.map((packet) => packet.id),
      strongest_packet_ids: strongestPackets.map((packet) => packet.id),
      strongest_packet_titles: strongestPackets.map((packet) => `${packet.priority} / ${packet.score} - ${packet.title}`),
      execution_plan: buildThemeExecutionPlan(kind, strongestPackets, urgency, maturity),
    })
  }

  return themes.sort((a, b) => themeSortScore(b) - themeSortScore(a) || b.score - a.score || a.title.localeCompare(b.title))
}

function setDiff(current: string[], prior: string[]): string[] {
  const priorSet = new Set(prior)
  return current.filter((key) => !priorSet.has(key))
}

function setIntersection(current: string[], prior: string[]): string[] {
  const priorSet = new Set(prior)
  return current.filter((key) => priorSet.has(key))
}

function themeLabelMap(themes: LearningTheme[]): Map<string, string> {
  return new Map(themes.map((theme) => [theme.stable_key, theme.title]))
}

function packetLabelMap(packets: WorkPacket[]): Map<string, string> {
  return new Map(packets.map((packet) => [packet.stable_key, packet.title]))
}

function labelsForKeys(keys: string[], labels: Map<string, string>): string[] {
  return keys.map((key) => labels.get(key) ?? key)
}

function buildCycleMemory(
  priorState: CycleState | null,
  themes: LearningTheme[],
  packets: WorkPacket[],
  findings: Finding[],
  activityCount: number,
): CycleMemory {
  const themeKeys = themes.map((theme) => theme.stable_key)
  const packetKeys = packets.map((packet) => packet.stable_key)
  const findingKeys = findings.map(findingStableKey)
  const currentThemeLabels = themeLabelMap(themes)
  const currentPacketLabels = packetLabelMap(packets)

  if (!priorState || (priorState.last_theme_keys.length === 0 && priorState.last_packet_keys.length === 0 && priorState.last_finding_keys.length === 0)) {
    return {
      available: false,
      previous_run_at: priorState?.last_successful_run_at ?? null,
      previous_run_id: priorState?.last_run_id ?? null,
      theme_new: labelsForKeys(themeKeys, currentThemeLabels),
      theme_repeated: [],
      theme_resolved: [],
      packet_new: labelsForKeys(packetKeys.slice(0, 20), currentPacketLabels),
      packet_repeated: [],
      packet_resolved: [],
      finding_new_count: findingKeys.length,
      finding_repeated_count: 0,
      finding_resolved_count: 0,
      plain_english: 'This run has no prior cycle fingerprint to compare against, so Quartermaster can describe the current state but cannot yet say what changed.',
    }
  }

  if (activityCount === 0) {
    return {
      available: true,
      previous_run_at: priorState.last_successful_run_at,
      previous_run_id: priorState.last_run_id,
      theme_new: [],
      theme_repeated: [],
      theme_resolved: [],
      packet_new: [],
      packet_repeated: [],
      packet_resolved: [],
      finding_new_count: 0,
      finding_repeated_count: 0,
      finding_resolved_count: 0,
      plain_english: 'No new logs or telemetry events were found since the last cycle, so Quartermaster has nothing new to grade yet.',
    }
  }

  const themeNewKeys = setDiff(themeKeys, priorState.last_theme_keys)
  const themeRepeatedKeys = setIntersection(themeKeys, priorState.last_theme_keys)
  const themeResolvedKeys = setDiff(priorState.last_theme_keys, themeKeys)
  const packetNewKeys = setDiff(packetKeys, priorState.last_packet_keys)
  const packetRepeatedKeys = setIntersection(packetKeys, priorState.last_packet_keys)
  const packetResolvedKeys = setDiff(priorState.last_packet_keys, packetKeys)
  const findingNewCount = setDiff(findingKeys, priorState.last_finding_keys).length
  const findingRepeatedCount = setIntersection(findingKeys, priorState.last_finding_keys).length
  const findingResolvedCount = setDiff(priorState.last_finding_keys, findingKeys).length

  return {
    available: true,
    previous_run_at: priorState.last_successful_run_at,
    previous_run_id: priorState.last_run_id,
    theme_new: labelsForKeys(themeNewKeys, currentThemeLabels),
    theme_repeated: labelsForKeys(themeRepeatedKeys, currentThemeLabels),
    theme_resolved: themeResolvedKeys,
    packet_new: labelsForKeys(packetNewKeys.slice(0, 20), currentPacketLabels),
    packet_repeated: labelsForKeys(packetRepeatedKeys.slice(0, 20), currentPacketLabels),
    packet_resolved: packetResolvedKeys.slice(0, 20),
    finding_new_count: findingNewCount,
    finding_repeated_count: findingRepeatedCount,
    finding_resolved_count: findingResolvedCount,
    plain_english: `Compared with the last cycle, Quartermaster sees ${themeNewKeys.length} new theme(s), ${themeRepeatedKeys.length} repeated theme(s), and ${themeResolvedKeys.length} resolved theme(s).`,
  }
}

function buildReadinessAssessment({
  eventTableAvailable,
  cycleMemory,
  themes,
  workPackets,
  interactionOutcomes,
  orphanSaveEvents,
}: {
  eventTableAvailable: boolean
  cycleMemory: CycleMemory
  themes: LearningTheme[]
  workPackets: WorkPacket[]
  interactionOutcomes: InteractionOutcome[]
  orphanSaveEvents: number
}): QuartermasterReadiness {
  const stopConditions: string[] = []
  const risks: string[] = []
  const hasP0 = workPackets.some((packet) => packet.priority === 'P0')
  const hasFixNow = themes.some((theme) => theme.urgency === 'fix_now')
  const failCount = interactionOutcomes.filter((outcome) => outcome.grade === 'fail').length
  const topPacket = workPackets[0] ?? null

  if (eventTableAvailable) stopConditions.push('food_log_events is available for native parse/save telemetry.')
  else risks.push('food_log_events is unavailable, so failed or abandoned app attempts may be invisible.')

  if (cycleMemory.available) stopConditions.push('cycle memory is available, so Quartermaster can compare new/repeated/resolved themes.')
  else risks.push('cycle memory is not established yet; trend judgment is limited.')

  if (!hasP0) stopConditions.push('no P0 work packet is currently blocking the loop.')
  else risks.push('at least one P0 work packet needs immediate repair before pausing.')

  if (!hasFixNow) stopConditions.push('no theme is currently marked fix_now.')
  else risks.push('at least one theme is marked fix_now.')

  if (failCount === 0) stopConditions.push('no current interaction outcome is graded fail.')
  else risks.push(`${failCount} current interaction outcome${failCount === 1 ? '' : 's'} graded fail.`)

  if (topPacket && topPacket.priority !== 'P0') {
    stopConditions.push(`top packet is ${topPacket.priority}, so the next work is review/repair rather than emergency response.`)
  }

  if (orphanSaveEvents > 0) {
    risks.push(`${orphanSaveEvents} save success event${orphanSaveEvents === 1 ? '' : 's'} no longer map to visible food log rows; these should stay out of clean-success metrics.`)
  }

  if (themes.some((theme) => theme.kind === 'human_review_delta')) {
    risks.push('parse-vs-save deltas still require human intent review before becoming product or parser changes.')
  }

  if (themes.some((theme) => theme.kind === 'pantry_unit_surface')) {
    risks.push('some products still have weak natural unit surfaces and should feed Pantry Forge later.')
  }

  if (!eventTableAvailable || hasP0 || hasFixNow || failCount > 0) {
    return {
      status: 'blocked',
      grade: 'C',
      plain_english: 'Quartermaster is seeing a current blocking condition and should not be considered parked.',
      stop_conditions_met: stopConditions,
      remaining_risks: risks,
      next_best_step: topPacket ? topPacket.title : 'Fix the blocking telemetry or save-path issue, then rerun the cycle.',
    }
  }

  if (workPackets.some((packet) => packet.priority === 'P1' || packet.priority === 'P2')) {
    return {
      status: 'active_repair',
      grade: 'B',
      plain_english: 'Quartermaster is stable enough to work from, but it still has review or repair packets worth handling before a full pause.',
      stop_conditions_met: stopConditions,
      remaining_risks: risks,
      next_best_step: topPacket ? topPacket.title : 'Run the next cycle after real app usage.',
    }
  }

  return {
    status: 'checkpoint_ready',
    grade: 'B+',
    plain_english: 'Quartermaster is at a reasonable stopping point: no blocking failures, cycle memory works, and remaining work is queued as watch/review.',
    stop_conditions_met: stopConditions,
    remaining_risks: risks,
    next_best_step: 'Advance cycle state after review, then let new real app usage create the next batch of evidence.',
  }
}

async function main() {
  const args = parseArgs(process.argv)
  loadEnvLocal()
  const supabase = supabaseFromEnv()
  const runId = randomUUID()
  const generatedAt = new Date().toISOString()
  const stateFile = args.cycle ? defaultStateFile(args) : null
  const priorState = stateFile ? readCycleState(stateFile) : null
  const { sinceIso, source: sinceSource } = resolveSinceForRun(args, priorState)

  const [rows, eventResult, refs] = await Promise.all([
    fetchAllFoodLogs(supabase, sinceIso, args.limit),
    fetchAllFoodLogEvents(supabase, sinceIso, args.limit),
    fetchLiveRefs(supabase),
  ])
  const events = eventResult.rows

  const findings: Finding[] = []
  const savedMealsBySourceRef = buildSavedMealSourceRefIndex(refs.savedMeals)
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
    inspectFoodSources(row, findings, refs.savedMealIds, refs.productIds, savedMealsBySourceRef)
  }
  inspectEvents(
    events,
    findings,
    refs.savedMealIds,
    refs.productIds,
    savedMealsBySourceRef,
    new Set(rows.map((row) => row.id)),
  )

  const dedupedFindings = dedupeFindings(findings)
  const findingCounts: Record<string, number> = {}
  const actionCounts: Record<string, number> = {}
  for (const finding of dedupedFindings) {
    increment(findingCounts, finding.type)
    increment(actionCounts, finding.action_lane)
  }
  const interactionOutcomes = buildInteractionOutcomes(rows, events, dedupedFindings)
  const outcomeCounts: Record<string, number> = {}
  for (const outcome of interactionOutcomes) increment(outcomeCounts, outcome.outcome)
  const workPackets = buildWorkPackets(dedupedFindings)
  const learningThemes = buildLearningThemes(dedupedFindings, workPackets)
  const cycleMemory = buildCycleMemory(priorState, learningThemes, workPackets, dedupedFindings, rows.length + events.length)

  const eventCounts: Record<string, number> = {}
  for (const event of events) increment(eventCounts, event.event_type)
  const parseRequested = eventCounts.parse_requested ?? 0
  const parseReturned = eventCounts.parse_returned ?? 0
  const parseFailed = eventCounts.parse_failed ?? 0
  const saveRequested = eventCounts.save_requested ?? 0
  const saveSucceeded = eventCounts.save_succeeded ?? 0
  const saveFailed = eventCounts.save_failed ?? 0
  const orphanSaveEvents = dedupedFindings.filter((finding) => finding.type === 'orphan_save_event').length
  const visibleSaveSucceeded = Math.max(0, saveSucceeded - orphanSaveEvents)
  const editSignals =
    (eventCounts.food_item_edited ?? 0) +
    (eventCounts.food_item_deleted ?? 0) +
    (eventCounts.food_item_added ?? 0) +
    (eventCounts.disambiguation_selected ?? 0)
  const passOutcomes = interactionOutcomes.filter((outcome) => outcome.grade === 'pass').length
  const failOutcomes = interactionOutcomes.filter((outcome) => outcome.grade === 'fail').length
  const warnOutcomes = interactionOutcomes.filter((outcome) => outcome.grade === 'warn').length
  const readiness = buildReadinessAssessment({
    eventTableAvailable: eventResult.available,
    cycleMemory,
    themes: learningThemes,
    workPackets,
    interactionOutcomes,
    orphanSaveEvents,
  })

  const report: AuditReport = {
    run_id: runId,
    generated_at: generatedAt,
    args,
    cycle: {
      enabled: args.cycle,
      state_file: stateFile,
      previous_run_at: priorState?.last_successful_run_at ?? null,
      effective_since: sinceIso,
      since_source: sinceSource,
      state_written: Boolean(args.cycle && args.writeState && stateFile),
    },
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
      learning_themes: learningThemes.length,
      work_packets: workPackets.length,
      cycle_memory_available: cycleMemory.available ? 'yes' : 'no',
      cycle_theme_new_count: cycleMemory.theme_new.length,
      cycle_theme_repeated_count: cycleMemory.theme_repeated.length,
      cycle_theme_resolved_count: cycleMemory.theme_resolved.length,
      cycle_packet_new_count: cycleMemory.packet_new.length,
      cycle_packet_repeated_count: cycleMemory.packet_repeated.length,
      cycle_packet_resolved_count: cycleMemory.packet_resolved.length,
      interaction_outcomes: interactionOutcomes.length,
      since: args.since,
      effective_since: sinceIso,
    },
    scoreboard: {
      parse_requested_events: parseRequested,
      parse_returned_events: parseReturned,
      parse_failed_events: parseFailed,
      parse_success_rate_pct: parseRequested > 0 ? Math.round((parseReturned / parseRequested) * 1000) / 10 : null,
      save_requested_events: saveRequested,
      save_succeeded_events: saveSucceeded,
      visible_save_succeeded_events: visibleSaveSucceeded,
      orphan_save_events: orphanSaveEvents,
      save_failed_events: saveFailed,
      save_success_rate_pct: saveRequested > 0 ? Math.round((saveSucceeded / saveRequested) * 1000) / 10 : null,
      visible_save_success_rate_pct: saveRequested > 0 ? Math.round((visibleSaveSucceeded / saveRequested) * 1000) / 10 : null,
      edit_or_delete_events: editSignals,
      saved_rows_likely_accepted_unchanged: likelyAcceptedUnchanged,
      outcome_pass_count: passOutcomes,
      outcome_warn_count: warnOutcomes,
      outcome_fail_count: failOutcomes,
      top_work_packet_score: workPackets[0]?.score ?? null,
    },
    path_counts: pathCounts,
    outcome_counts: outcomeCounts,
    finding_counts: findingCounts,
    action_counts: actionCounts,
    cycle_memory: cycleMemory,
    readiness,
    learning_themes: learningThemes,
    work_packets: workPackets,
    interaction_outcomes: interactionOutcomes,
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
  if (args.cycle && args.writeState && stateFile) {
    writeCycleState(stateFile, {
      version: 2,
      last_successful_run_at: generatedAt,
      last_run_id: runId,
      last_rows_read: rows.length,
      last_events_read: events.length,
      last_findings: dedupedFindings.length,
      last_learning_themes: learningThemes.length,
      last_work_packets: workPackets.length,
      last_theme_keys: learningThemes.map((theme) => theme.stable_key),
      last_packet_keys: workPackets.map((packet) => packet.stable_key),
      last_finding_keys: dedupedFindings.map(findingStableKey),
      updated_at: new Date().toISOString(),
    })
  }

  console.log('Quartermaster Audit')
  console.log('')
  console.log(`run_id: ${runId}`)
  console.log(`rows_read: ${rows.length}`)
  console.log(`events_read: ${events.length}`)
  console.log(`findings: ${dedupedFindings.length}`)
  console.log(`learning_themes: ${learningThemes.length}`)
  console.log(`work_packets: ${workPackets.length}`)
  console.log(`cycle_memory: ${cycleMemory.available ? 'available' : 'no prior fingerprint'}`)
  if (args.cycle) console.log(`cycle_state: ${stateFile}${args.writeState ? '' : ' (not written)'}`)
  console.log(`json: ${args.json ? `${basePath}.json` : 'skipped'}`)
  console.log(`markdown: ${args.markdown ? `${basePath}.md` : 'skipped'}`)
}

main().catch((error) => {
  console.error('Quartermaster audit failed:', error)
  process.exit(1)
})
