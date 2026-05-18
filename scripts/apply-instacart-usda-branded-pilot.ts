import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { bustResponseCacheForUser } from '../lib/claude/parse-meal-response-cache'
import { normalizeFoodText } from '../lib/pantry-builder/normalize'
import { getCanonicalUserId } from '../lib/pantheon-user'
import type { UnitAlternative } from '../types/database'

interface Args {
  apply: boolean
  allowBrandedWrites: boolean
  maxInsert: number
  runId: string | null
  runFile: string | null
}

interface InstacartItem {
  itemName: string
  brand: string
  category: string
}

interface UsdaFood {
  fdcId?: number
  description?: string
  brandName?: string
  brandOwner?: string
  gtinUpc?: string
}

interface CandidateScore {
  candidate: UsdaFood
  score: number
  warnings: string[]
  servingUnit: string
  servingGrams: number | null
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}

interface PilotResult {
  item: InstacartItem
  candidates: CandidateScore[]
}

interface PilotArtifact {
  runId: string
  args?: { lane?: string }
  results: PilotResult[]
}

interface ExistingProduct {
  id: string
  fdc_id: number | null
  barcode: string | null
  provenance_external_id: string | null
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    apply: false,
    allowBrandedWrites: false,
    maxInsert: 5,
    runId: null,
    runFile: null,
  }
  for (const arg of argv.slice(2)) {
    if (arg === '--apply') args.apply = true
    else if (arg === '--allow-branded-writes') args.allowBrandedWrites = true
    else if (arg.startsWith('--max-insert=')) args.maxInsert = Number(arg.slice('--max-insert='.length))
    else if (arg.startsWith('--run-id=')) args.runId = arg.slice('--run-id='.length)
    else if (arg.startsWith('--run-file=')) args.runFile = arg.slice('--run-file='.length)
    else throw new Error(`Unknown arg: ${arg}`)
  }
  if (!Number.isInteger(args.maxInsert) || args.maxInsert < 1) throw new Error('--max-insert must be a positive integer')
  if (!args.runId) throw new Error('--run-id=<id> is required')
  if (!args.runFile) throw new Error('--run-file=<path> is required')
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

function readArtifact(path: string, runId: string): PilotArtifact {
  const artifact = JSON.parse(readFileSync(resolve(path), 'utf8')) as PilotArtifact
  if (artifact.runId !== runId) throw new Error(`run id mismatch: artifact=${artifact.runId} arg=${runId}`)
  return artifact
}

function readyResults(artifact: PilotArtifact): Array<PilotResult & { best: CandidateScore }> {
  return artifact.results
    .map((result) => ({ ...result, best: result.candidates[0] }))
    .filter((result): result is PilotResult & { best: CandidateScore } => Boolean(
      result.best &&
      result.best.score >= 9 &&
      result.best.warnings.length === 0 &&
      result.best.candidate.fdcId &&
      result.best.candidate.gtinUpc &&
      result.best.servingGrams &&
      result.best.kcal !== null &&
      result.best.protein !== null &&
      result.best.carbs !== null &&
      result.best.fat !== null,
    ))
}

function categoryForLane(lane: string | undefined) {
  if (lane === 'packaged-beverages') return 'branded_packaged_beverage'
  if (lane === 'condiments-sauces') return 'branded_condiment_sauce'
  if (lane === 'snacks-bread') return 'branded_snack_bread'
  return 'branded_product'
}

function brandFor(result: PilotResult & { best: CandidateScore }) {
  return result.item.brand || result.best.candidate.brandName || result.best.candidate.brandOwner || null
}

function productInsertPayload(result: PilotResult & { best: CandidateScore }, runId: string, lane: string | undefined) {
  const c = result.best
  const fdcId = c.candidate.fdcId!
  const upc = c.candidate.gtinUpc!
  const unit = c.servingUnit || 'serving'
  const grams = c.servingGrams!
  const now = new Date().toISOString()
  const unitAlternatives: UnitAlternative[] = [
    { unit, grams, source: 'usda', confidence: 'medium' },
    { unit: 'g', grams: 1, source: 'standard', confidence: 'high' },
  ]
  return {
    name: result.item.itemName,
    brand: brandFor(result),
    unit,
    serving_size_g: grams,
    calories_per_serving: c.kcal!,
    protein_g_per_serving: c.protein!,
    fat_g_per_serving: c.fat!,
    carbs_g_per_serving: c.carbs!,
    fiber_g_per_serving: null,
    fulfillment_source: 'manual',
    barcode: upc,
    product_url: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${fdcId}/nutrients`,
    notes: `Instacart USDA Branded pilot exact product. USDA description: ${c.candidate.description ?? 'unknown'}.`,
    tracks_inventory: false,
    servings_per_unit: null,
    unit_alternatives: unitAlternatives,
    unit_alternatives_updated_at: now,
    fdc_id: fdcId,
    provenance_source_kind: 'usda',
    provenance_dataset: 'Branded',
    provenance_external_id: String(fdcId),
    provenance_release: `fdc-api-${now.slice(0, 10)}`,
    provenance_import_run_id: runId,
    import_confidence: 'medium',
    canonical_category: categoryForLane(lane),
  }
}

function aliasesFor(result: PilotResult & { best: CandidateScore }) {
  const brand = brandFor(result)
  const description = result.best.candidate.description ?? ''
  const aliases = [
    result.item.itemName,
    description,
    brand && !normalizeFoodText(result.item.itemName).startsWith(normalizeFoodText(brand))
      ? `${brand} ${result.item.itemName}`
      : '',
  ]
  return [...new Set(aliases.map((alias) => alias.trim()).filter(Boolean))]
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv)
  const artifact = readArtifact(args.runFile!, args.runId!)
  const lane = artifact.args?.lane
  const ready = readyResults(artifact)
  if (ready.length === 0) throw new Error('No ready candidates in pilot artifact')
  if (ready.length > args.maxInsert) throw new Error(`refusing apply: ${ready.length} ready candidates exceeds --max-insert=${args.maxInsert}`)

  const supabase = supabaseFromEnv()
  const fdcIds = ready.map((result) => result.best.candidate.fdcId!)
  const upcs = ready.map((result) => result.best.candidate.gtinUpc!)
  const { data: existingData, error: existingError } = await supabase
    .from('products')
    .select('id,fdc_id,barcode,provenance_external_id')
    .or(`fdc_id.in.(${fdcIds.join(',')}),barcode.in.(${upcs.join(',')}),provenance_external_id.in.(${fdcIds.join(',')})`)
  if (existingError) throw existingError
  const existing = (existingData ?? []) as ExistingProduct[]
  const existingKeys = new Set(existing.flatMap((product) => [
    product.fdc_id ? String(product.fdc_id) : null,
    product.barcode,
    product.provenance_external_id,
  ]).filter(Boolean))
  const insertable = ready.filter((result) => {
    const fdcId = String(result.best.candidate.fdcId)
    const upc = result.best.candidate.gtinUpc
    return !existingKeys.has(fdcId) && !existingKeys.has(upc ?? null)
  })

  console.log('Instacart USDA branded pilot apply')
  console.log(`run_id: ${args.runId}`)
  console.log(`lane: ${lane}`)
  console.log(`ready_candidates: ${ready.length}`)
  console.log(`existing_matches: ${existing.length}`)
  console.log(`insertable: ${insertable.length}`)
  console.log(`max_insert: ${args.maxInsert}`)
  for (const result of ready) {
    const row = productInsertPayload(result, args.runId!, lane)
    console.log(JSON.stringify({
      action: insertable.includes(result) ? 'insert' : 'skip_existing',
      instacart_item: result.item.itemName,
      name: row.name,
      brand: row.brand,
      fdc_id: row.fdc_id,
      barcode: row.barcode,
      unit: row.unit,
      serving_size_g: row.serving_size_g,
      calories: row.calories_per_serving,
      protein_g: row.protein_g_per_serving,
      carbs_g: row.carbs_g_per_serving,
      fat_g: row.fat_g_per_serving,
      aliases: aliasesFor(result),
    }))
  }

  if (!args.apply) {
    console.log('Dry run only. No Supabase writes.')
    return
  }
  if (!args.allowBrandedWrites) throw new Error('Live branded writes require --allow-branded-writes')
  if (insertable.length > args.maxInsert) throw new Error(`refusing apply: ${insertable.length} insertable candidates exceeds --max-insert=${args.maxInsert}`)

  const userId = await getCanonicalUserId(supabase)
  const { error: runError } = await supabase.from('pantry_import_runs').upsert({
    id: args.runId,
    mode: 'apply',
    source_kind: 'usda',
    source_release: `fdc-api-${new Date().toISOString().slice(0, 10)}`,
    profile_version: 1,
    target_count: ready.length,
    status: 'started',
    candidate_counts: { total: ready.length, insertable: insertable.length, existing: existing.length, lane },
    profile: { name: `Instacart USDA Branded pilot: ${lane}`, source: 'local Instacart export and USDA Branded' },
    notes: 'Capped USDA Branded exact-product pilot from source-gated report.',
  }, { onConflict: 'id' })
  if (runError) throw runError

  let inserted = 0
  let aliasInserted = 0
  for (const result of insertable) {
    const { data: product, error: insertError } = await supabase
      .from('products')
      .insert(productInsertPayload(result, args.runId!, lane))
      .select('id,name')
      .single()
    if (insertError) throw insertError
    inserted += 1

    const sourceRef = `lib:product:${product.id}`
    for (const alias of aliasesFor(result)) {
      const normalizedAlias = normalizeFoodText(alias)
      if (!normalizedAlias) continue
      const { error: aliasError } = await supabase.from('food_identity_aliases').insert({
        target_type: 'product',
        target_id: product.id,
        target_source_ref: sourceRef,
        alias,
        normalized_alias: normalizedAlias,
        alias_type: 'exact_product',
        confidence: 'high',
        source: 'instacart_usda_branded_pilot',
        import_run_id: args.runId,
        active: true,
      })
      if (aliasError && !String(aliasError.message).toLowerCase().includes('duplicate')) throw aliasError
      if (!aliasError) aliasInserted += 1
    }
  }

  const { error: finishError } = await supabase.from('pantry_import_runs').update({
    status: 'completed',
    candidate_counts: { total: ready.length, inserted, aliases_inserted: aliasInserted, existing: existing.length, lane },
    finished_at: new Date().toISOString(),
  }).eq('id', args.runId)
  if (finishError) throw finishError
  if (inserted > 0 || aliasInserted > 0) await bustResponseCacheForUser(supabase, userId)
  console.log(`Inserted products: ${inserted}`)
  console.log(`Inserted aliases: ${aliasInserted}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
