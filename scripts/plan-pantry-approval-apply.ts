// Plan a future pantry approval apply from a ledger + artifact. Read-only.
//
// Usage:
//   npx tsx scripts/plan-pantry-approval-apply.ts \
//     --artifact=scripts/output/pantry-builder-<run-id>.json \
//     --ledger=data/pantry/approvals/<ledger>.md

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { PantryCandidate } from '../lib/pantry-builder/types'

const DECISIONS = new Set(['approved', 'rejected', 'edit_needed'])
const REQUIRED_HEADERS = ['candidate_key', 'decision', 'corrected_name', 'notes']

interface Args {
  artifactPath: string | null
  ledgerPath: string | null
}

interface RunArtifact {
  run_id: string
  generated_at: string
  candidates: PantryCandidate[]
}

interface LedgerRow {
  line: number
  candidate_key: string
  decision: 'approved' | 'rejected' | 'edit_needed'
  corrected_name: string
  notes: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    artifactPath: null,
    ledgerPath: null,
  }

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--artifact=')) args.artifactPath = arg.slice('--artifact='.length)
    else if (arg.startsWith('--ledger=')) args.ledgerPath = arg.slice('--ledger='.length)
    else throw new Error(`Unknown arg: ${arg}`)
  }

  if (!args.artifactPath) throw new Error('--artifact=<path> is required')
  if (!args.ledgerPath) throw new Error('--ledger=<path> is required')
  return args
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

function readArtifact(path: string): RunArtifact {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as RunArtifact
}

function planAction(row: LedgerRow, candidate: PantryCandidate) {
  if (row.decision === 'rejected') {
    return {
      type: 'record_rejection',
      candidate_key: row.candidate_key,
      target_query: candidate.target_query,
      display_name: candidate.display_name,
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
    type: 'would_insert_product',
    candidate_key: row.candidate_key,
    target_query: candidate.target_query,
    display_name: row.corrected_name || candidate.display_name,
    source: `${candidate.source_kind}/${candidate.source_dataset ?? 'unknown'}/${candidate.external_id ?? 'n/a'}`,
    units: candidate.unit_alternatives.length,
    aliases: candidate.aliases.length,
    protected_source: candidate.source_kind !== 'usda' || candidate.decision !== 'auto_approved',
  }
}

function main() {
  const args = parseArgs(process.argv)
  const artifact = readArtifact(args.artifactPath!)
  const rows = parseLedger(args.ledgerPath!)
  const candidatesByKey = new Map(artifact.candidates.map((candidate) => [candidate.candidate_key, candidate]))
  const missing = rows.filter((row) => !candidatesByKey.has(row.candidate_key))
  if (missing.length > 0) {
    throw new Error(`Ledger references candidate keys missing from artifact:\n${missing.map((row) => `line ${row.line}: ${row.candidate_key}`).join('\n')}`)
  }

  const actions = rows.map((row) => planAction(row, candidatesByKey.get(row.candidate_key)!))
  const counts = actions.reduce<Record<string, number>>((acc, action) => {
    acc[action.type] = (acc[action.type] ?? 0) + 1
    return acc
  }, {})
  const protectedWrites = actions.filter((action) => action.type === 'would_insert_product' && action.protected_source)

  console.log(`Pantry approval apply plan`)
  console.log(`artifact_run_id: ${artifact.run_id}`)
  console.log(`artifact_generated_at: ${artifact.generated_at}`)
  console.log(`ledger_rows: ${rows.length}`)
  console.log(`counts: ${Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(', ')}`)
  console.log(`protected_writes: ${protectedWrites.length}`)

  console.log(`\nActions`)
  for (const action of actions) {
    console.log(JSON.stringify(action))
  }

  if (protectedWrites.length > 0) {
    console.log(`\nNOTE: protected writes require explicit Luke approval before any future apply script may execute them.`)
  }
}

main()
