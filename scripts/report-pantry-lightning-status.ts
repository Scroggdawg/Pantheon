// Read-only status dashboard for Pantry Lightning.
//
// Usage:
//   npx tsx scripts/report-pantry-lightning-status.ts

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import type { PantryCandidate } from '../lib/pantry-builder/types'

interface RunArtifact {
  run_id: string
  generated_at: string
  profile_path?: string
  profile?: { name?: string }
  offset?: number
  limit?: number | null
  candidates: PantryCandidate[]
  counts: Record<string, number>
}

type LiveStatus =
  | {
      gateOpen: true
      counts: Record<string, number | null>
      latestApply: {
        id: string
        status: string
        candidate_counts: unknown
        finished_at: string | null
      } | null
      countWarning?: string
    }
  | {
      gateOpen: false
      reason: string
    }

function listFiles(dirArg: string, pattern: RegExp) {
  const dir = resolve(dirArg)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((file) => pattern.test(file))
    .map((file) => join(dir, file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
}

function readArtifact(path: string): RunArtifact {
  return JSON.parse(readFileSync(path, 'utf8')) as RunArtifact
}

function suspiciousAutoApproved(candidate: PantryCandidate): string[] {
  const reasons: string[] = []
  if (candidate.source_kind !== 'usda') reasons.push(`source_kind=${candidate.source_kind}`)
  if (candidate.proposed_product.brand) reasons.push(`brand=${candidate.proposed_product.brand}`)
  if (candidate.risk_score > 0) reasons.push(`risk_score=${candidate.risk_score}`)
  if (candidate.reasons.length > 0) reasons.push(`reasons=${candidate.reasons.join('|')}`)
  if (candidate.unit_alternatives.length === 0) reasons.push('no_unit_alternatives')
  if (!candidate.external_id) reasons.push('missing_external_id')
  return reasons
}

function parseLedgerCounts(path: string) {
  const text = readFileSync(path, 'utf8')
  const counts: Record<string, number> = {}
  for (const line of text.split('\n')) {
    if (!line.trim().startsWith('|')) continue
    const cells = line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim())
    if (cells[0] === 'candidate_key') continue
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue
    const decision = cells[1]
    if (!decision || decision === 'decision') continue
    counts[decision] = (counts[decision] ?? 0) + 1
  }
  return counts
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

async function getLiveStatus(): Promise<LiveStatus> {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { gateOpen: false, reason: 'missing Supabase env vars' }

  const supabase = createClient(url, key)
  const requiredProductColumns = [
    'provenance_source_kind',
    'provenance_dataset',
    'provenance_external_id',
    'provenance_release',
    'provenance_import_run_id',
    'import_confidence',
    'canonical_category',
  ]

  for (const column of requiredProductColumns) {
    const { error } = await supabase.from('products').select(`id,${column}`).limit(1)
    if (error) return { gateOpen: false, reason: `products.${column}: ${error.message}` }
  }

  const counts: Record<string, number | null> = {}
  for (const table of ['products', 'pantry_import_runs', 'pantry_import_candidates', 'food_identity_aliases', 'food_identity_rejections']) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) return { gateOpen: true, counts, latestApply: null, countWarning: `${table}: ${error.message}` }
    counts[table] = count ?? null
  }

  const { count: pantryImportedProducts, error: importedError } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .not('provenance_import_run_id', 'is', null)
  if (importedError) {
    return { gateOpen: true, counts, latestApply: null, countWarning: `products provenance count: ${importedError.message}` }
  }
  counts.pantry_imported_products = pantryImportedProducts ?? null

  const { data: latestApply, error: latestApplyError } = await supabase
    .from('pantry_import_runs')
    .select('id,status,candidate_counts,finished_at')
    .eq('mode', 'apply')
    .order('finished_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (latestApplyError) {
    return { gateOpen: true, counts, latestApply: null, countWarning: `latest apply run: ${latestApplyError.message}` }
  }

  return { gateOpen: true, counts, latestApply }
}

async function main() {
  const artifacts = listFiles('scripts/output', /^pantry-builder-.*\.json$/).map((path) => ({
    path,
    artifact: readArtifact(path),
  }))
  const ledgers = listFiles('data/pantry/approvals', /\.md$/)
  const liveStatus = await getLiveStatus()

  console.log('Pantry Lightning Status')
  console.log('')
  console.log('Live apply gate:')
  if (liveStatus.gateOpen) {
    console.log('- open: governance schema verified')
    console.log(`- products: ${liveStatus.counts.products}`)
    console.log(`- pantry-imported products: ${liveStatus.counts.pantry_imported_products}`)
    console.log(`- pantry import runs: ${liveStatus.counts.pantry_import_runs}`)
    console.log(`- pantry import candidates: ${liveStatus.counts.pantry_import_candidates}`)
    if (liveStatus.latestApply) {
      console.log(
        `- latest apply: ${liveStatus.latestApply.id} status=${liveStatus.latestApply.status} ` +
          `finished_at=${liveStatus.latestApply.finished_at ?? 'n/a'}`,
      )
    }
  } else {
    console.log(`- blocked: ${liveStatus.reason}`)
    console.log('- command: npx tsx scripts/verify-pantry-governance.ts')
    console.log('- command: supabase migration list')
  }

  console.log('')
  console.log(`Dry-run artifacts: ${artifacts.length}`)
  for (const { path, artifact } of artifacts.slice(0, 10)) {
    const autoApproved = artifact.candidates.filter((candidate) => candidate.decision === 'auto_approved')
    const suspicious = autoApproved.filter((candidate) => suspiciousAutoApproved(candidate).length > 0)
    console.log(
      `- ${artifact.profile?.name ?? 'unknown'} offset=${artifact.offset ?? 'unknown'} limit=${artifact.limit ?? 'unknown'} ` +
        `run=${artifact.run_id} total=${artifact.counts.total ?? artifact.candidates.length} ` +
        `auto=${artifact.counts.auto_approved ?? 0} review=${artifact.counts.review_required ?? 0} ` +
        `rejected=${artifact.counts.rejected ?? 0} suspicious_auto=${suspicious.length} file=${path}`,
    )
  }
  if (artifacts.length > 10) console.log(`- ... ${artifacts.length - 10} more`)

  console.log('')
  console.log(`Approval ledgers: ${ledgers.length}`)
  for (const path of ledgers) {
    const counts = parseLedgerCounts(path)
    console.log(`- ${path}: ${Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(', ') || 'no rows'}`)
  }

  console.log('')
  console.log('Next executable gate:')
  if (liveStatus.gateOpen) {
    console.log('1. Review the previous apply counts and regression checks.')
    console.log('2. Dry-run or apply the next conservative artifact with --max-insert=25.')
    console.log('3. Stop before raising the cap or writing review-only branded/restaurant rows.')
  } else {
    console.log('1. Luke runs supabase login.')
    console.log('2. Verify/apply migration 021.')
    console.log('3. Apply the first core USDA artifact with --max-insert=25 if schema verifier passes.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
