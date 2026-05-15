// LP-10..LP-19 Autonomous Pantry Builder.
//
// Default mode is DRY RUN:
//   npx tsx scripts/autonomous-pantry-builder.ts --limit=25 --offset=0
//   npx tsx scripts/autonomous-pantry-builder.ts --profile=data/pantry/packs/core-usda.json --limit=25 --offset=25
//
// Live apply is guarded:
//   npx tsx scripts/autonomous-pantry-builder.ts --apply \
//     --run-id=<run-id-from-dry-run> \
//     --run-file=scripts/output/pantry-builder-<run-id>.json \
//     --max-insert=25
//
// Apply only writes candidates classified auto_approved. Branded/OFF,
// restaurant, alcohol, LLM-estimated, duplicate, and review-required rows
// remain in the candidate ledger for review.

import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { bustResponseCacheForUser } from '../lib/claude/parse-meal-response-cache'
import { getCanonicalUserId } from '../lib/pantheon-user'
import { normalizeFoodText } from '../lib/pantry-builder/normalize'
import { classifyPantryCandidate } from '../lib/pantry-builder/risk'
import type {
  ExistingProductSummary,
  PantryCandidate,
  PantryProfile,
  PantryTarget,
} from '../lib/pantry-builder/types'
import {
  candidateFromUsdaFood,
  fetchBestUsdaCoreFood,
  targetsFromProfile,
} from '../lib/pantry-builder/usda-core'
import { usdaFetchPortions } from '../lib/usda/portions'

interface Args {
  apply: boolean
  limit: number | null
  offset: number
  maxInsert: number
  profilePath: string
  runId: string | null
  runFile: string | null
  outputDir: string
  sourceRelease: string
}

interface RunArtifact {
  run_id: string
  generated_at: string
  profile_version: number
  source_release: string
  profile_path: string
  mode: 'dry_run'
  offset: number
  limit: number | null
  profile: PantryProfile
  targets: PantryTarget[]
  candidates: PantryCandidate[]
  counts: Record<string, number>
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    apply: false,
    limit: 25,
    offset: 0,
    maxInsert: 25,
    profilePath: 'data/pantry/luke-food-profile.json',
    runId: null,
    runFile: null,
    outputDir: 'scripts/output',
    sourceRelease: `fdc-api-${new Date().toISOString().slice(0, 10)}`,
  }

  for (const arg of argv.slice(2)) {
    if (arg === '--apply') args.apply = true
    else if (arg === '--full') args.limit = null
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length))
    else if (arg.startsWith('--offset=')) args.offset = Number(arg.slice('--offset='.length))
    else if (arg.startsWith('--max-insert=')) args.maxInsert = Number(arg.slice('--max-insert='.length))
    else if (arg.startsWith('--profile=')) args.profilePath = arg.slice('--profile='.length)
    else if (arg.startsWith('--run-id=')) args.runId = arg.slice('--run-id='.length)
    else if (arg.startsWith('--run-file=')) args.runFile = arg.slice('--run-file='.length)
    else if (arg.startsWith('--output-dir=')) args.outputDir = arg.slice('--output-dir='.length)
    else if (arg.startsWith('--source-release=')) args.sourceRelease = arg.slice('--source-release='.length)
    else throw new Error(`Unknown arg: ${arg}`)
  }
  if (!Number.isInteger(args.offset) || args.offset < 0) throw new Error('--offset must be a non-negative integer')
  if (args.limit != null && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error('--limit must be a positive integer or --full')
  }
  if (!Number.isInteger(args.maxInsert) || args.maxInsert < 1) {
    throw new Error('--max-insert must be a positive integer')
  }
  return args
}

function loadProfile(profilePath: string): PantryProfile {
  const absolute = resolve(profilePath)
  return JSON.parse(readFileSync(absolute, 'utf8')) as PantryProfile
}

function loadEnvLocal() {
  try {
    const content = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
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

function supabaseFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

function formatSupabaseError(error: { message?: string; code?: string; details?: string; hint?: string }) {
  const parts = [error.message, error.code, error.details, error.hint].filter(Boolean)
  return parts.length > 0 ? parts.join(' | ') : JSON.stringify(error)
}

async function loadExistingProducts(): Promise<ExistingProductSummary[]> {
  const supabase = supabaseFromEnv()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand, barcode')
  if (error) throw error
  return (data ?? []) as ExistingProductSummary[]
}

async function assertGovernanceSchema() {
  const supabase = supabaseFromEnv()
  const checks = [
    supabase.from('pantry_import_runs').select('id', { head: true, count: 'exact' }),
    supabase.from('pantry_import_candidates').select('id,target_query', { head: true, count: 'exact' }),
    supabase.from('food_identity_aliases').select('id,normalized_alias', { head: true, count: 'exact' }),
    supabase.from('food_identity_rejections').select('id,normalized_phrase', { head: true, count: 'exact' }),
    supabase
      .from('products')
      .select('id,provenance_source_kind,provenance_external_id,import_confidence,canonical_category', {
        head: true,
        count: 'exact',
      }),
  ]
  const results = await Promise.all(checks)
  const firstError = results.find((result) => result.error)?.error
  if (firstError) {
    throw new Error(`Pantry governance schema is not ready: ${formatSupabaseError(firstError)}`)
  }
}

function countsFor(candidates: PantryCandidate[]): Record<string, number> {
  const counts: Record<string, number> = {
    total: candidates.length,
    auto_approved: 0,
    review_required: 0,
    rejected: 0,
  }
  for (const candidate of candidates) {
    counts[candidate.decision] = (counts[candidate.decision] ?? 0) + 1
    counts[`category:${candidate.category}`] = (counts[`category:${candidate.category}`] ?? 0) + 1
    counts[`source:${candidate.source_kind}`] = (counts[`source:${candidate.source_kind}`] ?? 0) + 1
  }
  return counts
}

function targetsFor(profile: PantryProfile, args: Args): PantryTarget[] {
  const targets = targetsFromProfile(profile, null)
  const end = args.limit == null ? undefined : args.offset + args.limit
  return targets.slice(args.offset, end)
}

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true })
}

function writeArtifact(artifact: RunArtifact, outputDir: string) {
  const absDir = resolve(outputDir)
  ensureDir(absDir)
  const jsonPath = join(absDir, `pantry-builder-${artifact.run_id}.json`)
  const mdPath = join(absDir, `pantry-builder-${artifact.run_id}.md`)
  writeFileSync(jsonPath, JSON.stringify(artifact, null, 2))
  writeFileSync(mdPath, renderMarkdown(artifact))
  console.log(`\nArtifacts:`)
  console.log(`- ${jsonPath}`)
  console.log(`- ${mdPath}`)
}

function renderMarkdown(artifact: RunArtifact): string {
  const renderCandidate = (candidate: PantryCandidate) => {
    const product = candidate.proposed_product
    const macros = `${product.calories_per_serving} cal | ${product.protein_g_per_serving}P | ${product.carbs_g_per_serving}C | ${product.fat_g_per_serving}F`
    const units = candidate.unit_alternatives
      .slice(0, 8)
      .map((unit) => `${unit.unit}=${unit.grams}g`)
      .join(', ')
    const aliases = candidate.aliases.slice(0, 10).join(', ') || 'none'
    const reasons = candidate.reasons.join(', ') || 'none'
    return [
      `### ${candidate.target_query} -> ${candidate.display_name}`,
      ``,
      `- decision: ${candidate.decision}`,
      `- category: ${candidate.category}`,
      `- source: ${candidate.source_kind} / ${candidate.source_dataset ?? 'unknown'} / ${candidate.external_id ?? 'n/a'}`,
      `- macros: ${macros}`,
      `- units (${candidate.unit_alternatives.length}): ${units || 'none'}`,
      `- aliases: ${aliases}`,
      `- risk: ${candidate.risk_score}; reasons: ${reasons}`,
      ``,
    ].join('\n')
  }
  const lines = [
    `# Pantry Builder Dry Run`,
    ``,
    `Run ID: \`${artifact.run_id}\``,
    `Generated: ${artifact.generated_at}`,
    `Profile version: ${artifact.profile_version}`,
    `Profile: ${artifact.profile.name} (${artifact.profile_path})`,
    `Source release: ${artifact.source_release}`,
    `Target window: offset ${artifact.offset}, limit ${artifact.limit ?? 'full'}`,
    ``,
    `## Counts`,
    ``,
    ...Object.entries(artifact.counts).map(([key, value]) => `- ${key}: ${value}`),
    ``,
    `## Auto Approved`,
    ``,
    ...artifact.candidates
      .filter((candidate) => candidate.decision === 'auto_approved')
      .slice(0, 75)
      .map(renderCandidate),
    ``,
    `## Review Required`,
    ``,
    ...artifact.candidates
      .filter((candidate) => candidate.decision === 'review_required')
      .map(renderCandidate),
    ``,
    `## Rejected`,
    ``,
    ...artifact.candidates
      .filter((candidate) => candidate.decision === 'rejected')
      .map(renderCandidate),
    ``,
  ]
  return `${lines.join('\n')}\n`
}

async function buildDryRun(args: Args): Promise<void> {
  const profile = loadProfile(args.profilePath)
  const targets = targetsFor(profile, args)
  const existing = await loadExistingProducts()
  const runId = randomUUID()
  const candidates: PantryCandidate[] = []

  console.log(`Autonomous Pantry Builder dry-run`)
  console.log(`Profile: ${profile.name} (${args.profilePath})`)
  console.log(`Targets: ${targets.length}`)
  console.log(`Window: offset ${args.offset}, limit ${args.limit ?? 'full'}`)
  console.log(`Existing products: ${existing.length}`)

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]
    process.stdout.write(`[${i + 1}/${targets.length}] ${target.query} ... `)
    try {
      const food = await fetchBestUsdaCoreFood(target.query)
      if (!food?.fdcId) {
        console.log('no USDA candidate')
        continue
      }
      const portions = await usdaFetchPortions(food.fdcId)
      const rawCandidate = candidateFromUsdaFood(target, food, profile, portions, args.sourceRelease)
      if (!rawCandidate) {
        console.log('missing macros')
        continue
      }
      const classified = classifyPantryCandidate(rawCandidate, existing, profile.review_only_patterns)
      candidates.push(classified)
      console.log(`${classified.decision} (${classified.display_name})`)
    } catch (err) {
      console.log(`error: ${(err as Error).message}`)
    }
  }

  const artifact: RunArtifact = {
    run_id: runId,
    generated_at: new Date().toISOString(),
    profile_version: profile.version,
    source_release: args.sourceRelease,
    profile_path: args.profilePath,
    mode: 'dry_run',
    offset: args.offset,
    limit: args.limit,
    profile,
    targets,
    candidates,
    counts: countsFor(candidates),
  }

  writeArtifact(artifact, args.outputDir)
  console.log(`\nDecision counts:`, artifact.counts)
}

function readArtifact(path: string): RunArtifact {
  return JSON.parse(readFileSync(path, 'utf8')) as RunArtifact
}

function productInsertPayload(candidate: PantryCandidate, importRunId: string) {
  const product = candidate.proposed_product
  return {
    name: product.name,
    brand: product.brand,
    unit: product.unit,
    serving_size_g: product.serving_size_g,
    calories_per_serving: product.calories_per_serving,
    protein_g_per_serving: product.protein_g_per_serving,
    fat_g_per_serving: product.fat_g_per_serving,
    carbs_g_per_serving: product.carbs_g_per_serving,
    fiber_g_per_serving: product.fiber_g_per_serving,
    fulfillment_source: product.fulfillment_source,
    barcode: product.barcode,
    product_url: product.product_url,
    notes: product.notes,
    tracks_inventory: product.tracks_inventory,
    servings_per_unit: product.servings_per_unit,
    unit_alternatives: product.unit_alternatives,
    fdc_id: product.fdc_id,
    unit_alternatives_updated_at: product.unit_alternatives_updated_at,
    provenance_source_kind: product.provenance_source_kind,
    provenance_dataset: product.provenance_dataset,
    provenance_external_id: product.provenance_external_id,
    provenance_release: product.provenance_release,
    provenance_import_run_id: importRunId,
    import_confidence: product.import_confidence,
    canonical_category: product.canonical_category,
  }
}

async function applyRun(args: Args): Promise<void> {
  if (!args.runId) throw new Error('--apply requires --run-id=<id>')
  if (!args.runFile) throw new Error('--apply requires --run-file=<path>')
  const artifact = readArtifact(args.runFile)
  if (artifact.run_id !== args.runId) {
    throw new Error(`run id mismatch: artifact=${artifact.run_id} arg=${args.runId}`)
  }

  const autoCandidates = artifact.candidates.filter((candidate) => candidate.decision === 'auto_approved')
  const reviewCandidates = artifact.candidates.filter((candidate) => candidate.decision !== 'auto_approved')
  const failedAuto = autoCandidates.filter((candidate) => candidate.risk_score >= 50)
  if (failedAuto.length > 0) {
    throw new Error(`refusing apply: ${failedAuto.length} auto candidates have high risk score`)
  }
  if (autoCandidates.length === 0) throw new Error('refusing apply: no auto-approved candidates')

  const supabase = supabaseFromEnv()
  await assertGovernanceSchema()
  const userId = await getCanonicalUserId(supabase)

  const preflight = await Promise.all(
    autoCandidates.map(async (candidate) => {
      const { data: existing, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('provenance_source_kind', candidate.source_kind)
        .eq('provenance_external_id', candidate.external_id)
        .maybeSingle()
      if (error) throw error
      return { candidate, existing }
    }),
  )
  const insertableCandidates = preflight.filter((entry) => !entry.existing?.id).map((entry) => entry.candidate)
  if (insertableCandidates.length > args.maxInsert) {
    throw new Error(
      `refusing apply: ${insertableCandidates.length} insertable auto-approved candidates exceeds --max-insert=${args.maxInsert}`,
    )
  }

  const { error: runError } = await supabase
    .from('pantry_import_runs')
    .insert({
      id: artifact.run_id,
      mode: 'apply',
      source_kind: 'usda',
      source_release: artifact.source_release,
      profile_version: artifact.profile_version,
      target_count: artifact.targets.length,
      status: 'started',
      candidate_counts: artifact.counts,
      profile: artifact.profile,
      notes: `Autonomous Pantry Builder tiered auto-apply from ${artifact.profile_path}.`,
    })
  if (runError) throw runError

  for (const candidate of artifact.candidates) {
    const { error } = await supabase
      .from('pantry_import_candidates')
      .upsert({
        import_run_id: artifact.run_id,
        candidate_key: candidate.candidate_key,
        target_query: candidate.target_query,
        normalized_name: candidate.normalized_name,
        display_name: candidate.display_name,
        source_kind: candidate.source_kind,
        source_dataset: candidate.source_dataset,
        external_id: candidate.external_id,
        source_release: candidate.source_release,
        category: candidate.category,
        proposed_product: candidate.proposed_product,
        aliases: candidate.aliases,
        rejected_aliases: candidate.rejected_aliases,
        unit_alternatives: candidate.unit_alternatives,
        risk_score: candidate.risk_score,
        decision: candidate.decision,
        reasons: candidate.reasons,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'candidate_key' })
    if (error) throw error
  }

  let inserted = 0
  let skipped = 0
  for (const { candidate, existing } of preflight) {
    if (existing?.id) {
      skipped++
      await supabase
        .from('pantry_import_candidates')
        .update({ decision: 'skipped', applied_product_id: existing.id, updated_at: new Date().toISOString() })
        .eq('candidate_key', candidate.candidate_key)
      continue
    }

    const { data: product, error: insertError } = await supabase
      .from('products')
      .insert(productInsertPayload(candidate, artifact.run_id))
      .select('id, name')
      .single()
    if (insertError) throw insertError

    inserted++
    const sourceRef = `lib:product:${product.id}`
    for (const alias of candidate.aliases) {
      const normalizedAlias = normalizeFoodText(alias)
      if (!normalizedAlias) continue
      const { error: aliasError } = await supabase
        .from('food_identity_aliases')
        .insert({
          target_type: 'product',
          target_id: product.id,
          target_source_ref: sourceRef,
          alias,
          normalized_alias: normalizedAlias,
          alias_type: 'generated',
          confidence: 'high',
          source: 'pantry_builder',
          import_run_id: artifact.run_id,
        })
      if (aliasError && !aliasError.message.includes('duplicate')) throw aliasError
    }

    await supabase
      .from('pantry_import_candidates')
      .update({ decision: 'applied', applied_product_id: product.id, updated_at: new Date().toISOString() })
      .eq('candidate_key', candidate.candidate_key)
  }

  const { error: finishError } = await supabase
    .from('pantry_import_runs')
    .update({
      status: 'completed',
      candidate_counts: {
        ...artifact.counts,
        inserted,
        skipped,
        review_left: reviewCandidates.length,
      },
      finished_at: new Date().toISOString(),
    })
    .eq('id', artifact.run_id)
  if (finishError) throw finishError

  await bustResponseCacheForUser(supabase, userId)
  console.log(`Applied run ${artifact.run_id}`)
  console.log(`Inserted: ${inserted}`)
  console.log(`Skipped existing: ${skipped}`)
  console.log(`Review-left: ${reviewCandidates.length}`)
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv)
  if (args.apply) await applyRun(args)
  else await buildDryRun(args)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
