// Read-only Pantry Builder artifact summarizer.
//
// Usage:
//   npx tsx scripts/summarize-pantry-runs.ts
//   npx tsx scripts/summarize-pantry-runs.ts --dir=scripts/output --limit=3
//   npx tsx scripts/summarize-pantry-runs.ts scripts/output/pantry-builder-<run-id>.json

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

import type { PantryCandidate, PantryDecision, PantryProfile, PantryTarget } from '../lib/pantry-builder/types'

interface Args {
  artifactPaths: string[]
  dir: string
  limit: number | null
  showRejected: boolean
}

interface RunArtifact {
  run_id: string
  generated_at: string
  profile_version: number
  source_release: string
  profile_path?: string
  mode: 'dry_run'
  offset?: number
  limit?: number | null
  profile?: PantryProfile
  targets: PantryTarget[]
  candidates: PantryCandidate[]
  counts: Record<string, number>
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    artifactPaths: [],
    dir: 'scripts/output',
    limit: null,
    showRejected: false,
  }

  for (const arg of argv.slice(2)) {
    if (arg === '--show-rejected') args.showRejected = true
    else if (arg.startsWith('--dir=')) args.dir = arg.slice('--dir='.length)
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length))
    else if (arg.startsWith('-')) throw new Error(`Unknown arg: ${arg}`)
    else args.artifactPaths.push(arg)
  }

  if (args.limit != null && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error('--limit must be a positive integer')
  }
  return args
}

function discoverArtifacts(args: Args): string[] {
  if (args.artifactPaths.length > 0) return args.artifactPaths.map((path) => resolve(path))

  const dir = resolve(args.dir)
  if (!existsSync(dir)) return []

  const files = readdirSync(dir)
    .filter((file) => /^pantry-builder-.*\.json$/.test(file))
    .map((file) => join(dir, file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)

  return args.limit == null ? files : files.slice(0, args.limit)
}

function readArtifact(path: string): RunArtifact {
  return JSON.parse(readFileSync(path, 'utf8')) as RunArtifact
}

function groupByReason(candidates: PantryCandidate[]) {
  const groups = new Map<string, PantryCandidate[]>()
  for (const candidate of candidates) {
    const reasons = candidate.reasons.length > 0 ? candidate.reasons : ['none']
    for (const reason of reasons) {
      const existing = groups.get(reason) ?? []
      existing.push(candidate)
      groups.set(reason, existing)
    }
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
}

function candidatesByDecision(artifact: RunArtifact, decision: PantryDecision) {
  return artifact.candidates.filter((candidate) => candidate.decision === decision)
}

function suspiciousAutoApproved(candidate: PantryCandidate): string[] {
  const reasons: string[] = []
  if (candidate.source_kind !== 'usda') reasons.push(`source_kind=${candidate.source_kind}`)
  if (candidate.proposed_product.provenance_source_kind !== 'usda') {
    reasons.push(`product_source=${candidate.proposed_product.provenance_source_kind}`)
  }
  if (candidate.proposed_product.brand) reasons.push(`brand=${candidate.proposed_product.brand}`)
  if (candidate.risk_score > 0) reasons.push(`risk_score=${candidate.risk_score}`)
  if (candidate.reasons.length > 0) reasons.push(`reasons=${candidate.reasons.join('|')}`)
  if (candidate.unit_alternatives.length === 0) reasons.push('no_unit_alternatives')
  if (!candidate.external_id) reasons.push('missing_external_id')
  return reasons
}

function formatCandidate(candidate: PantryCandidate) {
  const product = candidate.proposed_product
  const macros = `${product.calories_per_serving} cal, ${product.protein_g_per_serving}P/${product.carbs_g_per_serving}C/${product.fat_g_per_serving}F`
  const units = candidate.unit_alternatives
    .slice(0, 5)
    .map((unit) => `${unit.unit}=${unit.grams}g`)
    .join(', ')
  const reasons = candidate.reasons.length > 0 ? ` [${candidate.reasons.join(', ')}]` : ''
  return `- ${candidate.target_query} -> ${candidate.display_name} (${candidate.source_dataset ?? 'unknown'} ${candidate.external_id ?? 'n/a'}; ${macros}; units: ${units || 'none'})${reasons}`
}

function printArtifact(path: string, artifact: RunArtifact, showRejected: boolean) {
  const autoApproved = candidatesByDecision(artifact, 'auto_approved')
  const reviewRequired = candidatesByDecision(artifact, 'review_required')
  const rejected = candidatesByDecision(artifact, 'rejected')
  const suspicious = autoApproved
    .map((candidate) => ({ candidate, reasons: suspiciousAutoApproved(candidate) }))
    .filter((entry) => entry.reasons.length > 0)

  console.log(`\n# ${basename(path)}`)
  console.log(`run_id: ${artifact.run_id}`)
  console.log(`generated_at: ${artifact.generated_at}`)
  console.log(`profile: ${artifact.profile?.name ?? 'unknown'} (${artifact.profile_path ?? 'unknown'})`)
  console.log(`window: offset ${artifact.offset ?? 'unknown'}, limit ${artifact.limit ?? 'unknown'}`)
  console.log(`source_release: ${artifact.source_release}`)
  console.log(`counts: ${Object.entries(artifact.counts).map(([key, value]) => `${key}=${value}`).join(', ')}`)

  console.log(`\nAuto-approved (${autoApproved.length})`)
  if (autoApproved.length === 0) console.log('- none')
  for (const candidate of autoApproved) console.log(formatCandidate(candidate))

  console.log(`\nSuspicious auto-approved (${suspicious.length})`)
  if (suspicious.length === 0) console.log('- none')
  for (const entry of suspicious) {
    console.log(`- ${entry.candidate.target_query} -> ${entry.candidate.display_name}: ${entry.reasons.join(', ')}`)
  }

  console.log(`\nReview-required by reason (${reviewRequired.length})`)
  if (reviewRequired.length === 0) console.log('- none')
  for (const [reason, candidates] of groupByReason(reviewRequired)) {
    console.log(`- ${reason}: ${candidates.length}`)
    for (const candidate of candidates.slice(0, 8)) {
      console.log(`  - ${candidate.target_query} -> ${candidate.display_name}`)
    }
    if (candidates.length > 8) console.log(`  - ... ${candidates.length - 8} more`)
  }

  console.log(`\nRejected by reason (${rejected.length})`)
  if (rejected.length === 0) console.log('- none')
  for (const [reason, candidates] of groupByReason(rejected)) {
    console.log(`- ${reason}: ${candidates.length}`)
    if (showRejected) {
      for (const candidate of candidates.slice(0, 12)) {
        console.log(`  - ${candidate.target_query} -> ${candidate.display_name}`)
      }
      if (candidates.length > 12) console.log(`  - ... ${candidates.length - 12} more`)
    }
  }
}

function main() {
  const args = parseArgs(process.argv)
  const paths = discoverArtifacts(args)
  if (paths.length === 0) {
    console.log(`No pantry builder artifacts found in ${resolve(args.dir)}`)
    return
  }

  for (const path of paths) {
    printArtifact(path, readArtifact(path), args.showRejected)
  }
}

main()
