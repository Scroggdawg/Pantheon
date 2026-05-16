// Read-only status dashboard for Pantry Lightning.
//
// Usage:
//   npx tsx scripts/report-pantry-lightning-status.ts

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

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

function main() {
  const artifacts = listFiles('scripts/output', /^pantry-builder-.*\.json$/).map((path) => ({
    path,
    artifact: readArtifact(path),
  }))
  const ledgers = listFiles('data/pantry/approvals', /\.md$/)

  console.log('Pantry Lightning Status')
  console.log('')
  console.log('Live apply gate:')
  console.log('- blocked until Supabase CLI auth and products provenance columns verify')
  console.log('- command: npx tsx scripts/verify-pantry-governance.ts')
  console.log('- command: supabase migration list')

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
  console.log('1. Luke runs supabase login.')
  console.log('2. Verify/apply migration 021.')
  console.log('3. Apply the first core USDA artifact with --max-insert=25 if schema verifier passes.')
}

main()
