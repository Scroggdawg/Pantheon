// Export live Pantry Builder review candidates into small, Luke-facing packets.
//
// Read-only. This does not apply products, aliases, rejections, or candidate
// decisions. "Quick approve" rows intentionally stay edit_needed; Luke must flip
// a row to approved before the guarded apply script can write it.
//
// Usage:
//   npx tsx scripts/export-smart-pantry-review-packets.ts
//   npx tsx scripts/export-smart-pantry-review-packets.ts --limit=250 --output-dir=data/pantry/approvals/smart-review-YYYY-MM-DD

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import type {
  PantryCandidate,
  PantryCategory,
  PantryDecision,
  PantryProductPayload,
  PantrySourceKind,
} from '../lib/pantry-builder/types'

type CandidateDecision = PantryDecision | 'applied' | 'skipped' | 'failed'
type PacketKind = 'quick-reject' | 'quick-approve-usda' | 'brands-restaurants' | 'manual-needed'

interface Args {
  limit: number
  outputDir: string | null
}

interface CandidateRow {
  candidate_key: string
  target_query: string | null
  normalized_name: string
  display_name: string
  source_kind: PantrySourceKind
  source_dataset: string | null
  external_id: string | null
  source_release: string | null
  category: PantryCategory
  proposed_product: PantryProductPayload
  aliases: string[]
  rejected_aliases: string[]
  unit_alternatives: PantryCandidate['unit_alternatives']
  risk_score: number
  decision: CandidateDecision
  reasons: string[]
  import_run_id: string | null
  updated_at: string
}

interface PacketRow {
  row: CandidateRow
  packet: PacketKind
  tableDecision: 'approved' | 'rejected' | 'edit_needed'
  recommendation: string
  why: string[]
  sortScore: number
}

const PACKET_TITLES: Record<PacketKind, string> = {
  'quick-reject': 'Quick Reject',
  'quick-approve-usda': 'Quick Approve USDA',
  'brands-restaurants': 'Brands Restaurants',
  'manual-needed': 'Manual Needed',
}

const PACKET_FILES: Record<PacketKind, string> = {
  'quick-reject': '01_quick_reject.md',
  'quick-approve-usda': '02_quick_approve_usda.md',
  'brands-restaurants': '03_brands_restaurants.md',
  'manual-needed': '04_manual_needed.md',
}

const REVIEW_TERMS = [
  'chipotle',
  'mcdonald',
  'olive garden',
  'carrabba',
  'cracker barrel',
  'taco bell',
  'rebbl',
  'yasso',
  'magic spoon',
  'silk',
  'kashi',
  'cracklin',
  'harmless harvest',
  'taste nirvana',
  'goya',
  'margarita',
  'beer',
  'cocktail',
  'dos equis',
  'dos xx',
  'protein shake',
  'protein powder',
]

const COMPOSITE_TERMS = [
  'bowl',
  'sandwich',
  'burrito',
  'pizza',
  'lasagna',
  'meatball',
  'soup',
  'sauce',
  'with ',
]

function parseArgs(argv: string[]): Args {
  const args: Args = {
    limit: 250,
    outputDir: null,
  }

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length))
    else if (arg.startsWith('--output-dir=')) args.outputDir = arg.slice('--output-dir='.length)
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

function defaultOutputDir() {
  return `data/pantry/approvals/smart-review-${new Date().toISOString().slice(0, 10)}`
}

function escapeCell(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/\|/g, '/')
    .replace(/\r?\n/g, ' ')
    .trim()
}

function normalizedText(row: CandidateRow) {
  return `${row.target_query ?? ''} ${row.display_name} ${row.proposed_product.brand ?? ''}`.toLowerCase()
}

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term))
}

function hasReason(row: CandidateRow, pattern: string) {
  return row.reasons.some((reason) => reason.includes(pattern))
}

function isBrandRestaurantOrProtected(row: CandidateRow) {
  const text = normalizedText(row)
  return (
    row.source_kind !== 'usda' ||
    Boolean(row.proposed_product.brand) ||
    hasAny(text, REVIEW_TERMS) ||
    hasReason(row, 'brand') ||
    hasReason(row, 'restaurant') ||
    hasReason(row, 'alcohol') ||
    hasReason(row, 'profile_review_only')
  )
}

function isComposite(row: CandidateRow) {
  const text = normalizedText(row)
  return hasAny(text, COMPOSITE_TERMS) || hasReason(row, 'composite') || hasReason(row, 'prepared_dish')
}

function isQuickReject(row: CandidateRow) {
  return (
    row.decision === 'rejected' ||
    hasReason(row, 'duplicate_existing_product') ||
    hasReason(row, 'macro_sanity_failed') ||
    hasReason(row, 'low_target_token_coverage_0') ||
    hasReason(row, 'context_token_missing') ||
    hasReason(row, 'single_token_secondary_match_review_required')
  )
}

function isQuickApproveUsda(row: CandidateRow) {
  if (row.decision !== 'review_required') return false
  if (row.source_kind !== 'usda') return false
  if (!['Foundation', 'Survey (FNDDS)', 'SR Legacy'].includes(row.source_dataset ?? '')) return false
  if (isBrandRestaurantOrProtected(row)) return false
  if (isComposite(row)) return false
  if (row.risk_score > 30) return false
  if (row.unit_alternatives.length < 3) return false
  const reasons = new Set(row.reasons)
  if (reasons.size === 0) return true
  return [...reasons].every((reason) => reason === 'not_further_specified_review_required')
}

function packetFor(row: CandidateRow): PacketRow {
  const why: string[] = []

  if (isQuickReject(row)) {
    why.push('Risk engine already rejected this or found a strong bad-match signal.')
    return {
      row,
      packet: 'quick-reject',
      tableDecision: 'rejected',
      recommendation: 'RECOMMEND_REJECT',
      why,
      sortScore: row.decision === 'rejected' ? 0 : 10 + row.risk_score,
    }
  }

  if (isQuickApproveUsda(row)) {
    why.push('Boring USDA candidate with low risk; Luke can flip to approved if the detail looks right.')
    return {
      row,
      packet: 'quick-approve-usda',
      tableDecision: 'edit_needed',
      recommendation: 'RECOMMEND_APPROVE_AFTER_EYEBALL',
      why,
      sortScore: row.risk_score,
    }
  }

  if (isBrandRestaurantOrProtected(row) || isComposite(row)) {
    why.push('Protected source/class: brand, restaurant, composite, alcohol, supplement, or profile-specific row.')
    return {
      row,
      packet: 'brands-restaurants',
      tableDecision: 'edit_needed',
      recommendation: 'NEEDS_LUKE_OR_MANUAL_SOURCE',
      why,
      sortScore: row.risk_score,
    }
  }

  why.push('Needs manual correction, better source data, or a future importer guard.')
  return {
    row,
    packet: 'manual-needed',
    tableDecision: 'edit_needed',
    recommendation: 'NEEDS_MANUAL_EDIT',
    why,
    sortScore: row.risk_score,
  }
}

function formatMacros(product: PantryProductPayload) {
  return `${product.calories_per_serving} cal, ${product.protein_g_per_serving}P, ${product.carbs_g_per_serving}C, ${product.fat_g_per_serving}F`
}

function renderPacket(kind: PacketKind, rows: PacketRow[], generatedAt: string) {
  const lines = [
    `# ${PACKET_TITLES[kind]}`,
    '',
    `Generated: ${generatedAt}`,
    `Rows: ${rows.length}`,
    '',
    'This file is a review packet. It does not apply rows to Supabase.',
    '',
  ]

  if (kind === 'quick-approve-usda') {
    lines.push(
      'Safety note: these rows are recommendations only. The table keeps `edit_needed` by default; change a row to `approved` only after eyeballing the detail below.',
      '',
    )
  }

  lines.push('| candidate_key | decision | corrected_name | notes |')
  lines.push('| --- | --- | --- | --- |')
  for (const packetRow of rows) {
    const row = packetRow.row
    const notes = `${packetRow.recommendation}: ${packetRow.why.join(' ')} Reasons: ${row.reasons.join(', ') || 'none'}.`
    lines.push(
      `| ${escapeCell(row.candidate_key)} | ${packetRow.tableDecision} | ${escapeCell(row.display_name)} | ${escapeCell(notes)} |`,
    )
  }

  lines.push('', '## Candidate Detail', '')
  for (const packetRow of rows) {
    const row = packetRow.row
    const product = row.proposed_product
    lines.push(`### ${row.target_query ?? 'unknown target'} -> ${row.display_name}`)
    lines.push('')
    lines.push(`- recommendation: ${packetRow.recommendation}`)
    lines.push(`- candidate_key: \`${row.candidate_key}\``)
    lines.push(`- current_decision: ${row.decision}`)
    lines.push(`- packet: ${packetRow.packet}`)
    lines.push(`- run: ${row.import_run_id ?? 'n/a'}`)
    lines.push(`- source: ${row.source_kind} / ${row.source_dataset ?? 'unknown'} / ${row.external_id ?? 'n/a'}`)
    lines.push(`- macros: ${formatMacros(product)}`)
    lines.push(`- units: ${row.unit_alternatives.slice(0, 10).map((unit) => `${unit.unit}=${unit.grams}g`).join(', ') || 'none'}`)
    lines.push(`- aliases: ${row.aliases.join(', ') || 'none'}`)
    lines.push(`- rejected_aliases: ${row.rejected_aliases.join(', ') || 'none'}`)
    lines.push(`- risk: ${row.risk_score}`)
    lines.push(`- reasons: ${row.reasons.join(', ') || 'none'}`)
    lines.push(`- why_here: ${packetRow.why.join(' ')}`)
    lines.push(`- updated_at: ${row.updated_at}`)
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

function renderIndex(packets: Record<PacketKind, PacketRow[]>, generatedAt: string) {
  const order: PacketKind[] = ['quick-reject', 'quick-approve-usda', 'brands-restaurants', 'manual-needed']
  const lines = [
    '# Smart Pantry Review Packets',
    '',
    `Generated: ${generatedAt}`,
    '',
    'ELI5: this splits the scary pantry backlog into smaller piles.',
    '',
    '- Quick Reject: rows that look safely rejectable or are already rejected by the risk engine.',
    '- Quick Approve USDA: boring USDA rows worth eyeballing; still `edit_needed` until Luke flips them to `approved`.',
    '- Brands Restaurants: protected rows that need Luke/manual source judgment.',
    '- Manual Needed: weird leftovers that need correction or future importer rules.',
    '',
    'Suggested review order:',
    '1. Quick Reject',
    '2. Quick Approve USDA',
    '3. Brands Restaurants',
    '4. Manual Needed',
    '',
    '| packet | rows | file |',
    '| --- | ---: | --- |',
  ]

  for (const kind of order) {
    lines.push(`| ${PACKET_TITLES[kind]} | ${packets[kind].length} | ${PACKET_FILES[kind]} |`)
  }

  lines.push('')
  lines.push('Operational guardrails:')
  lines.push('- These exports are read-only.')
  lines.push('- Applying still requires the guarded apply script.')
  lines.push('- Review writes still require explicit approval and `--allow-review-writes`.')
  lines.push('- Branded, restaurant, alcohol, supplement, recipe, composite, and OFF rows remain protected.')
  lines.push('')
  return lines.join('\n')
}

async function loadRows(limit: number): Promise<CandidateRow[]> {
  const supabase = supabaseFromEnv()
  const { data, error } = await supabase
    .from('pantry_import_candidates')
    .select(
      'candidate_key,target_query,normalized_name,display_name,source_kind,source_dataset,external_id,source_release,category,proposed_product,aliases,rejected_aliases,unit_alternatives,risk_score,decision,reasons,import_run_id,updated_at',
    )
    .in('decision', ['review_required', 'rejected'])
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as CandidateRow[]
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv)
  const generatedAt = new Date().toISOString()
  const rows = await loadRows(args.limit)
  const outputDir = resolve(args.outputDir ?? defaultOutputDir())
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

  const packets: Record<PacketKind, PacketRow[]> = {
    'quick-reject': [],
    'quick-approve-usda': [],
    'brands-restaurants': [],
    'manual-needed': [],
  }

  for (const packetRow of rows.map(packetFor)) packets[packetRow.packet].push(packetRow)
  for (const packetRows of Object.values(packets)) {
    packetRows.sort((a, b) => a.sortScore - b.sortScore || (a.row.target_query ?? '').localeCompare(b.row.target_query ?? ''))
  }

  writeFileSync(join(outputDir, '00_INDEX.md'), renderIndex(packets, generatedAt))
  for (const [kind, packetRows] of Object.entries(packets) as Array<[PacketKind, PacketRow[]]>) {
    writeFileSync(join(outputDir, PACKET_FILES[kind]), renderPacket(kind, packetRows, generatedAt))
  }

  console.log(`Wrote ${outputDir}`)
  for (const kind of Object.keys(packets) as PacketKind[]) {
    console.log(`${kind}: ${packets[kind].length}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
