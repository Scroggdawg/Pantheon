// Read-only protein shake composition contract report.
//
// Usage:
//   npx tsx scripts/report-protein-shake-composition-contract.ts
//   npx tsx scripts/report-protein-shake-composition-contract.ts --json
//
// This script audits whether protein shake identity is moving toward the
// intended model: ingredient facts plus friendly common shortcuts, not one
// saved/product identity per quantity combination. It does not mutate data.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createClient } from '@supabase/supabase-js'

interface ProductRow {
  id: string
  name: string | null
  brand: string | null
  unit: string | null
  serving_size_g: number | null
  calories_per_serving: number | null
  protein_g_per_serving: number | null
  carbs_g_per_serving: number | null
  fat_g_per_serving: number | null
  canonical_category: string | null
  provenance_source_kind: string | null
  provenance_external_id: string | null
  unit_alternatives?: unknown
}

interface FoodLike {
  name?: string | null
  qty?: number | null
  unit?: string | null
  source_ref?: string | null
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
}

interface FoodLogEntryRow {
  id: string
  raw_input_text: string | null
  foods_json: FoodLike[] | null
  total_calories: number | null
  created_at: string
}

interface FoodLogEventRow {
  id: string
  event_type: string
  raw_input_text: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

interface AliasRow {
  normalized_alias?: string | null
  alias?: string | null
  target_source_ref?: string | null
  target_type?: string | null
  active?: boolean | null
}

interface ContractPacket {
  priority: 'P1' | 'P2' | 'P3'
  title: string
  plain_english: string
  evidence: string[]
  next_action: string
  stop_rule: string
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

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function asFoods(value: unknown): FoodLike[] {
  return Array.isArray(value) ? (value as FoodLike[]) : []
}

function unitAltCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

function productRef(product: ProductRow): string {
  return `lib:product:${product.id}`
}

function macroSummary(product: ProductRow): string {
  return `${product.calories_per_serving ?? '?'} cal / ${product.protein_g_per_serving ?? '?'}P / ${product.carbs_g_per_serving ?? '?'}C / ${product.fat_g_per_serving ?? '?'}F per ${product.unit ?? 'serving'}`
}

function foodSummary(food: FoodLike): string {
  return `${food.name ?? '(unnamed)'} x${food.qty ?? '?'} ${food.unit ?? 'unit'} ${food.calories ?? '?'} cal${food.source_ref ? ` [${food.source_ref}]` : ''}`
}

function textHasAny(value: string | null | undefined, terms: string[]): boolean {
  const normalized = normalize(value)
  return terms.some((term) => normalized.includes(term))
}

function expectedComponents(transcript: string): { proteinScoops: number; dextroseServings: number } {
  const text = normalize(transcript)
  const proteinScoops = /\b(double|two|2)\s+(?:scoop|scoops|protein)/.test(text) ? 2 : 1
  let dextroseServings = 0
  if (/\b(no|without)\s+dextrose\b/.test(text) || /\bwith\s+no\s+dextrose\b/.test(text)) {
    dextroseServings = 0
  } else if (/\bhalf\b.*\bdextrose\b|\bdextrose\b.*\bhalf\b/.test(text)) {
    dextroseServings = 0.5
  } else if (/\b(double|two|2)\s+(?:servings?\s+(?:of\s+)?)?(?:nutricost\s+)?dextrose\b/.test(text)) {
    dextroseServings = 2
  } else if (/\bdextrose\b/.test(text)) {
    dextroseServings = 1
  }
  return { proteinScoops, dextroseServings }
}

function buildPackets(args: {
  isopureProducts: ProductRow[]
  dextroseProducts: ProductRow[]
  shortcutProducts: ProductRow[]
  recentShakeEntries: FoodLogEntryRow[]
  shortcutCodePresent: boolean
  aliases: AliasRow[]
}): ContractPacket[] {
  const packets: ContractPacket[] = []

  if (args.isopureProducts.length === 0 || args.dextroseProducts.length === 0) {
    packets.push({
      priority: 'P1',
      title: 'Verify ingredient product identities',
      plain_english: 'Protein shake composition needs real ingredient rows for Isopure protein and Nutricost dextrose.',
      evidence: [
        `isopure_products: ${args.isopureProducts.length}`,
        `dextrose_products: ${args.dextroseProducts.length}`,
      ],
      next_action: 'Create or verify reviewed ingredient product identities before changing parse behavior.',
      stop_rule: 'Do not solve missing ingredient facts by creating more opaque shake shortcuts.',
    })
  }

  const dextrose = args.dextroseProducts[0]
  if (dextrose && typeof dextrose.carbs_g_per_serving === 'number' && Math.abs(dextrose.carbs_g_per_serving - 18) > 1) {
    packets.push({
      priority: 'P1',
      title: 'Reconcile Nutricost dextrose serving facts',
      plain_english: 'Luke described dextrose as 18g carbs per serving, but the current product surface appears different.',
      evidence: [`${dextrose.name}: ${macroSummary(dextrose)} serving_size_g=${dextrose.serving_size_g ?? '(none)'}`],
      next_action: 'Verify the real label serving and decide whether Pantheon should model Luke-serving as 18g carbs or label-serving as stored.',
      stop_rule: 'Do not create half/full/double shake facts until the dextrose base serving is settled.',
    })
  }

  if (args.shortcutProducts.length > 3) {
    packets.push({
      priority: 'P2',
      title: 'Prevent protein shake shortcut sprawl',
      plain_english: 'There are more shake shortcut products than the three common no/half/full shortcuts. That can become quantity sprawl.',
      evidence: args.shortcutProducts.map((product) => `${product.name} [${productRef(product)}]`).slice(0, 8),
      next_action: 'Keep only reviewed common shortcuts; route custom or double quantities to ingredient rows.',
      stop_rule: 'Do not add one durable product/saved meal per custom scoop or dextrose quantity.',
    })
  }

  if (!args.shortcutCodePresent) {
    packets.push({
      priority: 'P2',
      title: 'Add parser shortcut support for ingredient composition',
      plain_english: 'The code audit did not find the ingredient shortcut path, so custom shake phrases may still fall back to vague matching.',
      evidence: ['Expected shortcut code marker was not found in parse-meal-library-shortcut.ts.'],
      next_action: 'Add or verify parser support for Isopure plus Nutricost component rows.',
      stop_rule: 'Do not rely on broad aliases to old protein shake names.',
    })
  }

  const duplicateShakeRows = args.recentShakeEntries.filter((entry) => {
    const shakeFoods = asFoods(entry.foods_json).filter((food) => normalize(food.name).includes('protein shake'))
    return shakeFoods.length > 1
  })
  if (duplicateShakeRows.length > 0) {
    packets.push({
      priority: 'P1',
      title: 'Watch duplicate protein shake rows in saved logs',
      plain_english: 'Some protein shake logs contain more than one shake-looking row. That matches Luke’s reported duplicate-shake failure mode.',
      evidence: duplicateShakeRows.slice(0, 5).map((entry) => `${entry.created_at}: ${asFoods(entry.foods_json).map(foodSummary).join(' | ')}`),
      next_action: 'Use these as regression fixtures before any future parser change.',
      stop_rule: 'Do not consider the shake lane fixed if one spoken shake can still produce two shake rows.',
    })
  }

  const staleShakeRows = args.recentShakeEntries.filter((entry) =>
    asFoods(entry.foods_json).some((food) => {
      const name = normalize(food.name)
      return name.includes('protein shake a') || name.includes('pre workout')
    }),
  )
  if (staleShakeRows.length > 0) {
    packets.push({
      priority: 'P1',
      title: 'Retire stale Protein Shake A live candidates',
      plain_english: 'Old A/B protein shake names still appear in historical saved logs and should not be emitted as live candidates.',
      evidence: staleShakeRows.slice(0, 5).map((entry) => `${entry.created_at}: ${asFoods(entry.foods_json).map(foodSummary).join(' | ')}`),
      next_action: 'Keep stale names as history only; parser/search should prefer current no/half/with dextrose shortcuts or ingredient rows.',
      stop_rule: 'Do not let Protein Shake A - Pre-Workout appear in new live parse choices.',
    })
  }

  const hourlyIngredientRows = args.recentShakeEntries.filter((entry) =>
    asFoods(entry.foods_json).some((food) => food.source_ref?.startsWith('lib:hourly_go_to:') && textHasAny(food.name, ['isopure', 'dextrose', 'protein'])),
  )
  if (hourlyIngredientRows.length > 0) {
    packets.push({
      priority: 'P2',
      title: 'Keep shake ingredients on durable product refs',
      plain_english: 'Recent shake-adjacent logs still show hourly wrapper refs for protein ingredients. That weakens learning and hearts.',
      evidence: hourlyIngredientRows.slice(0, 5).map((entry) => `${entry.created_at}: ${asFoods(entry.foods_json).map(foodSummary).join(' | ')}`),
      next_action: 'Use product refs for Isopure and Nutricost ingredients when emitted in new parses.',
      stop_rule: 'Do not preserve hourly wrapper refs as durable ingredient identities.',
    })
  }

  const broadShakeAliases = args.aliases.filter((alias) => {
    const aliasText = normalize(alias.normalized_alias ?? alias.alias)
    const target = alias.target_source_ref ?? ''
    return aliasText.includes('protein shake') && !aliasText.includes('dextrose') && target.includes('protein')
  })
  if (broadShakeAliases.length > 0) {
    packets.push({
      priority: 'P3',
      title: 'Review broad protein shake aliases',
      plain_english: 'Broad protein-shake aliases are useful only if they do not hide no/half/full dextrose intent.',
      evidence: broadShakeAliases.slice(0, 6).map((alias) => `${alias.normalized_alias ?? alias.alias ?? '(alias?)'} -> ${alias.target_source_ref ?? '(target?)'}`),
      next_action: 'Make sure plain protein shake defaults do not override explicit no/half/full/double dextrose phrases.',
      stop_rule: 'Do not let a broad alias route over a more specific dextrose phrase.',
    })
  }

  return packets.sort((a, b) => {
    const priority = { P1: 3, P2: 2, P3: 1 }
    return priority[b.priority] - priority[a.priority] || a.title.localeCompare(b.title)
  })
}

function render(args: {
  isopureProducts: ProductRow[]
  dextroseProducts: ProductRow[]
  shortcutProducts: ProductRow[]
  recentShakeEntries: FoodLogEntryRow[]
  recentShakeEvents: FoodLogEventRow[]
  aliases: AliasRow[]
  shortcutCodePresent: boolean
  packets: ContractPacket[]
}): string {
  const fixturePhrases = [
    'protein shake no dextrose',
    'protein shake half dextrose',
    'protein shake with dextrose',
    'double protein shake no dextrose',
    'two scoop protein shake with half dextrose',
    'protein shake with one and a half scoops protein and half dextrose',
  ]

  const lines: string[] = []
  lines.push('Protein Shake Composition Contract Report')
  lines.push('')
  lines.push('Summary')
  lines.push(`- isopure_products: ${args.isopureProducts.length}`)
  lines.push(`- dextrose_products: ${args.dextroseProducts.length}`)
  lines.push(`- shake_shortcut_products: ${args.shortcutProducts.length}`)
  lines.push(`- protein_shake_aliases: ${args.aliases.length}`)
  lines.push(`- recent_shake_logs: ${args.recentShakeEntries.length}`)
  lines.push(`- recent_shake_events: ${args.recentShakeEvents.length}`)
  lines.push(`- ingredient_shortcut_code_present: ${args.shortcutCodePresent ? 'yes' : 'no'}`)
  lines.push('')
  lines.push('Ingredient Products')
  for (const product of [...args.isopureProducts, ...args.dextroseProducts]) {
    lines.push(`- ${product.name} | ${macroSummary(product)} | unit_alts=${unitAltCount(product.unit_alternatives)} | ${productRef(product)}`)
  }
  if (args.isopureProducts.length + args.dextroseProducts.length === 0) lines.push('- (none)')
  lines.push('')
  lines.push('Common Shortcut Products')
  for (const product of args.shortcutProducts) {
    lines.push(`- ${product.name} | ${macroSummary(product)} | unit_alts=${unitAltCount(product.unit_alternatives)} | ${productRef(product)}`)
  }
  if (args.shortcutProducts.length === 0) lines.push('- (none)')
  lines.push('')
  lines.push('Expected Phrase Contract')
  for (const phrase of fixturePhrases) {
    const expected = expectedComponents(phrase)
    lines.push(`- "${phrase}" -> Isopure ${expected.proteinScoops} scoop(s), Nutricost dextrose ${expected.dextroseServings} serving(s)`)
  }
  lines.push('')
  lines.push('Recent Protein Shake Logs')
  for (const entry of args.recentShakeEntries.slice(0, 8)) {
    lines.push(`- ${entry.created_at}: ${entry.raw_input_text ?? '(no raw input)'} -> ${asFoods(entry.foods_json).map(foodSummary).join(' | ')}`)
  }
  if (args.recentShakeEntries.length === 0) lines.push('- (none)')
  lines.push('')
  lines.push('Contract Packets')
  for (const [index, packet] of args.packets.entries()) {
    lines.push(`${index + 1}. [${packet.priority}] ${packet.title}`)
    lines.push(`   - plain_english: ${packet.plain_english}`)
    lines.push(`   - next_action: ${packet.next_action}`)
    lines.push(`   - stop_rule: ${packet.stop_rule}`)
    lines.push(`   - evidence: ${packet.evidence.slice(0, 3).join(' | ') || '(none)'}`)
  }
  if (args.packets.length === 0) lines.push('- No active contract risks found.')
  return lines.join('\n')
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')

  const shortcutPath = join(__dirname, '..', 'lib', 'claude', 'parse-meal-library-shortcut.ts')
  const shortcutSource = existsSync(shortcutPath) ? readFileSync(shortcutPath, 'utf8') : ''
  const normalizedShortcutSource = shortcutSource.toLowerCase()
  const shortcutCodePresent =
    shortcutSource.includes('isIsopureShakeIngredientShortcutTranscript') &&
    normalizedShortcutSource.includes('nutricost') &&
    normalizedShortcutSource.includes('dextroseintent')

  const supabase = createClient(url, key)
  const [productsRes, aliasesRes, entriesRes, eventsRes] = await Promise.all([
    supabase
      .from('products')
      .select('id,name,brand,unit,serving_size_g,calories_per_serving,protein_g_per_serving,carbs_g_per_serving,fat_g_per_serving,canonical_category,provenance_source_kind,provenance_external_id,unit_alternatives')
      .order('name', { ascending: true }),
    supabase
      .from('food_identity_aliases')
      .select('*')
      .eq('active', true),
    supabase
      .from('food_log_entries')
      .select('id,raw_input_text,foods_json,total_calories,created_at')
      .or('raw_input_text.ilike.%protein shake%,raw_input_text.ilike.%isopure%,raw_input_text.ilike.%dextrose%')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('food_log_events')
      .select('id,event_type,raw_input_text,payload,created_at')
      .or('raw_input_text.ilike.%protein shake%,raw_input_text.ilike.%isopure%,raw_input_text.ilike.%dextrose%')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (productsRes.error) throw new Error(`products query failed: ${productsRes.error.message}`)
  if (entriesRes.error) throw new Error(`food_log_entries query failed: ${entriesRes.error.message}`)

  const products = (productsRes.data ?? []) as ProductRow[]
  const aliases = aliasesRes.error ? [] : ((aliasesRes.data ?? []) as AliasRow[])
  const recentShakeEntries = (entriesRes.data ?? []) as FoodLogEntryRow[]
  const recentShakeEvents = eventsRes.error ? [] : ((eventsRes.data ?? []) as FoodLogEventRow[])

  const isopureProducts = products.filter((product) => textHasAny(product.name, ['isopure']) && !textHasAny(product.name, ['protein shake']))
  const dextroseProducts = products.filter((product) => textHasAny(product.name, ['dextrose']) && !textHasAny(product.name, ['protein shake']))
  const shortcutProducts = products.filter((product) => textHasAny(product.name, ['protein shake']))
  const proteinShakeAliases = aliases.filter((alias) => textHasAny(alias.normalized_alias ?? alias.alias, ['protein shake', 'isopure', 'dextrose', 'nutricost']))
  const packets = buildPackets({
    isopureProducts,
    dextroseProducts,
    shortcutProducts,
    recentShakeEntries,
    shortcutCodePresent,
    aliases: proteinShakeAliases,
  })

  console.log(render({
    isopureProducts,
    dextroseProducts,
    shortcutProducts,
    recentShakeEntries,
    recentShakeEvents,
    aliases: proteinShakeAliases,
    shortcutCodePresent,
    packets,
  }))

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({
      summary: {
        isopure_products: isopureProducts.length,
        dextrose_products: dextroseProducts.length,
        shake_shortcut_products: shortcutProducts.length,
        protein_shake_aliases: proteinShakeAliases.length,
        recent_shake_logs: recentShakeEntries.length,
        recent_shake_events: recentShakeEvents.length,
        ingredient_shortcut_code_present: shortcutCodePresent,
      },
      isopureProducts,
      dextroseProducts,
      shortcutProducts,
      recentShakeEntries,
      packets,
    }, null, 2))
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
