// Generate a Markdown pantry approval ledger from a Pantry Builder artifact. Read-only.
//
// Usage:
//   npx tsx scripts/generate-pantry-approval-ledger.ts --artifact=scripts/output/pantry-builder-<run-id>.json
//   npx tsx scripts/generate-pantry-approval-ledger.ts --artifact=scripts/output/pantry-builder-<run-id>.json --include-auto
//   npx tsx scripts/generate-pantry-approval-ledger.ts --artifact=scripts/output/pantry-builder-<run-id>.json --output=data/pantry/approvals/<name>.md

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import type { PantryCandidate } from '../lib/pantry-builder/types'

interface Args {
  artifactPath: string | null
  outputPath: string | null
  includeAuto: boolean
}

interface RunArtifact {
  run_id: string
  generated_at: string
  profile_path?: string
  profile?: { name?: string }
  offset?: number
  limit?: number | null
  candidates: PantryCandidate[]
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    artifactPath: null,
    outputPath: null,
    includeAuto: false,
  }

  for (const arg of argv.slice(2)) {
    if (arg === '--include-auto') args.includeAuto = true
    else if (arg.startsWith('--artifact=')) args.artifactPath = arg.slice('--artifact='.length)
    else if (arg.startsWith('--output=')) args.outputPath = arg.slice('--output='.length)
    else throw new Error(`Unknown arg: ${arg}`)
  }

  if (!args.artifactPath) throw new Error('--artifact=<path> is required')
  return args
}

function readArtifact(path: string): RunArtifact {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as RunArtifact
}

function escapeCell(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\|/g, '/')
    .replace(/\r?\n/g, ' ')
    .trim()
}

function defaultDecision(candidate: PantryCandidate) {
  if (candidate.decision === 'auto_approved') return 'approved'
  if (candidate.decision === 'review_required') return 'edit_needed'
  return 'rejected'
}

function defaultNote(candidate: PantryCandidate) {
  const reasons = candidate.reasons.length > 0 ? candidate.reasons.join(', ') : 'no risk reasons'
  if (candidate.decision === 'auto_approved') {
    return `Auto-approved by dry-run; verify before any review apply. ${reasons}.`
  }
  if (candidate.decision === 'review_required') {
    return `Review required: ${reasons}.`
  }
  return `Rejected by dry-run: ${reasons}.`
}

function selectedCandidates(artifact: RunArtifact, includeAuto: boolean) {
  return artifact.candidates
    .filter((candidate) => includeAuto || candidate.decision !== 'auto_approved')
    .sort((a, b) => {
      const order = { review_required: 0, rejected: 1, auto_approved: 2 }
      return order[a.decision] - order[b.decision] || a.target_query.localeCompare(b.target_query)
    })
}

function renderLedger(artifact: RunArtifact, includeAuto: boolean) {
  const rows = selectedCandidates(artifact, includeAuto)
  const lines = [
    `# Pantry Approval Ledger`,
    ``,
    `Run ID: \`${artifact.run_id}\``,
    `Generated From Artifact: ${artifact.generated_at}`,
    `Profile: ${artifact.profile?.name ?? 'unknown'} (${artifact.profile_path ?? 'unknown'})`,
    `Window: offset ${artifact.offset ?? 'unknown'}, limit ${artifact.limit ?? 'unknown'}`,
    ``,
    `This file is for review only. It does not apply rows to Supabase.`,
    ``,
    `| candidate_key | decision | corrected_name | notes |`,
    `| --- | --- | --- | --- |`,
  ]

  for (const candidate of rows) {
    lines.push(
      `| ${escapeCell(candidate.candidate_key)} | ${defaultDecision(candidate)} | ${escapeCell(candidate.display_name)} | ${escapeCell(defaultNote(candidate))} |`,
    )
  }

  lines.push(``)
  lines.push(`## Candidate Detail`)
  lines.push(``)
  for (const candidate of rows) {
    const product = candidate.proposed_product
    lines.push(`### ${candidate.target_query} -> ${candidate.display_name}`)
    lines.push(``)
    lines.push(`- candidate_key: \`${candidate.candidate_key}\``)
    lines.push(`- dry_run_decision: ${candidate.decision}`)
    lines.push(`- source: ${candidate.source_kind} / ${candidate.source_dataset ?? 'unknown'} / ${candidate.external_id ?? 'n/a'}`)
    lines.push(`- macros: ${product.calories_per_serving} cal, ${product.protein_g_per_serving}P, ${product.carbs_g_per_serving}C, ${product.fat_g_per_serving}F`)
    lines.push(`- units: ${candidate.unit_alternatives.slice(0, 8).map((unit) => `${unit.unit}=${unit.grams}g`).join(', ') || 'none'}`)
    lines.push(`- aliases: ${candidate.aliases.join(', ') || 'none'}`)
    lines.push(`- reasons: ${candidate.reasons.join(', ') || 'none'}`)
    lines.push(``)
  }

  return `${lines.join('\n').trimEnd()}\n`
}

function defaultOutputPath(artifact: RunArtifact) {
  return `data/pantry/approvals/pantry-approval-${artifact.run_id}.md`
}

function main() {
  const args = parseArgs(process.argv)
  const artifact = readArtifact(args.artifactPath!)
  const outputPath = resolve(args.outputPath ?? defaultOutputPath(artifact))
  const outputDir = dirname(outputPath)
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

  writeFileSync(outputPath, renderLedger(artifact, args.includeAuto))
  console.log(`Wrote ${outputPath}`)
  console.log(`Rows: ${selectedCandidates(artifact, args.includeAuto).length}`)
}

main()
