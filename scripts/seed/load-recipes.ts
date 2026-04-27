/**
 * Phase 1.3.5 — Bulk-load imported recipes into the production
 * `recipes` table via service role.
 *
 * One-shot loader. Reads scripts/seed/pantheon_recipes_seed.json
 * (gitignored), inserts each row with source='imported', no upsert,
 * no idempotency. Re-running would duplicate — TRUNCATE first if
 * a re-run is needed.
 *
 * Usage:
 *   npx tsx scripts/seed/load-recipes.ts
 *
 * Required env vars (read from .env.local at the repo root):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

interface SeedIngredient {
  name: string
  qty: number
  unit: string
  notes: string | null
}

interface SeedRecipe {
  name: string
  servings: number
  cuisine: string | null
  protein_type: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  ingredients: SeedIngredient[]
  notes: string | null
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolve(__dirname, '..', '..')
const ENV_PATH = resolve(REPO_ROOT, '.env.local')
const SEED_PATH = resolve(__dirname, 'pantheon_recipes_seed.json')

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

function validateRecipe(r: unknown, idx: number): SeedRecipe {
  if (!r || typeof r !== 'object') {
    throw new Error(`recipe[${idx}] is not an object`)
  }
  const o = r as Record<string, unknown>
  if (typeof o.name !== 'string' || !o.name.trim()) {
    throw new Error(`recipe[${idx}].name missing or empty`)
  }
  if (typeof o.servings !== 'number' || !(o.servings >= 1)) {
    throw new Error(`recipe[${idx}].servings must be number >= 1 (got ${o.servings})`)
  }
  if (!Array.isArray(o.ingredients)) {
    throw new Error(`recipe[${idx}].ingredients must be an array`)
  }
  for (let i = 0; i < o.ingredients.length; i++) {
    const ing = o.ingredients[i] as Record<string, unknown> | null
    if (!ing || typeof ing !== 'object') {
      throw new Error(`recipe[${idx}].ingredients[${i}] is not an object`)
    }
    if (typeof ing.name !== 'string') {
      throw new Error(`recipe[${idx}].ingredients[${i}].name must be a string`)
    }
    if (typeof ing.qty !== 'number') {
      throw new Error(`recipe[${idx}].ingredients[${i}].qty must be a number`)
    }
    if (typeof ing.unit !== 'string') {
      throw new Error(`recipe[${idx}].ingredients[${i}].unit must be a string`)
    }
  }
  // Source MUST NOT be present in the seed file (we hardcode 'imported').
  if ('source' in o) {
    throw new Error(`recipe[${idx}] has a "source" field — not allowed in seed (hardcoded server-side)`)
  }
  return o as unknown as SeedRecipe
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
  const recipes: SeedRecipe[] = parsed.map((r, i) => validateRecipe(r, i))

  console.log(`[seed] Loaded ${recipes.length} recipes from ${SEED_PATH}`)
  console.log(`[seed] Target: ${url}`)
  console.log('')

  const supabase = createClient(url, key)

  let success = 0
  for (let i = 0; i < recipes.length; i++) {
    const r = recipes[i]
    const payload = {
      name: r.name,
      servings: r.servings,
      cuisine: r.cuisine,
      protein_type: r.protein_type,
      calories: r.calories,
      protein_g: r.protein_g,
      carbs_g: r.carbs_g,
      fat_g: r.fat_g,
      ingredients: r.ingredients,
      notes: r.notes,
      source: 'imported' as const,
    }
    const { data, error } = await supabase
      .from('recipes')
      .insert(payload)
      .select('id, name')
      .single()

    if (error) {
      console.error(`[${i + 1}/${recipes.length}] FAILED: ${r.name} → ${error.message}`)
      throw new Error(`Insert failed at index ${i}: ${error.message}`)
    }
    console.log(`[${i + 1}/${recipes.length}] inserted: ${data.name} → ${data.id}`)
    success++
  }

  console.log('')
  console.log(`[seed] Inserted ${success}/${recipes.length} successfully.`)
  console.log('')

  // Final count by source — uses the REST count header trick via .select() with head:true
  const { data: byAi, error: aiErr, count: aiCount } = await supabase
    .from('recipes')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'ai_generated')
  void byAi
  if (aiErr) throw new Error(`count(ai_generated) failed: ${aiErr.message}`)

  const { data: byImp, error: impErr, count: impCount } = await supabase
    .from('recipes')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'imported')
  void byImp
  if (impErr) throw new Error(`count(imported) failed: ${impErr.message}`)

  const { data: byUser, error: usrErr, count: usrCount } = await supabase
    .from('recipes')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'user')
  void byUser
  if (usrErr) throw new Error(`count(user) failed: ${usrErr.message}`)

  console.log('[seed] Final library state by source:')
  console.log(`  ai_generated  ${aiCount}`)
  console.log(`  imported      ${impCount}`)
  console.log(`  user          ${usrCount}`)
  console.log(`  TOTAL         ${(aiCount ?? 0) + (impCount ?? 0) + (usrCount ?? 0)}`)
}

main().catch((err) => {
  console.error('[seed] ERROR:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
