// Export a plain-English pantry review worksheet.
//
// Read-only. This does not apply products, aliases, rejections, or candidate
// decisions. The first table remains compatible with the approval ledger
// validator, but the surrounding text is written for Luke: identity first,
// macros second.
//
// Usage:
//   npx tsx scripts/export-plain-pantry-review-packet.ts
//   npx tsx scripts/export-plain-pantry-review-packet.ts --limit=120 --output=data/pantry/approvals/plain-review-YYYY-MM-DD.md

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import type {
  PantryCandidate,
  PantryCategory,
  PantryDecision,
  PantryProductPayload,
  PantrySourceKind,
} from '../lib/pantry-builder/types'

type CandidateDecision = PantryDecision | 'applied' | 'skipped' | 'failed'
type ReviewLane = 'obvious-no' | 'already-covered' | 'probably-yes' | 'needs-choice' | 'manual-source'

interface Args {
  limit: number
  output: string | null
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

interface PlainRow {
  row: CandidateRow
  lane: ReviewLane
  defaultDecision: 'approved' | 'rejected' | 'edit_needed'
  plainCall: string
  plainReason: string
  action: string
  sortScore: number
}

const LANE_TITLES: Record<ReviewLane, string> = {
  'obvious-no': 'Obvious No',
  'already-covered': 'Already Covered',
  'probably-yes': 'Probably Yes',
  'needs-choice': 'Needs Your Choice',
  'manual-source': 'Needs Better Source',
}

const BRAND_OR_RESTAURANT_TERMS = [
  'chipotle',
  'mcdonald',
  'olive garden',
  'carrabba',
  'cracker barrel',
  'taco bell',
  'rebbl',
  'yasso',
  'magic spoon',
  'silk',
  'kashi',
  'cracklin',
  'harmless harvest',
  'taste nirvana',
  'goya',
  'dos equis',
  'dos xx',
]

const REVIEW_ONLY_TERMS = [
  ...BRAND_OR_RESTAURANT_TERMS,
  'margarita',
  'beer',
  'cocktail',
  'protein shake',
  'protein powder',
]

const COMPOSITE_TERMS = [
  'bowl',
  'sandwich',
  'burrito',
  'pizza',
  'lasagna',
  'meatball',
  'soup',
  'sauce',
  'with ',
]

const IDENTITY_COMPATIBLE_OVERRIDES = [
  ['cilantro', 'coriander (cilantro) leaves'],
  ['bbq ribs', 'beef, rib, back ribs'],
  ['jalapeno', 'peppers, jalapeno'],
  ['oregano', 'spices, oregano'],
  ['sriracha', 'sauce, hot chile, sriracha'],
]

const IDENTITY_MISMATCH_OVERRIDES = [
  ['apple', 'fruit butters'],
  ['cracklin oat bran', 'oat bran, raw'],
  ['mint', 'mint julep'],
  ['tom kha soup', 'tom collins'],
  ['granola', 'granola bars'],
  ['nuoc cham', 'willow'],
  ['bbq plate', 'cracker barrel'],
  ['lemongrass', 'smart soup'],
]

function parseArgs(argv: string[]): Args {
  const args: Args = {
    limit: 120,
    output: null,
  }

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length))
    else if (arg.startsWith('--output=')) args.output = arg.slice('--output='.length)
    else throw new Error(`Unknown arg: ${arg}`)
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

function defaultOutputPath() {
  return `data/pantry/approvals/plain-review-${new Date().toISOString().slice(0, 10)}.md`
}

function escapeCell(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/\|/g, '/')
    .replace(/\r?\n/g, ' ')
    .trim()
}

function normalizedText(row: CandidateRow) {
  return `${row.target_query ?? ''} ${row.display_name} ${row.proposed_product.brand ?? ''}`.toLowerCase()
}

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term))
}

function hasReason(row: CandidateRow, pattern: string) {
  return row.reasons.some((reason) => reason.includes(pattern))
}

function targetIncludes(row: CandidateRow, value: string) {
  return (row.target_query ?? row.normalized_name).toLowerCase().includes(value)
}

function displayIncludes(row: CandidateRow, value: string) {
  return row.display_name.toLowerCase().includes(value)
}

function matchesOverride(row: CandidateRow, overrides: string[][]) {
  return overrides.some(([target, display]) => targetIncludes(row, target) && displayIncludes(row, display))
}

function reasonLabel(reason: string) {
  if (reason.includes('duplicate_existing_product')) return 'Pantheon already has something close. Do not add another pantry row just because this candidate is compatible.'
  if (reason.includes('macro_sanity_failed')) return 'The calories or macros look physically suspicious.'
  if (reason.includes('low_target_token_coverage_0')) return 'The database result does not contain the words you actually said.'
  if (reason.includes('low_target_token_coverage')) return 'Only part of what you said matched this food.'
  if (reason.includes('context_token_missing')) return 'An important word from your phrase is missing from the match.'
  if (reason.includes('single_token_secondary_match_review_required')) return 'The phrase is too broad, so the second-best match might be a trap.'
  if (reason.includes('state_modifier_mismatch')) return 'The state is different: cooked/raw/dried/peeled/canned/frozen/etc.'
  if (reason.includes('profile_review_only')) return 'This touches a Luke-specific preference and should not be auto-written.'
  if (reason.includes('luke_overlay_review_required')) return 'This is in Luke-preference territory, so it needs a human look.'
  if (reason.includes('generic_mushroom_subtype_review_required')) return 'This is a specific mushroom subtype, not just generic mushrooms.'
  if (reason.includes('brand')) return 'This is brand-like, so it needs a human source check.'
  if (reason.includes('restaurant')) return 'This is restaurant-like, so it needs a human source check.'
  if (reason.includes('alcohol')) return 'Alcohol and cocktails are review-only because servings vary a lot.'
  if (reason.includes('composite') || reason.includes('prepared_dish')) return 'This is a combined dish, not a simple ingredient.'
  if (reason.includes('not_further_specified_review_required')) return 'It is probably fine, but the source says "not further specified."'
  return reason.replace(/_/g, ' ')
}

function describeReason(row: CandidateRow) {
  if (row.reasons.length === 0) return 'No scary reason codes. This is here for a normal eyeball check.'
  return row.reasons.map(reasonLabel).join(' ')
}

function isReviewProtected(row: CandidateRow) {
  const text = normalizedText(row)
  return (
    row.source_kind !== 'usda' ||
    Boolean(row.proposed_product.brand) ||
    hasAny(text, REVIEW_ONLY_TERMS) ||
    hasReason(row, 'brand') ||
    hasReason(row, 'restaurant') ||
    hasReason(row, 'alcohol') ||
    hasReason(row, 'profile_review_only')
  )
}

function isComposite(row: CandidateRow) {
  const text = normalizedText(row)
  return hasAny(text, COMPOSITE_TERMS) || hasReason(row, 'composite') || hasReason(row, 'prepared_dish')
}

function hasObviousMismatchReason(row: CandidateRow) {
  if (matchesOverride(row, IDENTITY_COMPATIBLE_OVERRIDES)) return false
  if (matchesOverride(row, IDENTITY_MISMATCH_OVERRIDES)) return true
  return (
    hasReason(row, 'macro_sanity_failed') ||
    hasReason(row, 'low_target_token_coverage_0') ||
    hasReason(row, 'context_token_missing') ||
    hasReason(row, 'single_token_secondary_match_review_required')
  )
}

function isAlreadyCovered(row: CandidateRow) {
  return hasReason(row, 'duplicate_existing_product') && !hasObviousMismatchReason(row)
}

function isObviousNo(row: CandidateRow) {
  return hasObviousMismatchReason(row) || (row.decision === 'rejected' && !isAlreadyCovered(row))
}

function isProbablyYes(row: CandidateRow) {
  if (row.decision !== 'review_required') return false
  if (row.source_kind !== 'usda') return false
  if (!['Foundation', 'Survey (FNDDS)', 'SR Legacy'].includes(row.source_dataset ?? '')) return false
  if (isReviewProtected(row)) return false
  if (isComposite(row)) return false
  if (row.risk_score > 30) return false
  if (row.unit_alternatives.length < 3) return false
  return row.reasons.length === 0 || row.reasons.every((reason) => reason === 'not_further_specified_review_required')
}

function plainRowFor(row: CandidateRow): PlainRow {
  if (isObviousNo(row)) {
    return {
      row,
      lane: 'obvious-no',
      defaultDecision: 'rejected',
      plainCall: 'NO',
      plainReason: describeReason(row),
      action: 'Leave this as rejected unless you know the robot match is actually what you meant.',
      sortScore: row.decision === 'rejected' ? 0 : 10 + row.risk_score,
    }
  }

  if (isAlreadyCovered(row)) {
    return {
      row,
      lane: 'already-covered',
      defaultDecision: 'edit_needed',
      plainCall: 'COVERED',
      plainReason: describeReason(row),
      action: 'Do not approve a duplicate product. If the identity is compatible, leave edit_needed; if it is a true mismatch, change decision to rejected.',
      sortScore: row.risk_score,
    }
  }

  if (isProbablyYes(row)) {
    return {
      row,
      lane: 'probably-yes',
      defaultDecision: 'edit_needed',
      plainCall: 'PROBABLY YES',
      plainReason: describeReason(row),
      action: 'If "robot found" is what you mean when you say the phrase, change decision to approved.',
      sortScore: row.risk_score,
    }
  }

  if (isReviewProtected(row) || isComposite(row)) {
    return {
      row,
      lane: 'manual-source',
      defaultDecision: 'edit_needed',
      plainCall: 'NOT AUTO',
      plainReason: describeReason(row),
      action: 'Do not approve from this packet unless you are confident the source and serving are right.',
      sortScore: row.risk_score,
    }
  }

  return {
    row,
    lane: 'needs-choice',
    defaultDecision: 'edit_needed',
    plainCall: 'YOUR CALL',
    plainReason: describeReason(row),
    action: 'Decide whether this identity is right. If not, leave edit_needed and write the better food in notes.',
    sortScore: row.risk_score,
  }
}

function formatMacros(product: PantryProductPayload) {
  return `${product.calories_per_serving} cal, ${product.protein_g_per_serving}P, ${product.carbs_g_per_serving}C, ${product.fat_g_per_serving}F`
}

function formatUnits(row: CandidateRow) {
  return row.unit_alternatives.slice(0, 8).map((unit) => `${unit.unit}=${unit.grams}g`).join(', ') || 'none'
}

function renderPacket(rows: PlainRow[], generatedAt: string) {
  const laneOrder: ReviewLane[] = ['obvious-no', 'already-covered', 'probably-yes', 'needs-choice', 'manual-source']
  const grouped: Record<ReviewLane, PlainRow[]> = {
    'obvious-no': [],
    'already-covered': [],
    'probably-yes': [],
    'needs-choice': [],
    'manual-source': [],
  }
  for (const row of rows) grouped[row.lane].push(row)
  for (const laneRows of Object.values(grouped)) {
    laneRows.sort((a, b) => a.sortScore - b.sortScore || (a.row.target_query ?? '').localeCompare(b.row.target_query ?? ''))
  }
  const orderedRows = laneOrder.flatMap((lane) => grouped[lane])

  const lines = [
    '# Plain Pantry Review',
    '',
    `Generated: ${generatedAt}`,
    `Rows: ${rows.length}`,
    '',
    '## What You Are Reviewing',
    '',
    'You are mostly checking identity, not exact macros.',
    '',
    'The question for each row is:',
    '',
    '> If I say the spoken phrase, should Pantheon understand it as the robot match?',
    '',
    'If yes, change `decision` to `approved`.',
    'If no, leave or change it to `rejected`.',
    'If it needs a better food, keep `edit_needed` and write the better answer in `notes`.',
    '',
    'Macros matter after identity is right. If the identity is wrong, the macros are automatically useless.',
    '',
    'Important: `Already Covered` does not mean the robot match is wrong. It usually means Pantheon already has a close product, so the fix is to use the existing row or add an alias, not create a duplicate.',
    '',
    'Example:',
    '',
    '- You said: `steak cooked`',
    '- Robot found: `Steak tartare`',
    '- Your call: reject, because tartare is raw steak, not cooked steak.',
    '',
    'A few concrete calls:',
    '',
    '- `almond milk unsweetened` -> `Almond milk, unsweetened, plain, shelf stable`: identity-compatible, but do not add a duplicate if Pantheon already has it.',
    '- `apple` -> `Fruit butters, apple`: reject. Apple butter is not an apple.',
    '- `balsamic vinegar` -> `Vinegar, balsamic`: identity-compatible.',
    '- `coconut juice` -> `Oil, coconut`: reject. Coconut juice/water is not coconut oil.',
    '- `mint` -> `Mint julep`: reject. Mint is an herb; mint julep is a cocktail.',
    '- `tom yum soup` -> `Campbell tomato soup`: reject. Different food.',
    '',
    'Decision words:',
    '',
    '- `approved`: yes, this is the right identity.',
    '- `rejected`: no, this is the wrong identity.',
    '- `edit_needed`: not sure yet, or it needs a better source/name.',
    '',
    '## The Only Table You Edit',
    '',
    '| candidate_key | decision | corrected_name | notes |',
    '| --- | --- | --- | --- |',
  ]

  for (const plain of orderedRows) {
    const row = plain.row
    const note = `${plain.plainCall}: ${plain.action} Why: ${plain.plainReason}`
    lines.push(
      `| ${escapeCell(row.candidate_key)} | ${plain.defaultDecision} | ${escapeCell(row.display_name)} | ${escapeCell(note)} |`,
    )
  }

  lines.push('', '## Plain-English Detail', '')

  for (const lane of laneOrder) {
    const laneRows = grouped[lane]
    lines.push(`## ${LANE_TITLES[lane]} (${laneRows.length})`, '')

    if (lane === 'obvious-no') {
      lines.push('These are rows where the robot match is probably not what you meant, or the system already found a strong risk.', '')
    } else if (lane === 'already-covered') {
      lines.push('These may be identity-compatible, but Pantheon already has a close row. The job here is only to catch true mismatches; compatible duplicates stay edit_needed.', '')
    } else if (lane === 'probably-yes') {
      lines.push('These are boring USDA rows. You only need to approve them if the phrase and match mean the same food to you.', '')
    } else if (lane === 'needs-choice') {
      lines.push('These need a human call because the system cannot safely infer your intent.', '')
    } else {
      lines.push('These need better source work before auto-writing: brands, restaurants, cocktails, supplements, or combined dishes.', '')
    }

    for (const plain of laneRows) {
      const row = plain.row
      lines.push(`### You said: ${row.target_query ?? row.normalized_name}`)
      lines.push('')
      lines.push(`- Robot found: ${row.display_name}`)
      lines.push(`- My suggested call: ${plain.plainCall}`)
      lines.push(`- What you do: ${plain.action}`)
      lines.push(`- Why: ${plain.plainReason}`)
      lines.push(`- Macros, only after identity is right: ${formatMacros(row.proposed_product)}`)
      lines.push(`- Natural speech units: ${formatUnits(row)}`)
      lines.push(`- Source: ${row.source_kind} / ${row.source_dataset ?? 'unknown'} / ${row.external_id ?? 'n/a'}`)
      lines.push(`- Candidate key: \`${row.candidate_key}\``)
      lines.push('')
    }
  }

  return `${lines.join('\n').trimEnd()}\n`
}

async function loadRows(limit: number): Promise<CandidateRow[]> {
  const supabase = supabaseFromEnv()
  const { data, error } = await supabase
    .from('pantry_import_candidates')
    .select(
      'candidate_key,target_query,normalized_name,display_name,source_kind,source_dataset,external_id,source_release,category,proposed_product,aliases,rejected_aliases,unit_alternatives,risk_score,decision,reasons,import_run_id,updated_at',
    )
    .in('decision', ['review_required', 'rejected'])
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as CandidateRow[]
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv)
  const generatedAt = new Date().toISOString()
  const rows = (await loadRows(args.limit)).map(plainRowFor)
  const outputPath = resolve(args.output ?? defaultOutputPath())
  const outputDir = dirname(outputPath)
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  writeFileSync(outputPath, renderPacket(rows, generatedAt))
  console.log(`Wrote ${outputPath}`)
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.lane] = (acc[row.lane] ?? 0) + 1
    return acc
  }, {})
  console.log(JSON.stringify(counts, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
