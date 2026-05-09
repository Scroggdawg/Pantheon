// Op FASTRAK Brick Gamma B — one-time backfill: OFF → products.
//
// For each product whose unit_alternatives is empty (typically the 13
// post-Gamma-A zero-coverage Branded items USDA didn't track portions for):
//   1. offTextSearch(name, brand) → candidate list
//   2. Pick top match per Q1 tiered logic:
//      - Tier 1: results with non-zero per-serving macros + nutriscore_grade present
//      - Tier 2: results with non-zero per-serving macros + brand match
//      - Tier 3: any remaining result with non-zero per-serving macros
//   3. Map OffProduct → unit_alternatives entry + serving info
//   4. UPDATE products with selective backfill semantics:
//      - unit_alternatives: APPEND (dedup on (unit, source) per Phase 0 §F.6)
//      - brand: backfill if missing only (Q2 — prefer existing)
//      - barcode: backfill if missing only (Q3)
//      - serving_size_g + per_serving macros + fiber: backfill if null/0 only
//      - fulfillment_source: NOT touched (not Gamma B's domain)
//      - fdc_id: NOT touched (USDA-specific)
//      - unit_alternatives_updated_at: now()
//
// Idempotent: re-running with --force re-fetches; default skips products
// that already have non-empty unit_alternatives.
//
// Run from web repo root:
//   npx tsx scripts/backfill-products-off.ts
//
// Flags:
//   --dry-run       Print plan, don't write
//   --force         Re-fetch even if unit_alternatives is non-empty
//   --limit=<N>     Cap to first N candidate products
//   --include-all   Process ALL products with unit_alternatives=[] AND
//                   products that already have entries (additive merge).
//                   Without this flag, only zero-coverage products run.

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
import { offTextSearch, parseUnitFromServingSize } from '../lib/off/search'
import type { OffProduct } from '../lib/off/types'
import type { UnitAlternative } from '../types/database'

interface ProductRow {
  id: string
  name: string
  brand: string | null
  unit: string
  serving_size_g: number | null
  calories_per_serving: number | null
  protein_g_per_serving: number | null
  carbs_g_per_serving: number | null
  fat_g_per_serving: number | null
  fiber_g_per_serving: number | null
  barcode: string | null
  unit_alternatives: UnitAlternative[] | null
  fdc_id: number | null
}

interface Args {
  dryRun: boolean
  force: boolean
  limit: number | null
  includeAll: boolean
}

function parseArgs(argv: string[]): Args {
  let dryRun = false
  let force = false
  let limit: number | null = null
  let includeAll = false
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') dryRun = true
    else if (arg === '--force') force = true
    else if (arg === '--include-all') includeAll = true
    else if (arg.startsWith('--limit=')) {
      const v = parseInt(arg.slice('--limit='.length), 10)
      if (Number.isFinite(v) && v > 0) limit = v
    }
  }
  return { dryRun, force, limit, includeAll }
}

// Q1 pick-best logic. Score each candidate:
//   +2.0   nutriscore_grade present (curated-quality entry)
//   +1.0   brand match (case-insensitive contains)
//   +0.5   name match (product_name contains the query name)
//   −10.0  missing per-serving energy or zero (drop unusable)
// Tie-break: OFF's native order (lower index wins).
function pickBestOffMatch(
  candidates: OffProduct[],
  query: string,
  brand: string | null,
): OffProduct | null {
  if (candidates.length === 0) return null

  const queryLower = query.toLowerCase()
  const brandLower = brand?.toLowerCase() ?? ''

  let best: { product: OffProduct; score: number; idx: number } | null = null
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    const kcalServing = c.nutriments?.['energy-kcal_serving']
    const kcalPer100 = c.nutriments?.['energy-kcal_100g']
    if (
      (kcalServing === undefined || kcalServing <= 0) &&
      (kcalPer100 === undefined || kcalPer100 <= 0)
    ) {
      continue // unusable — no calorie data at all
    }
    let score = 0
    if (c.nutriscore_grade && c.nutriscore_grade !== 'unknown') score += 2
    if (brandLower.length > 0 && (c.brands ?? '').toLowerCase().includes(brandLower)) {
      score += 1
    }
    if ((c.product_name ?? '').toLowerCase().includes(queryLower)) score += 0.5

    if (
      best === null ||
      score > best.score ||
      (score === best.score && i < best.idx)
    ) {
      best = { product: c, score, idx: i }
    }
  }

  return best?.product ?? null
}

// Map an OFF product into a partial product-row update + a unit_alternatives
// entry. Per Phase 0 §F.2 + Q3 (backfill missing fields only).
function offToProductPatch(
  off: OffProduct,
  existing: ProductRow,
): {
  patch: Partial<ProductRow>
  unitAlt: UnitAlternative | null
} {
  const patch: Partial<ProductRow> = {}

  // brand — prefer existing per Q2
  if ((existing.brand ?? '').length === 0 && off.brands) {
    const firstBrand = off.brands.split(',')[0]?.trim()
    if (firstBrand) patch.brand = firstBrand
  }

  // barcode — backfill if missing only per Q3
  if ((existing.barcode ?? '').length === 0 && off.code) {
    patch.barcode = off.code
  }

  // serving_size_g — backfill if null/0
  if ((existing.serving_size_g ?? 0) <= 0 && (off.serving_quantity ?? 0) > 0) {
    patch.serving_size_g = off.serving_quantity
  }

  // per-serving macros — backfill missing/zero only
  const n = off.nutriments ?? {}
  const sq = off.serving_quantity ?? 0
  function perServingFromPer100(per100: number | undefined): number | null {
    if (per100 === undefined || sq <= 0) return null
    return Math.round((per100 * sq) / 100 * 100) / 100
  }
  const calorieServing = n['energy-kcal_serving'] ?? perServingFromPer100(n['energy-kcal_100g'])
  if ((existing.calories_per_serving ?? 0) <= 0 && calorieServing !== null && calorieServing > 0) {
    patch.calories_per_serving = calorieServing
  }
  const proteinServing = n['proteins_serving'] ?? perServingFromPer100(n['proteins_100g'])
  if ((existing.protein_g_per_serving ?? 0) <= 0 && proteinServing !== null && proteinServing >= 0) {
    patch.protein_g_per_serving = proteinServing
  }
  const carbsServing = n['carbohydrates_serving'] ?? perServingFromPer100(n['carbohydrates_100g'])
  if ((existing.carbs_g_per_serving ?? 0) <= 0 && carbsServing !== null && carbsServing >= 0) {
    patch.carbs_g_per_serving = carbsServing
  }
  const fatServing = n['fat_serving'] ?? perServingFromPer100(n['fat_100g'])
  if ((existing.fat_g_per_serving ?? 0) <= 0 && fatServing !== null && fatServing >= 0) {
    patch.fat_g_per_serving = fatServing
  }
  const fiberServing = n['fiber_serving'] ?? perServingFromPer100(n['fiber_100g'])
  if ((existing.fiber_g_per_serving ?? 0) <= 0 && fiberServing !== null && fiberServing > 0) {
    patch.fiber_g_per_serving = fiberServing
  }

  // unit_alternatives entry
  let unit = parseUnitFromServingSize(off.serving_size)
  if (unit.length === 0) unit = 'serving'
  const grams = off.serving_quantity ?? 0
  const confidence: UnitAlternative['confidence'] =
    off.nutriscore_grade && off.nutriscore_grade !== 'unknown' ? 'high' : 'medium'
  const unitAlt: UnitAlternative | null = grams > 0 ? {
    unit,
    grams: Math.round(grams * 100) / 100,
    source: 'off',
    confidence,
  } : null

  return { patch, unitAlt }
}

// Append + dedup on (unit, source).
function mergeUnitAlternatives(
  existing: UnitAlternative[],
  add: UnitAlternative,
): UnitAlternative[] {
  const merged = [...existing]
  const idx = merged.findIndex((e) => e.unit === add.unit && e.source === add.source)
  if (idx >= 0) merged[idx] = add
  else merged.push(add)
  return merged
}

async function main() {
  const args = parseArgs(process.argv)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const query = supabase
    .from('products')
    .select(
      'id, name, brand, unit, serving_size_g, calories_per_serving, protein_g_per_serving, carbs_g_per_serving, fat_g_per_serving, fiber_g_per_serving, barcode, unit_alternatives, fdc_id',
    )
    .order('name', { ascending: true })

  // Default: only zero-coverage products. --include-all processes everything.
  // --force re-fetches even when unit_alternatives is populated.
  const { data: rows, error } = await query

  if (error) {
    console.error('products query failed:', error.message)
    process.exit(1)
  }
  let products = (rows ?? []) as ProductRow[]
  if (!args.includeAll && !args.force) {
    products = products.filter((p) => !p.unit_alternatives || p.unit_alternatives.length === 0)
  }
  if (args.limit !== null) products = products.slice(0, args.limit)

  console.log(
    `\n=== Gamma B backfill — ${products.length} products${args.dryRun ? ' (DRY RUN)' : ''}${args.force ? ' (force)' : ''}${args.includeAll ? ' (include-all)' : ''} ===\n`,
  )

  let processed = 0
  let resolved = 0
  let skipped = 0
  let written = 0

  for (const p of products) {
    processed += 1
    const candidates = await offTextSearch(p.name, p.brand, 5)
    if (candidates.length === 0) {
      skipped += 1
      console.log(`[${processed}] ${p.name} — OFF returned 0 candidates; skip (Gamma E hand-resolve)`)
      continue
    }

    const best = pickBestOffMatch(candidates, p.name, p.brand)
    if (!best) {
      skipped += 1
      console.log(`[${processed}] ${p.name} — ${candidates.length} candidates but none usable (no calorie data); skip`)
      continue
    }

    const { patch, unitAlt } = offToProductPatch(best, p)
    if (!unitAlt) {
      skipped += 1
      console.log(`[${processed}] ${p.name} — picked match but serving_quantity=0; skip`)
      continue
    }

    const existingAlts = (p.unit_alternatives ?? []) as UnitAlternative[]
    const mergedAlts = mergeUnitAlternatives(existingAlts, unitAlt)

    resolved += 1
    console.log(
      `[${processed}] ${p.name} → ${best.product_name} (${best.brands ?? '?'}, nutriscore=${best.nutriscore_grade ?? 'none'})`,
    )
    console.log(
      `    unit_alts: +{ ${unitAlt.unit}=${unitAlt.grams}g (${unitAlt.source}/${unitAlt.confidence}) }${
        Object.keys(patch).length > 0
          ? ` patch: ${Object.keys(patch).join(', ')}`
          : ' (no row patch — already populated)'
      }`,
    )

    if (!args.dryRun) {
      const update = {
        ...patch,
        unit_alternatives: mergedAlts,
        unit_alternatives_updated_at: new Date().toISOString(),
      }
      const { error: updErr } = await supabase
        .from('products')
        .update(update)
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
  console.log(`skipped (Gamma E):   ${skipped}`)
  console.log(`writes:              ${written}${args.dryRun ? ' (dry run; no writes performed)' : ''}`)
  console.log(`coverage:            ${processed > 0 ? Math.round((resolved / processed) * 100) : 0}%`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
