// Regression checks for generated smart pantry review packets.
//
// This test is intentionally file-based: it verifies the current generated
// packets remain safe to hand to Luke and safe to pass through the guarded
// review planner/apply dry-run path.
//
// Usage:
//   npx tsx scripts/test-smart-pantry-review-packets.ts

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PACKET_DIR = 'data/pantry/approvals/smart-review-2026-05-16'
const REQUIRED_FILES = [
  '00_INDEX.md',
  '01_quick_reject.md',
  '02_quick_approve_usda.md',
  '03_brands_restaurants.md',
  '04_manual_needed.md',
]
const REQUIRED_HEADERS = ['candidate_key', 'decision', 'corrected_name', 'notes']
const DECISIONS = new Set(['approved', 'rejected', 'edit_needed'])

interface LedgerRow {
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
  const lines = readFileSync(path, 'utf8').split('\n')
  const rows: LedgerRow[] = []

  for (let index = 0; index < lines.length; index++) {
    const cells = parseTableCells(lines[index])
    if (cells.join('|') !== REQUIRED_HEADERS.join('|')) continue

    const separator = parseTableCells(lines[index + 1] ?? '')
    if (!isSeparator(separator)) throw new Error(`${path}: approval table header must be followed by a separator`)

    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex++) {
      const line = lines[rowIndex]
      if (!line.trim().startsWith('|')) break
      const rowCells = parseTableCells(line)
      if (rowCells.length !== REQUIRED_HEADERS.length) {
        throw new Error(`${path}: expected ${REQUIRED_HEADERS.length} cells at line ${rowIndex + 1}`)
      }
      rows.push({
        candidate_key: rowCells[0],
        decision: rowCells[1],
        corrected_name: rowCells[2],
        notes: rowCells[3],
      })
    }
  }

  if (rows.length === 0) throw new Error(`${path}: no ledger rows found`)
  return rows
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function main() {
  for (const file of REQUIRED_FILES) {
    const path = join(PACKET_DIR, file)
    assert(existsSync(path), `missing packet file: ${path}`)
  }

  const quickReject = parseLedger(join(PACKET_DIR, '01_quick_reject.md'))
  const quickApprove = parseLedger(join(PACKET_DIR, '02_quick_approve_usda.md'))
  const brandsRestaurants = parseLedger(join(PACKET_DIR, '03_brands_restaurants.md'))
  const manualNeeded = parseLedger(join(PACKET_DIR, '04_manual_needed.md'))
  const allRows = [...quickReject, ...quickApprove, ...brandsRestaurants, ...manualNeeded]
  const keys = new Set<string>()

  for (const row of allRows) {
    assert(row.candidate_key.length > 0, 'candidate_key is required')
    assert(!keys.has(row.candidate_key), `duplicate candidate_key across packets: ${row.candidate_key}`)
    keys.add(row.candidate_key)
    assert(DECISIONS.has(row.decision), `invalid decision for ${row.candidate_key}: ${row.decision}`)
    assert(row.corrected_name.length > 0, `corrected_name is required for ${row.candidate_key}`)
    assert(row.notes.length > 0, `notes are required for ${row.candidate_key}`)
  }

  assert(quickReject.every((row) => row.decision === 'rejected'), 'quick reject packet must only contain rejected rows')
  assert(
    quickApprove.every((row) => row.decision === 'edit_needed'),
    'quick approve packet must remain edit_needed until Luke flips rows to approved',
  )
  assert(
    quickApprove.every((row) => row.notes.includes('RECOMMEND_APPROVE_AFTER_EYEBALL')),
    'quick approve rows must carry an explicit recommendation note',
  )
  assert(
    brandsRestaurants.every((row) => row.decision === 'edit_needed'),
    'brands/restaurants packet must not pre-approve protected rows',
  )
  assert(manualNeeded.every((row) => row.decision === 'edit_needed'), 'manual-needed packet must remain edit_needed')

  console.log('test-smart-pantry-review-packets: ok')
  console.log(`rows: ${allRows.length}`)
  console.log(`quick_reject: ${quickReject.length}`)
  console.log(`quick_approve_usda: ${quickApprove.length}`)
  console.log(`brands_restaurants: ${brandsRestaurants.length}`)
  console.log(`manual_needed: ${manualNeeded.length}`)
}

main()
