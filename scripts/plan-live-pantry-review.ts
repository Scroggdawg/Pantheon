// Plan a future live pantry review apply from a Markdown ledger + Supabase candidates.
//
// Read-only. This does not write products, aliases, rejections, or candidate decisions.
//
// Usage:
//   npx tsx scripts/plan-live-pantry-review.ts --ledger=data/pantry/approvals/live-review-2026-05-16.md

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import type { PantryCandidate, PantryCategory, PantryProductPayload, PantrySourceKind } from '../lib/pantry-builder/types'

const DECISIONS = new Set(['approved', 'rejected', 'edit_needed'])
const REQUIRED_HEADERS = ['candidate_key', 'decision', 'corrected_name', 'notes']

interface Args {
  ledgerPath: string | null
}

interface LedgerRow {
  line: number
  candidate_key: string
  decision: 'approved' | 'rejected' | 'edit_needed'
  corrected_name: string
  notes: string
}

interface CandidateRow {
  candidate_key: string
  target_query: string | null
  display_name: string
  source_kind: PantrySourceKind
  source_dataset: string | null
  external_id: string | null
  category: PantryCategory
  proposed_product: PantryProductPayload
  aliases: string[]
  rejected_aliases: string[]
  unit_alternatives: PantryCandidate['unit_alternatives']
  risk_score: number
  decision: string
  reasons: string[]
  applied_product_id: string | null
}

type PlannedAction =
  | {
      type: 'would_insert_review_product'
      candidate_key: string
      target_query: string | null
      display_name: string
      source: string
      category: PantryCategory
      units: number
      aliases: number
      risk_score: number
      protected_write: boolean
      notes: string
    }
  | {
      type: 'would_record_rejection'
      candidate_key: string
      target_query: string | null
      display_name: string
      rejected_source_ref: string
      reason: string
    }
  | {
      type: 'needs_manual_edit'
      candidate_key: string
      target_query: string | null
      display_name: string
      corrected_name: string
      reason: string
    }

function parseArgs(argv: string[]): Args {
  const args: Args = { ledgerPath: null }
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--ledger=')) args.ledgerPath = arg.slice('--ledger='.length)
    else throw new Error(`Unknown arg: ${arg}`)
  }
  if (!args.ledgerPath) throw new Error('--ledger=<path> is required')
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

function parseTableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isSeparator(cells: string[]) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function parseLedger(path: string): LedgerRow[] {
  const lines = readFileSync(resolve(path), 'utf8').split('\n')
  const rows: LedgerRow[] = []

  for (let index = 0; index < lines.length; index++) {
    const cells = parseTableCells(lines[index])
    if (cells.join('|') !== REQUIRED_HEADERS.join('|')) continue

    const separator = parseTableCells(lines[index + 1] ?? '')
    if (!isSeparator(separator)) {
      throw new Error(`Approval table header at line ${index + 1} must be followed by a Markdown separator row`)
    }

    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex++) {
      const line = lines[rowIndex]
      if (!line.trim().startsWith('|')) break
      const rowCells = parseTableCells(line)
      if (rowCells.length !== REQUIRED_HEADERS.length) {
        throw new Error(`Line ${rowIndex + 1}: expected ${REQUIRED_HEADERS.length} cells, got ${rowCells.length}`)
      }
      if (!DECISIONS.has(rowCells[1])) {
        throw new Error(`Line ${rowIndex + 1}: decision must be one of ${[...DECISIONS].join(', ')}`)
      }
      rows.push({
        line: rowIndex + 1,
        candidate_key: rowCells[0],
        decision: rowCells[1] as LedgerRow['decision'],
        corrected_name: rowCells[2],
        notes: rowCells[3],
      })
    }
  }

  if (rows.length === 0) throw new Error('No approval rows found')
  return rows
}

function rejectionSourceRef(candidate: CandidateRow) {
  if (candidate.applied_product_id) return `lib:product:${candidate.applied_product_id}`
  return `${candidate.source_kind}:${candidate.source_dataset ?? 'unknown'}:${candidate.external_id ?? candidate.candidate_key}`
}

function planAction(row: LedgerRow, candidate: CandidateRow): PlannedAction {
  if (row.decision === 'rejected') {
    return {
      type: 'would_record_rejection',
      candidate_key: row.candidate_key,
      target_query: candidate.target_query,
      display_name: candidate.display_name,
      rejected_source_ref: rejectionSourceRef(candidate),
      reason: row.notes,
    }
  }

  if (row.decision === 'edit_needed') {
    return {
      type: 'needs_manual_edit',
      candidate_key: row.candidate_key,
      target_query: candidate.target_query,
      display_name: candidate.display_name,
      corrected_name: row.corrected_name,
      reason: row.notes,
    }
  }

  return {
    type: 'would_insert_review_product',
    candidate_key: row.candidate_key,
    target_query: candidate.target_query,
    display_name: row.corrected_name || candidate.display_name,
    source: `${candidate.source_kind}/${candidate.source_dataset ?? 'unknown'}/${candidate.external_id ?? 'n/a'}`,
    category: candidate.category,
    units: candidate.unit_alternatives.length,
    aliases: candidate.aliases.length,
    risk_score: candidate.risk_score,
    protected_write: true,
    notes: row.notes,
  }
}

async function loadCandidates(candidateKeys: string[]): Promise<Map<string, CandidateRow>> {
  const supabase = supabaseFromEnv()
  const { data, error } = await supabase
    .from('pantry_import_candidates')
    .select(
      'candidate_key,target_query,display_name,source_kind,source_dataset,external_id,category,proposed_product,aliases,rejected_aliases,unit_alternatives,risk_score,decision,reasons,applied_product_id',
    )
    .in('candidate_key', candidateKeys)
  if (error) throw error
  return new Map(((data ?? []) as CandidateRow[]).map((candidate) => [candidate.candidate_key, candidate]))
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv)
  const rows = parseLedger(args.ledgerPath!)
  const candidatesByKey = await loadCandidates(rows.map((row) => row.candidate_key))
  const missing = rows.filter((row) => !candidatesByKey.has(row.candidate_key))
  if (missing.length > 0) {
    throw new Error(`Ledger references missing live candidates:\n${missing.map((row) => `line ${row.line}: ${row.candidate_key}`).join('\n')}`)
  }

  const actions = rows.map((row) => planAction(row, candidatesByKey.get(row.candidate_key)!))
  const counts = actions.reduce<Record<string, number>>((acc, action) => {
    acc[action.type] = (acc[action.type] ?? 0) + 1
    return acc
  }, {})
  const protectedWrites = actions.filter((action) => action.type === 'would_insert_review_product' && action.protected_write)

  console.log('Live pantry review apply plan')
  console.log(`ledger: ${resolve(args.ledgerPath!)}`)
  console.log(`ledger_rows: ${rows.length}`)
  console.log(`counts: ${Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(', ')}`)
  console.log(`protected_writes: ${protectedWrites.length}`)
  console.log('')
  console.log('Actions')
  for (const action of actions) console.log(JSON.stringify(action))
  if (protectedWrites.length > 0) {
    console.log('')
    console.log('NOTE: protected writes require explicit Luke approval before any future apply script may execute them.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
