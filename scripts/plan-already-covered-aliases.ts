// Plan "Already Covered" pantry review rows into accepted aliases.
//
// Default mode is read-only. Live alias writes require all three flags:
//   --apply --allow-alias-writes --max-alias=<n>
//
// Usage:
//   npx tsx scripts/plan-already-covered-aliases.ts --ledger=data/pantry/approvals/plain-review-2026-05-16.md
//   npx tsx scripts/plan-already-covered-aliases.ts --ledger=data/pantry/approvals/plain-review-2026-05-16.md --apply --allow-alias-writes --max-alias=25

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { bustResponseCacheForUser } from '../lib/claude/parse-meal-response-cache'
import { getCanonicalUserId } from '../lib/pantheon-user'
import {
  type AliasProductTarget,
  type AliasRoutePlan,
  type ExistingIdentityAlias,
  planAlreadyCoveredAliasRoute,
} from '../lib/pantry-builder/alias-routing'

const DECISIONS = new Set(['approved', 'rejected', 'edit_needed'])
const REQUIRED_HEADERS = ['candidate_key', 'decision', 'corrected_name', 'notes']
const DUPLICATE_ERROR_CODE = '23505'

interface Args {
  allowAliasWrites: boolean
  apply: boolean
  ledgerPath: string | null
  maxAlias: number
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
  import_run_id: string | null
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    allowAliasWrites: false,
    apply: false,
    ledgerPath: null,
    maxAlias: 25,
  }

  for (const arg of argv.slice(2)) {
    if (arg === '--allow-alias-writes') args.allowAliasWrites = true
    else if (arg === '--apply') args.apply = true
    else if (arg.startsWith('--ledger=')) args.ledgerPath = arg.slice('--ledger='.length)
    else if (arg.startsWith('--max-alias=')) args.maxAlias = Number(arg.slice('--max-alias='.length))
    else throw new Error(`Unknown arg: ${arg}`)
  }

  if (!args.ledgerPath) throw new Error('--ledger=<path> is required')
  if (!Number.isInteger(args.maxAlias) || args.maxAlias < 1) throw new Error('--max-alias must be a positive integer')
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

function coveredRows(rows: LedgerRow[]) {
  return rows.filter(
    (row) =>
      row.decision === 'edit_needed' &&
      row.notes.toLowerCase().startsWith('covered:'),
  )
}

async function loadCandidates(candidateKeys: string[]): Promise<Map<string, CandidateRow>> {
  const supabase = supabaseFromEnv()
  const { data, error } = await supabase
    .from('pantry_import_candidates')
    .select('candidate_key,target_query,display_name,import_run_id')
    .in('candidate_key', candidateKeys)
  if (error) throw error
  return new Map(((data ?? []) as CandidateRow[]).map((candidate) => [candidate.candidate_key, candidate]))
}

async function loadProducts(): Promise<AliasProductTarget[]> {
  const supabase = supabaseFromEnv()
  const { data, error } = await supabase
    .from('products')
    .select('id,name,brand')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as AliasProductTarget[]
}

async function loadAliases(): Promise<ExistingIdentityAlias[]> {
  const supabase = supabaseFromEnv()
  const { data, error } = await supabase
    .from('food_identity_aliases')
    .select('target_source_ref,normalized_alias')
    .eq('active', true)
  if (error) throw error
  return (data ?? []) as ExistingIdentityAlias[]
}

function countPlans(plans: AliasRoutePlan[]) {
  return plans.reduce<Record<string, number>>((acc, plan) => {
    acc[plan.type] = (acc[plan.type] ?? 0) + 1
    return acc
  }, {})
}

function isDuplicateError(error: { code?: string; message?: string }) {
  return error.code === DUPLICATE_ERROR_CODE || String(error.message ?? '').toLowerCase().includes('duplicate')
}

function printPlan(plan: AliasRoutePlan) {
  console.log(JSON.stringify(plan))
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv)
  const rows = coveredRows(parseLedger(args.ledgerPath!))
  const candidateKeys = rows.map((row) => row.candidate_key)
  const [candidatesByKey, products, aliases] = await Promise.all([
    loadCandidates(candidateKeys),
    loadProducts(),
    loadAliases(),
  ])

  const missing = rows.filter((row) => !candidatesByKey.has(row.candidate_key))
  if (missing.length > 0) {
    throw new Error(`Ledger references missing live candidates:\n${missing.map((row) => `line ${row.line}: ${row.candidate_key}`).join('\n')}`)
  }

  const plans = rows.map((row) => {
    const candidate = candidatesByKey.get(row.candidate_key)!
    return planAlreadyCoveredAliasRoute(candidate, products, aliases)
  })
  const proposed = plans.filter((plan): plan is Extract<AliasRoutePlan, { type: 'propose_alias' }> => plan.type === 'propose_alias')
  const counts = countPlans(plans)

  console.log(`Already-covered alias ${args.apply ? 'apply' : 'plan'}`)
  console.log(`ledger: ${resolve(args.ledgerPath!)}`)
  console.log(`covered_rows: ${rows.length}`)
  console.log(`products_loaded: ${products.length}`)
  console.log(`aliases_loaded: ${aliases.length}`)
  console.log(`counts: ${Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(', ')}`)
  console.log(`max_alias: ${args.maxAlias}`)
  console.log('')
  console.log('Actions')
  for (const plan of plans) printPlan(plan)

  if (proposed.length > args.maxAlias) {
    throw new Error(`refusing alias apply: ${proposed.length} proposed aliases exceeds --max-alias=${args.maxAlias}`)
  }

  if (!args.apply) {
    console.log('')
    console.log('Dry run only. No Supabase writes.')
    return
  }
  if (!args.allowAliasWrites) {
    throw new Error('Live alias writes require --allow-alias-writes')
  }

  const supabase = supabaseFromEnv()
  const userId = await getCanonicalUserId(supabase)
  let inserted = 0
  for (const plan of proposed) {
    const candidate = candidatesByKey.get(plan.candidate_key)!
    const { error } = await supabase.from('food_identity_aliases').insert({
      target_type: 'product',
      target_id: plan.target_id,
      target_source_ref: plan.target_source_ref,
      alias: plan.alias,
      normalized_alias: plan.normalized_alias,
      alias_type: 'already_covered',
      confidence: plan.confidence,
      source: 'pantry_review_alias',
      import_run_id: candidate.import_run_id,
      active: true,
    })
    if (error && !isDuplicateError(error)) throw error
    if (!error) inserted++
  }

  if (inserted > 0) await bustResponseCacheForUser(supabase, userId)
  console.log('')
  console.log(`Inserted aliases: ${inserted}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
