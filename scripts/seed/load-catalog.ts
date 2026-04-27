/**
 * Phase 2.1.a.1 — Bulk-load product catalog into the production
 * `products` table via service role.
 *
 * One-shot loader. Reads scripts/seed/pantheon_catalog_seed.json
 * (gitignored), inserts each row, no upsert, no idempotency.
 * Re-running would duplicate — TRUNCATE first if a re-run is needed.
 *
 * Usage:
 *   npx tsx scripts/seed/load-catalog.ts
 *
 * Required env vars (read from .env.local at the repo root):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

type FulfillmentSource = 'amazon_fresh' | 'amazon_prime' | 'whole_foods' | 'manual'

const ALLOWED_SOURCES: FulfillmentSource[] = [
  'amazon_fresh', 'amazon_prime', 'whole_foods', 'manual',
]

interface SeedProduct {
  name: string
  brand: string | null
  unit: string
  serving_size_g: number | null
  calories_per_serving: number
  protein_g_per_serving: number
  fat_g_per_serving: number
  carbs_g_per_serving: number
  fiber_g_per_serving: number | null
  fulfillment_source: FulfillmentSource
  barcode: string | null
  product_url: string | null
  notes: string | null
  tracks_inventory: boolean
  servings_per_unit: number | null
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolve(__dirname, '..', '..')
const ENV_PATH = resolve(REPO_ROOT, '.env.local')
const SEED_PATH = resolve(__dirname, 'pantheon_catalog_seed.json')

function loadEnvLocal(path: string): Record<string, string> {
  const raw = readFileSync(path, 'utf8')
  const out: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    out[key] = value
  }
  return out
}

function isFulfillmentSource(v: unknown): v is FulfillmentSource {
  return typeof v === 'string' && (ALLOWED_SOURCES as string[]).includes(v)
}

function reqNumber(o: Record<string, unknown>, key: string, idx: number): number {
  const v = o[key]
  if (typeof v !== 'number' || Number.isNaN(v)) {
    throw new Error(`product[${idx}].${key} must be a number (got ${JSON.stringify(v)})`)
  }
  return v
}

function nullableNumber(o: Record<string, unknown>, key: string, idx: number): number | null {
  const v = o[key]
  if (v === null || v === undefined) return null
  if (typeof v !== 'number' || Number.isNaN(v)) {
    throw new Error(`product[${idx}].${key} must be number or null (got ${JSON.stringify(v)})`)
  }
  return v
}

function nullableString(o: Record<string, unknown>, key: string, idx: number): string | null {
  const v = o[key]
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') {
    throw new Error(`product[${idx}].${key} must be string or null (got ${JSON.stringify(v)})`)
  }
  return v
}

function validateProduct(p: unknown, idx: number): SeedProduct {
  if (!p || typeof p !== 'object') {
    throw new Error(`product[${idx}] is not an object`)
  }
  const o = p as Record<string, unknown>
  if (typeof o.name !== 'string' || !o.name.trim()) {
    throw new Error(`product[${idx}].name missing or empty`)
  }
  if (typeof o.unit !== 'string' || !o.unit.trim()) {
    throw new Error(`product[${idx}].unit missing or empty`)
  }
  if (!isFulfillmentSource(o.fulfillment_source)) {
    throw new Error(
      `product[${idx}].fulfillment_source must be one of ${ALLOWED_SOURCES.join('|')} ` +
      `(got ${JSON.stringify(o.fulfillment_source)})`,
    )
  }

  const out: SeedProduct = {
    name: o.name,
    brand: nullableString(o, 'brand', idx),
    unit: o.unit,
    serving_size_g: nullableNumber(o, 'serving_size_g', idx),
    calories_per_serving: reqNumber(o, 'calories_per_serving', idx),
    protein_g_per_serving: reqNumber(o, 'protein_g_per_serving', idx),
    fat_g_per_serving: reqNumber(o, 'fat_g_per_serving', idx),
    carbs_g_per_serving: reqNumber(o, 'carbs_g_per_serving', idx),
    fiber_g_per_serving: nullableNumber(o, 'fiber_g_per_serving', idx),
    fulfillment_source: o.fulfillment_source,
    barcode: nullableString(o, 'barcode', idx),
    product_url: nullableString(o, 'product_url', idx),
    notes: nullableString(o, 'notes', idx),
    tracks_inventory:
      typeof o.tracks_inventory === 'boolean' ? o.tracks_inventory : false,
    servings_per_unit: nullableNumber(o, 'servings_per_unit', idx),
  }
  return out
}

async function main() {
  const env = loadEnvLocal(ENV_PATH)
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const seedRaw = readFileSync(SEED_PATH, 'utf8')
  const parsed = JSON.parse(seedRaw)
  if (!Array.isArray(parsed)) {
    throw new Error('seed JSON must be a top-level array')
  }
  const products: SeedProduct[] = parsed.map((p, i) => validateProduct(p, i))

  console.log(`[seed] Loaded ${products.length} products from ${SEED_PATH}`)
  console.log(`[seed] Target: ${url}`)
  console.log('')

  const supabase = createClient(url, key)

  let success = 0
  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    const { data, error } = await supabase
      .from('products')
      .insert(p)
      .select('id, name')
      .single()

    if (error) {
      console.error(`[${i + 1}/${products.length}] FAILED: ${p.name} → ${error.message}`)
      throw new Error(`Insert failed at index ${i}: ${error.message}`)
    }
    console.log(`[${i + 1}/${products.length}] inserted: ${data.name} → ${data.id}`)
    success++
  }

  console.log('')
  console.log(`[seed] Inserted ${success}/${products.length} successfully.`)
  console.log('')

  const { count, error: countErr } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
  if (countErr) throw new Error(`count(products) failed: ${countErr.message}`)
  console.log(`[seed] Final products table count: ${count}`)
}

main().catch((err) => {
  console.error('[seed] ERROR:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
