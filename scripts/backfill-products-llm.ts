// Op FASTRAK Brick Gamma C.3 — LLM-fill backfill for zero-coverage products.
//
// Catches the products that USDA (Gamma A) and OFF (Gamma B) didn't
// resolve. Per Phase 0 §F.3 and V20's A.8: route ALL zero-coverage
// products through LLM-fill regardless of generic-vs-branded; rely on
// confidence labels in the output to differentiate quality.
//
// For each product whose unit_alternatives is empty:
//   1. llmFillPortions(name, brand) → UnitAlternative[]
//   2. mergeUnitAlternatives append (per Gamma B's pattern; dedup on
//      (unit, source))
//   3. UPDATE products SET unit_alternatives, unit_alternatives_updated_at
//
// Idempotent: products with non-empty unit_alternatives skip on default
// run. --force re-fetches.
//
// Run:  npx tsx scripts/backfill-products-llm.ts
// Flags: --dry-run, --force, --limit=N

import { readFileSync } from 'fs'
import { join } from 'path'

function loadEnvLocal() {
  try {
    const path = join(__dirname, '..', '.env.local')
    const content = readFileSync(path, 'utf8')
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
  } catch (err) {
    console.warn('Could not load .env.local:', (err as Error).message)
  }
}
loadEnvLocal()

import { createClient } from '@supabase/supabase-js'
import { llmFillPortions } from '../lib/llm-fill/portions'
import type { UnitAlternative } from '../types/database'

interface ProductRow {
  id: string
  name: string
  brand: string | null
  unit_alternatives: UnitAlternative[] | null
}

interface Args {
  dryRun: boolean
  force: boolean
  limit: number | null
}

function parseArgs(argv: string[]): Args {
  let dryRun = false
  let force = false
  let limit: number | null = null
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') dryRun = true
    else if (arg === '--force') force = true
    else if (arg.startsWith('--limit=')) {
      const v = parseInt(arg.slice('--limit='.length), 10)
      if (Number.isFinite(v) && v > 0) limit = v
    }
  }
  return { dryRun, force, limit }
}

function mergeUnitAlternatives(
  existing: UnitAlternative[],
  add: UnitAlternative[],
): UnitAlternative[] {
  const merged = [...existing]
  for (const entry of add) {
    const idx = merged.findIndex(
      (e) => e.unit === entry.unit && e.source === entry.source,
    )
    if (idx >= 0) merged[idx] = entry
    else merged.push(entry)
  }
  return merged
}

async function main() {
  const args = parseArgs(process.argv)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: rows, error } = await supabase
    .from('products')
    .select('id, name, brand, unit_alternatives')
    .order('name', { ascending: true })

  if (error) {
    console.error('products query failed:', error.message)
    process.exit(1)
  }
  let products = (rows ?? []) as ProductRow[]
  if (!args.force) {
    products = products.filter((p) => !p.unit_alternatives || p.unit_alternatives.length === 0)
  }
  if (args.limit !== null) products = products.slice(0, args.limit)

  console.log(
    `\n=== Gamma C backfill — ${products.length} zero-coverage products${args.dryRun ? ' (DRY RUN)' : ''}${args.force ? ' (force)' : ''} ===\n`,
  )

  let processed = 0
  let resolved = 0
  let skipped = 0
  let written = 0
  let totalEntries = 0
  let lowConfEntries = 0
  let medConfEntries = 0

  for (const p of products) {
    processed += 1
    const t0 = Date.now()
    const newAlts = await llmFillPortions(p.name, p.brand)
    const dt = Date.now() - t0

    if (newAlts.length === 0) {
      skipped += 1
      console.log(`[${processed}] ${p.name} — LLM returned [] (no plausible units); skip [${dt}ms]`)
      continue
    }

    resolved += 1
    totalEntries += newAlts.length
    for (const a of newAlts) {
      if (a.confidence === 'medium') medConfEntries += 1
      else lowConfEntries += 1
    }

    console.log(`[${processed}] ${p.name} — ${newAlts.length} entries [${dt}ms]`)
    for (const a of newAlts) {
      console.log(`    - ${a.unit}=${a.grams}g [${a.source}/${a.confidence}]`)
    }

    if (!args.dryRun) {
      const existing = (p.unit_alternatives ?? []) as UnitAlternative[]
      const merged = mergeUnitAlternatives(existing, newAlts)
      const { error: updErr } = await supabase
        .from('products')
        .update({
          unit_alternatives: merged,
          unit_alternatives_updated_at: new Date().toISOString(),
        })
        .eq('id', p.id)
      if (updErr) {
        console.error(`    UPDATE failed: ${updErr.message}`)
      } else {
        written += 1
      }
    }
  }

  console.log('\n=== summary ===')
  console.log(`processed:           ${processed}`)
  console.log(`resolved:            ${resolved}`)
  console.log(`skipped (LLM []):    ${skipped}`)
  console.log(`writes:              ${written}${args.dryRun ? ' (dry run; no writes performed)' : ''}`)
  console.log(`total entries added: ${totalEntries}`)
  console.log(`  medium confidence: ${medConfEntries}`)
  console.log(`  low confidence:    ${lowConfEntries}`)
  console.log(`coverage:            ${processed > 0 ? Math.round((resolved / processed) * 100) : 0}%`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
