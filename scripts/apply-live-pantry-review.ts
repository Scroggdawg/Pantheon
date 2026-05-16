// Apply Luke-reviewed pantry ledger decisions.
//
// Default mode is DRY RUN. Live writes require both:
//   --apply --allow-review-writes
//
// This script may insert approved review products and record rejected aliases,
// but it never auto-approves review rows by itself. The ledger is the authority.
//
// Usage:
//   npx tsx scripts/apply-live-pantry-review.ts --ledger=data/pantry/approvals/live-review-2026-05-16.md
//   npx tsx scripts/apply-live-pantry-review.ts --ledger=data/pantry/approvals/live-review-2026-05-16.md --apply --allow-review-writes

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { bustResponseCacheForUser } from '../lib/claude/parse-meal-response-cache'
import { getCanonicalUserId } from '../lib/pantheon-user'
import { normalizeFoodText } from '../lib/pantry-builder/normalize'
import type { PantryCandidate, PantryCategory, PantryProductPayload, PantrySourceKind } from '../lib/pantry-builder/types'

const DECISIONS = new Set(['approved', 'rejected', 'edit_needed'])
const REQUIRED_HEADERS = ['candidate_key', 'decision', 'corrected_name', 'notes']
const DUPLICATE_ERROR_CODE = '23505'

interface Args {
  allowReviewWrites: boolean
  apply: boolean
  ledgerPath: string | null
  maxInsert: number
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
  source_release: string | null
  category: PantryCategory
  proposed_product: PantryProductPayload
  aliases: string[]
  rejected_aliases: string[]
  unit_alternatives: PantryCandidate['unit_alternatives']
  risk_score: number
  decision: string
  reasons: string[]
  import_run_id: string | null
  applied_product_id: string | null
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    allowReviewWrites: false,
    apply: false,
    ledgerPath: null,
    maxInsert: 25,
  }

  for (const arg of argv.slice(2)) {
    if (arg === '--allow-review-writes') args.allowReviewWrites = true
    else if (arg === '--apply') args.apply = true
    else if (arg.startsWith('--ledger=')) args.ledgerPath = arg.slice('--ledger='.length)
    else if (arg.startsWith('--max-insert=')) args.maxInsert = Number(arg.slice('--max-insert='.length))
    else throw new Error(`Unknown arg: ${arg}`)
  }

  if (!args.ledgerPath) throw new Error('--ledger=<path> is required')
  if (!Number.isInteger(args.maxInsert) || args.maxInsert < 1) throw new Error('--max-insert must be a positive integer')
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

async function loadCandidates(candidateKeys: string[]): Promise<Map<string, CandidateRow>> {
  const supabase = supabaseFromEnv()
  const { data, error } = await supabase
    .from('pantry_import_candidates')
    .select(
      'candidate_key,target_query,display_name,source_kind,source_dataset,external_id,source_release,category,proposed_product,aliases,rejected_aliases,unit_alternatives,risk_score,decision,reasons,import_run_id,applied_product_id',
    )
    .in('candidate_key', candidateKeys)
  if (error) throw error
  return new Map(((data ?? []) as CandidateRow[]).map((candidate) => [candidate.candidate_key, candidate]))
}

function productInsertPayload(row: LedgerRow, candidate: CandidateRow) {
  const product = candidate.proposed_product
  return {
    name: row.corrected_name || product.name,
    brand: product.brand,
    unit: product.unit,
    serving_size_g: product.serving_size_g,
    calories_per_serving: product.calories_per_serving,
    protein_g_per_serving: product.protein_g_per_serving,
    fat_g_per_serving: product.fat_g_per_serving,
    carbs_g_per_serving: product.carbs_g_per_serving,
    fiber_g_per_serving: product.fiber_g_per_serving,
    fulfillment_source: product.fulfillment_source,
    barcode: product.barcode,
    product_url: product.product_url,
    notes: product.notes ? `${product.notes}\n${row.notes}` : row.notes,
    tracks_inventory: product.tracks_inventory,
    servings_per_unit: product.servings_per_unit,
    unit_alternatives: product.unit_alternatives,
    fdc_id: product.fdc_id,
    unit_alternatives_updated_at: product.unit_alternatives_updated_at,
    provenance_source_kind: product.provenance_source_kind,
    provenance_dataset: product.provenance_dataset,
    provenance_external_id: product.provenance_external_id,
    provenance_release: product.provenance_release,
    provenance_import_run_id: candidate.import_run_id,
    import_confidence: 'medium',
    canonical_category: product.canonical_category,
  }
}

function rejectionSourceRef(candidate: CandidateRow) {
  if (candidate.applied_product_id) return `lib:product:${candidate.applied_product_id}`
  return `${candidate.source_kind}:${candidate.source_dataset ?? 'unknown'}:${candidate.external_id ?? candidate.candidate_key}`
}

function isDuplicateError(error: { code?: string; message?: string }) {
  return error.code === DUPLICATE_ERROR_CODE || String(error.message ?? '').toLowerCase().includes('duplicate')
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

  const approvedRows = rows.filter((row) => row.decision === 'approved')
  const rejectedRows = rows.filter((row) => row.decision === 'rejected')
  const editRows = rows.filter((row) => row.decision === 'edit_needed')
  if (approvedRows.length > args.maxInsert) {
    throw new Error(`refusing review apply: ${approvedRows.length} approved rows exceeds --max-insert=${args.maxInsert}`)
  }

  console.log(`Live pantry review ${args.apply ? 'apply' : 'dry-run'}`)
  console.log(`ledger: ${resolve(args.ledgerPath!)}`)
  console.log(`approved: ${approvedRows.length}`)
  console.log(`rejected: ${rejectedRows.length}`)
  console.log(`edit_needed: ${editRows.length}`)
  console.log(`max_insert: ${args.maxInsert}`)

  if (!args.apply) {
    console.log('Dry run only. No Supabase writes.')
    return
  }
  if (!args.allowReviewWrites) {
    throw new Error('Live review writes require --allow-review-writes')
  }

  const supabase = supabaseFromEnv()
  const userId = await getCanonicalUserId(supabase)

  let inserted = 0
  let rejectionWrites = 0
  for (const row of approvedRows) {
    const candidate = candidatesByKey.get(row.candidate_key)!
    const { data: existing, error: existingError } = await supabase
      .from('products')
      .select('id')
      .eq('provenance_source_kind', candidate.source_kind)
      .eq('provenance_external_id', candidate.external_id)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing?.id) {
      await supabase
        .from('pantry_import_candidates')
        .update({ decision: 'skipped', applied_product_id: existing.id, updated_at: new Date().toISOString() })
        .eq('candidate_key', candidate.candidate_key)
      continue
    }

    const { data: product, error: insertError } = await supabase
      .from('products')
      .insert(productInsertPayload(row, candidate))
      .select('id, name')
      .single()
    if (insertError) throw insertError

    inserted++
    const sourceRef = `lib:product:${product.id}`
    for (const alias of candidate.aliases) {
      const normalizedAlias = normalizeFoodText(alias)
      if (!normalizedAlias) continue
      const { error: aliasError } = await supabase.from('food_identity_aliases').insert({
        target_type: 'product',
        target_id: product.id,
        target_source_ref: sourceRef,
        alias,
        normalized_alias: normalizedAlias,
        alias_type: 'review_approved',
        confidence: 'medium',
        source: 'pantry_review',
        import_run_id: candidate.import_run_id,
      })
      if (aliasError && !aliasError.message.includes('duplicate')) throw aliasError
    }

    await supabase
      .from('pantry_import_candidates')
      .update({ decision: 'applied', applied_product_id: product.id, updated_at: new Date().toISOString() })
      .eq('candidate_key', candidate.candidate_key)
  }

  for (const row of rejectedRows) {
    const candidate = candidatesByKey.get(row.candidate_key)!
    const phrase = candidate.target_query ?? candidate.display_name
    const normalizedPhrase = normalizeFoodText(phrase)
    const { error } = await supabase.from('food_identity_rejections').insert({
        phrase,
        normalized_phrase: normalizedPhrase,
        rejected_source_ref: rejectionSourceRef(candidate),
        reason: row.notes,
        source: 'pantry_review',
        import_run_id: candidate.import_run_id,
        active: true,
      })
    if (error && !isDuplicateError(error)) throw error
    if (!error) rejectionWrites++
    await supabase
      .from('pantry_import_candidates')
      .update({ decision: 'rejected', updated_at: new Date().toISOString() })
      .eq('candidate_key', candidate.candidate_key)
  }

  if (inserted > 0 || rejectionWrites > 0) await bustResponseCacheForUser(supabase, userId)
  console.log(`Inserted products: ${inserted}`)
  console.log(`Recorded rejections: ${rejectionWrites}`)
  console.log(`Left edit_needed: ${editRows.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
