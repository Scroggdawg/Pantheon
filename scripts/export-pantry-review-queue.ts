// Export live Pantry Builder review candidates from Supabase into a Markdown approval packet.
//
// Read-only. This does not apply products, aliases, or rejections.
//
// Usage:
//   npx tsx scripts/export-pantry-review-queue.ts
//   npx tsx scripts/export-pantry-review-queue.ts --limit=100 --include-rejected
//   npx tsx scripts/export-pantry-review-queue.ts --category=prepared_common --output=data/pantry/approvals/live-review.md

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import type { PantryCandidate, PantryCategory, PantryDecision, PantryProductPayload, PantrySourceKind } from '../lib/pantry-builder/types'

type CandidateDecision = PantryDecision | 'applied' | 'skipped' | 'failed'

interface Args {
  category: PantryCategory | null
  includeRejected: boolean
  limit: number
  outputPath: string | null
}

interface CandidateRow {
  candidate_key: string
  target_query: string | null
  normalized_name: string
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
  decision: CandidateDecision
  reasons: string[]
  import_run_id: string | null
  updated_at: string
}

const VALID_CATEGORIES = new Set<PantryCategory>([
  'whole_foods',
  'proteins',
  'cuisine_staples',
  'sauces_condiments_oils',
  'breakfast_snacks',
  'beverages',
  'prepared_common',
  'coverage_buffer',
])

function parseArgs(argv: string[]): Args {
  const args: Args = {
    category: null,
    includeRejected: false,
    limit: 150,
    outputPath: null,
  }

  for (const arg of argv.slice(2)) {
    if (arg === '--include-rejected') args.includeRejected = true
    else if (arg.startsWith('--category=')) {
      const category = arg.slice('--category='.length) as PantryCategory
      if (!VALID_CATEGORIES.has(category)) throw new Error(`Unknown category: ${category}`)
      args.category = category
    } else if (arg.startsWith('--limit=')) {
      args.limit = Number(arg.slice('--limit='.length))
    } else if (arg.startsWith('--output=')) {
      args.outputPath = arg.slice('--output='.length)
    } else {
      throw new Error(`Unknown arg: ${arg}`)
    }
  }

  if (!Number.isInteger(args.limit) || args.limit < 1) throw new Error('--limit must be a positive integer')
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

function escapeCell(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/\|/g, '/')
    .replace(/\r?\n/g, ' ')
    .trim()
}

function formatMacros(product: PantryProductPayload) {
  return `${product.calories_per_serving} cal, ${product.protein_g_per_serving}P, ${product.carbs_g_per_serving}C, ${product.fat_g_per_serving}F`
}

function defaultReviewDecision(row: CandidateRow) {
  if (row.decision === 'rejected') return 'rejected'
  return 'edit_needed'
}

function defaultNote(row: CandidateRow) {
  const reasons = row.reasons.length > 0 ? row.reasons.join(', ') : 'no risk reasons'
  if (row.decision === 'rejected') return `Rejected by risk engine: ${reasons}.`
  return `Review required: ${reasons}.`
}

function groupedRows(rows: CandidateRow[]) {
  const groups = new Map<PantryCategory, CandidateRow[]>()
  for (const row of rows) {
    const existing = groups.get(row.category) ?? []
    existing.push(row)
    groups.set(row.category, existing)
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

function renderMarkdown(rows: CandidateRow[], args: Args) {
  const decisionCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.decision] = (acc[row.decision] ?? 0) + 1
    return acc
  }, {})
  const categoryCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + 1
    return acc
  }, {})

  const lines = [
    '# Live Pantry Review Queue',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Source: Supabase pantry_import_candidates`,
    `Filter: decision=review_required${args.includeRejected ? ' + rejected' : ''}${args.category ? `, category=${args.category}` : ''}`,
    `Rows: ${rows.length}`,
    '',
    'This file is for review only. It does not apply rows to Supabase.',
    '',
    'Allowed decisions in the table below:',
    '- `approved`: candidate is acceptable for a future explicit review apply.',
    '- `edit_needed`: candidate needs correction or richer source data before apply.',
    '- `rejected`: candidate should become a remembered bad match.',
    '',
    '## Counts',
    '',
    ...Object.entries(decisionCounts).map(([key, value]) => `- decision ${key}: ${value}`),
    ...Object.entries(categoryCounts).map(([key, value]) => `- category ${key}: ${value}`),
    '',
    '## Approval Table',
    '',
    '| candidate_key | decision | corrected_name | notes |',
    '| --- | --- | --- | --- |',
  ]

  for (const row of rows) {
    lines.push(
      `| ${escapeCell(row.candidate_key)} | ${defaultReviewDecision(row)} | ${escapeCell(row.display_name)} | ${escapeCell(defaultNote(row))} |`,
    )
  }

  lines.push('', '## Candidate Detail', '')

  for (const [category, categoryRows] of groupedRows(rows)) {
    lines.push(`## ${category}`, '')
    for (const row of categoryRows) {
      const product = row.proposed_product
      lines.push(`### ${row.target_query ?? 'unknown target'} -> ${row.display_name}`)
      lines.push('')
      lines.push(`- candidate_key: \`${row.candidate_key}\``)
      lines.push(`- decision: ${row.decision}`)
      lines.push(`- run: ${row.import_run_id ?? 'n/a'}`)
      lines.push(`- source: ${row.source_kind} / ${row.source_dataset ?? 'unknown'} / ${row.external_id ?? 'n/a'}`)
      lines.push(`- macros: ${formatMacros(product)}`)
      lines.push(`- units: ${row.unit_alternatives.slice(0, 8).map((unit) => `${unit.unit}=${unit.grams}g`).join(', ') || 'none'}`)
      lines.push(`- aliases: ${row.aliases.join(', ') || 'none'}`)
      lines.push(`- rejected_aliases: ${row.rejected_aliases.join(', ') || 'none'}`)
      lines.push(`- risk: ${row.risk_score}`)
      lines.push(`- reasons: ${row.reasons.join(', ') || 'none'}`)
      lines.push(`- updated_at: ${row.updated_at}`)
      lines.push('')
    }
  }

  return `${lines.join('\n').trimEnd()}\n`
}

function defaultOutputPath() {
  return `data/pantry/approvals/live-review-${new Date().toISOString().slice(0, 10)}.md`
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv)
  const supabase = supabaseFromEnv()

  const decisions = args.includeRejected ? ['review_required', 'rejected'] : ['review_required']
  let query = supabase
    .from('pantry_import_candidates')
    .select(
      'candidate_key,target_query,normalized_name,display_name,source_kind,source_dataset,external_id,source_release,category,proposed_product,aliases,rejected_aliases,unit_alternatives,risk_score,decision,reasons,import_run_id,updated_at',
    )
    .in('decision', decisions)
    .order('category', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(args.limit)

  if (args.category) query = query.eq('category', args.category)

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as CandidateRow[]
  const outputPath = resolve(args.outputPath ?? defaultOutputPath())
  const outputDir = dirname(outputPath)
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

  writeFileSync(outputPath, renderMarkdown(rows, args))
  console.log(`Wrote ${outputPath}`)
  console.log(`Rows: ${rows.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
