// Apply curated generic-equivalence aliases to existing pantry products.
//
// Default mode is read-only:
//   npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-amazon-1.json
//
// Live alias writes require:
//   npx tsx scripts/apply-generic-pantry-aliases.ts --file=data/pantry/generic-aliases-amazon-1.json --apply --allow-alias-writes --max-alias=25

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { bustResponseCacheForUser } from '../lib/claude/parse-meal-response-cache'
import { normalizeFoodText } from '../lib/pantry-builder/normalize'
import { getCanonicalUserId } from '../lib/pantheon-user'

const DUPLICATE_ERROR_CODE = '23505'

interface Args {
  allowAliasWrites: boolean
  apply: boolean
  file: string | null
  maxAlias: number
}

interface AliasSpec {
  alias: string
  target_name: string
  confidence: 'high' | 'medium'
  reason: string
}

interface AliasFile {
  version: number
  name: string
  aliases: AliasSpec[]
}

interface ProductRow {
  id: string
  name: string
  brand: string | null
}

interface ExistingAliasRow {
  target_source_ref: string
  normalized_alias: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    allowAliasWrites: false,
    apply: false,
    file: null,
    maxAlias: 25,
  }
  for (const arg of argv.slice(2)) {
    if (arg === '--allow-alias-writes') args.allowAliasWrites = true
    else if (arg === '--apply') args.apply = true
    else if (arg.startsWith('--file=')) args.file = arg.slice('--file='.length)
    else if (arg.startsWith('--max-alias=')) args.maxAlias = Number(arg.slice('--max-alias='.length))
    else throw new Error(`Unknown arg: ${arg}`)
  }
  if (!args.file) throw new Error('--file=<path> is required')
  if (!Number.isInteger(args.maxAlias) || args.maxAlias < 1) throw new Error('--max-alias must be a positive integer')
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

function loadAliasFile(path: string): AliasFile {
  const file = JSON.parse(readFileSync(resolve(path), 'utf8')) as AliasFile
  if (!Number.isInteger(file.version) || file.version < 1) throw new Error('alias file version must be positive')
  if (!Array.isArray(file.aliases) || file.aliases.length === 0) throw new Error('alias file must contain aliases')
  return file
}

function isDuplicateError(error: { code?: string; message?: string }) {
  return error.code === DUPLICATE_ERROR_CODE || String(error.message ?? '').toLowerCase().includes('duplicate')
}

function findProduct(spec: AliasSpec, products: ProductRow[]) {
  const normalizedTarget = normalizeFoodText(spec.target_name)
  return products.filter((product) => normalizeFoodText(product.name) === normalizedTarget)
}

function nearbyProducts(spec: AliasSpec, products: ProductRow[]) {
  const tokens = normalizeFoodText(spec.target_name)
    .split(' ')
    .filter((token) => token.length >= 4)
  if (tokens.length === 0) return []
  return products
    .filter((product) => {
      const normalizedName = normalizeFoodText(product.name)
      return tokens.some((token) => normalizedName.includes(token))
    })
    .slice(0, 12)
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv)
  const aliasFile = loadAliasFile(args.file!)
  const supabase = supabaseFromEnv()

  const [{ data: productsData, error: productsError }, { data: aliasesData, error: aliasesError }] = await Promise.all([
    supabase.from('products').select('id,name,brand').order('name', { ascending: true }),
    supabase.from('food_identity_aliases').select('target_source_ref,normalized_alias').eq('active', true),
  ])
  if (productsError) throw productsError
  if (aliasesError) throw aliasesError

  const products = (productsData ?? []) as ProductRow[]
  const existingAliases = (aliasesData ?? []) as ExistingAliasRow[]
  const existingByAlias = new Map<string, ExistingAliasRow[]>()
  for (const row of existingAliases) {
    const list = existingByAlias.get(row.normalized_alias) ?? []
    list.push(row)
    existingByAlias.set(row.normalized_alias, list)
  }

  const plans = aliasFile.aliases.map((spec) => {
    const normalizedAlias = normalizeFoodText(spec.alias)
    const matches = findProduct(spec, products)
    const existing = existingByAlias.get(normalizedAlias) ?? []
    if (!normalizedAlias) return { type: 'invalid_alias' as const, spec, normalizedAlias, matches, existing }
    if (matches.length !== 1) return { type: 'target_match_error' as const, spec, normalizedAlias, matches, existing }
    const targetSourceRef = `lib:product:${matches[0].id}`
    if (existing.some((row) => row.target_source_ref === targetSourceRef)) {
      return { type: 'already_exists' as const, spec, normalizedAlias, matches, existing }
    }
    if (existing.length > 0) return { type: 'alias_conflict' as const, spec, normalizedAlias, matches, existing }
    return { type: 'insert' as const, spec, normalizedAlias, matches, existing }
  })

  const inserts = plans.filter((plan) => plan.type === 'insert')
  const counts = plans.reduce<Record<string, number>>((acc, plan) => {
    acc[plan.type] = (acc[plan.type] ?? 0) + 1
    return acc
  }, {})

  console.log(`Generic alias ${args.apply ? 'apply' : 'plan'}`)
  console.log(`file: ${resolve(args.file!)}`)
  console.log(`alias_file: ${aliasFile.name}`)
  console.log(`aliases: ${aliasFile.aliases.length}`)
  console.log(`products_loaded: ${products.length}`)
  console.log(`existing_aliases_loaded: ${existingAliases.length}`)
  console.log(`counts: ${Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(', ')}`)
  console.log(`max_alias: ${args.maxAlias}`)
  console.log('')
  console.log('Actions')
  for (const plan of plans) {
    const target = plan.matches.length === 1 ? plan.matches[0] : null
    console.log(JSON.stringify({
      type: plan.type,
      alias: plan.spec.alias,
      normalized_alias: plan.normalizedAlias,
      target_name: plan.spec.target_name,
      matched_target: target ? { id: target.id, name: target.name } : null,
      match_count: plan.matches.length,
      nearby_targets: plan.type === 'target_match_error'
        ? nearbyProducts(plan.spec, products).map((product) => product.name)
        : undefined,
      confidence: plan.spec.confidence,
      reason: plan.spec.reason,
    }))
  }

  if (inserts.length > args.maxAlias) {
    throw new Error(`refusing alias apply: ${inserts.length} inserts exceeds --max-alias=${args.maxAlias}`)
  }
  if (!args.apply) {
    console.log('')
    console.log('Dry run only. No Supabase writes.')
    return
  }
  if (!args.allowAliasWrites) throw new Error('Live alias writes require --allow-alias-writes')

  const userId = await getCanonicalUserId(supabase)
  let inserted = 0
  for (const plan of inserts) {
    const product = plan.matches[0]
    const { error } = await supabase.from('food_identity_aliases').insert({
      target_type: 'product',
      target_id: product.id,
      target_source_ref: `lib:product:${product.id}`,
      alias: plan.spec.alias,
      normalized_alias: plan.normalizedAlias,
      alias_type: 'generic_equivalent',
      confidence: plan.spec.confidence,
      source: 'pantry_generic_alias',
      import_run_id: null,
      active: true,
    })
    if (error && !isDuplicateError(error)) throw error
    if (!error) inserted++
  }
  if (inserted > 0) await bustResponseCacheForUser(supabase, userId)
  console.log('')
  console.log(`Inserted aliases: ${inserted}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
