// Op FASTRAK Brick Gamma A — one-time backfill: USDA portions → products.
//
// For each product whose unit_alternatives is empty:
//   1. If fdc_id missing, name-search USDA → recover fdc_id (Path 1)
//   2. Fetch /v1/food/{fdc_id} → parse foodPortions[]
//   3. UPDATE products SET unit_alternatives, fdc_id, timestamp
//
// Idempotent: products with non-empty unit_alternatives skip on re-run.
// To force re-fetch for a specific product, clear its unit_alternatives
// to '[]' first.
//
// Run from web repo root:
//   npx tsx scripts/backfill-product-portions.ts
//
// Flags:
//   --dry-run     Print plan, don't write
//   --force       Re-fetch even if unit_alternatives is non-empty
//   --limit=<N>   Cap to first N products (smoke runs)

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
import {
  usdaFetchPortions,
  usdaResolveFdcId,
  type UnitAlternative,
} from '../lib/usda/portions'

interface ProductRow {
  id: string
  name: string
  brand: string | null
  unit_alternatives: UnitAlternative[]
  fdc_id: number | null
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

async function main() {
  const args = parseArgs(process.argv)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: rows, error } = await supabase
    .from('products')
    .select('id, name, brand, unit_alternatives, fdc_id')
    .order('name', { ascending: true })

  if (error) {
    console.error('products query failed:', error.message)
    process.exit(1)
  }
  let products = (rows ?? []) as ProductRow[]
  if (args.limit !== null) products = products.slice(0, args.limit)

  console.log(
    `\n=== Gamma A backfill — ${products.length} products${args.dryRun ? ' (DRY RUN)' : ''}${args.force ? ' (force)' : ''} ===\n`,
  )

  let processed = 0
  let resolved = 0
  let alreadyHadAlts = 0
  let recoveredFdc = 0
  let zeroPortions = 0
  let written = 0

  for (const p of products) {
    processed += 1
    const hasAlts = Array.isArray(p.unit_alternatives) && p.unit_alternatives.length > 0
    if (hasAlts && !args.force) {
      alreadyHadAlts += 1
      console.log(`[${processed}] ${p.name} — already has ${p.unit_alternatives.length} alts; skip`)
      continue
    }

    let fdcId = p.fdc_id
    let recovered = false
    if (!fdcId) {
      fdcId = await usdaResolveFdcId(p.name, p.brand)
      if (fdcId) {
        recoveredFdc += 1
        recovered = true
      }
    }

    if (!fdcId) {
      console.log(`[${processed}] ${p.name} — no fdcId resolvable; skip`)
      continue
    }

    const alternatives = await usdaFetchPortions(fdcId)
    if (alternatives.length === 0) {
      zeroPortions += 1
      console.log(
        `[${processed}] ${p.name} (fdc=${fdcId}${recovered ? ' recovered' : ''}) — 0 portions; skip`,
      )
      // Still stash fdcId so future runs (or Gamma C LLM-fill) can use it.
      if (!args.dryRun && recovered) {
        await supabase.from('products').update({ fdc_id: fdcId }).eq('id', p.id)
      }
      continue
    }

    resolved += 1
    console.log(
      `[${processed}] ${p.name} (fdc=${fdcId}${recovered ? ' recovered' : ''}) — ${alternatives.length} portions`,
    )
    for (const a of alternatives) {
      console.log(`    - ${a.unit} = ${a.grams}g (${a.source}/${a.confidence})`)
    }

    if (!args.dryRun) {
      const { error: updErr } = await supabase
        .from('products')
        .update({
          unit_alternatives: alternatives,
          fdc_id: fdcId,
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
  console.log(`already had alts:    ${alreadyHadAlts}`)
  console.log(`fdcId recovered:     ${recoveredFdc}`)
  console.log(`portions resolved:   ${resolved}`)
  console.log(`zero-portion fall-through: ${zeroPortions}`)
  console.log(`writes:              ${written}${args.dryRun ? ' (dry run; no writes performed)' : ''}`)
  console.log(`coverage:            ${processed > 0 ? Math.round((resolved / processed) * 100) : 0}%`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
