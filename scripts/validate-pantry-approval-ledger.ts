// Validate a Markdown pantry approval ledger. Read-only.
//
// Usage:
//   npx tsx scripts/validate-pantry-approval-ledger.ts data/pantry/approvals/example.md

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DECISIONS = new Set(['approved', 'rejected', 'edit_needed'])
const REQUIRED_HEADERS = ['candidate_key', 'decision', 'corrected_name', 'notes']

interface LedgerRow {
  line: number
  candidate_key: string
  decision: string
  corrected_name: string
  notes: string
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
      rows.push({
        line: rowIndex + 1,
        candidate_key: rowCells[0],
        decision: rowCells[1],
        corrected_name: rowCells[2],
        notes: rowCells[3],
      })
    }
  }

  return rows
}

function validateRows(rows: LedgerRow[]) {
  if (rows.length === 0) throw new Error('No approval rows found')

  const seen = new Set<string>()
  const counts: Record<string, number> = {}
  const errors: string[] = []

  for (const row of rows) {
    if (!row.candidate_key) errors.push(`Line ${row.line}: candidate_key is required`)
    if (seen.has(row.candidate_key)) errors.push(`Line ${row.line}: duplicate candidate_key ${row.candidate_key}`)
    seen.add(row.candidate_key)

    if (!DECISIONS.has(row.decision)) {
      errors.push(`Line ${row.line}: decision must be one of ${[...DECISIONS].join(', ')}`)
    }
    if ((row.decision === 'rejected' || row.decision === 'edit_needed') && !row.notes) {
      errors.push(`Line ${row.line}: notes are required for ${row.decision}`)
    }
    counts[row.decision] = (counts[row.decision] ?? 0) + 1
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }

  return counts
}

function main() {
  const path = process.argv[2]
  if (!path) throw new Error('Usage: npx tsx scripts/validate-pantry-approval-ledger.ts <ledger.md>')
  const rows = parseLedger(path)
  const counts = validateRows(rows)
  console.log(`Pantry approval ledger: ok`)
  console.log(`rows: ${rows.length}`)
  console.log(`counts: ${Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(', ')}`)
}

main()
