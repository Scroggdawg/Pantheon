import type { SupabaseClient } from '@supabase/supabase-js'

import { applyBrandAliases } from '@/lib/brand-voice-aliases'
import type { FoodItem, UnitAlternative } from '@/types/database'

import { guardedLibraryNameSimilarity } from './tools/search-user-library'

export type FoodIdentityType =
  | 'saved_meal'
  | 'product'
  | 'recipe'
  | 'barcode_product'
  | 'external_food'
  | 'history_signal'

export type FoodIdentityAuthority =
  | 'user_corrected'
  | 'saved_meal'
  | 'recipe'
  | 'product'
  | 'barcode'
  | 'off'
  | 'usda'
  | 'llm_estimated'
  | 'history_signal'

export type ResolverOutcome =
  | 'resolved_high'
  | 'needs_choice'
  | 'needs_review'
  | 'estimated'
  | 'fallback_required'

export interface FoodIdentityDocument {
  identity_id: string
  identity_type: FoodIdentityType
  canonical_source_ref: string | null
  display_name: string
  brand: string | null
  restaurant: string | null
  aliases: string[]
  rejected_aliases: string[]
  search_text: string
  identity_tokens: string[]
  context_tokens: string[]
  macros_per_serving: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  } | null
  serving: {
    qty: number
    unit: string
    grams: number | null
  } | null
  unit_alternatives: UnitAlternative[]
  components: Array<{
    name: string
    qty: number
    unit: string
    source_ref: string | null
  }>
  authority: FoodIdentityAuthority
  ranking_signals: {
    is_favorite: boolean
    times_logged: number
    last_logged_at: string | null
    hourly_weight: number
    source_priority: number
    correction_weight: number
  }
  safety: {
    generic_overmatch_guard: boolean
    requires_review: boolean
    can_auto_commit: boolean
    warnings: string[]
  }
  index_version: number
  updated_at: string | null
}

export interface IdentitySearchHit {
  document: FoodIdentityDocument
  score: number
  text_score: number
  outcome: ResolverOutcome
  warnings: string[]
}

interface SavedMealRow {
  id: string
  name: string | null
  foods_json: FoodItem[] | null
  total_calories: number | null
  total_protein_g: number | null
  total_carbs_g: number | null
  total_fat_g: number | null
  yield_servings: number | null
  times_logged: number | null
  last_logged_at: string | null
  tags: string[] | null
  is_favorite: boolean | null
  created_at: string | null
}

interface ProductRow {
  id: string
  name: string
  brand: string | null
  unit: string
  serving_size_g: number | null
  calories_per_serving: number
  protein_g_per_serving: number
  fat_g_per_serving: number
  carbs_g_per_serving: number
  barcode: string | null
  updated_at: string | null
  unit_alternatives: UnitAlternative[] | null
}

interface RecipeRow {
  id: string
  name: string
  servings: number
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  ingredients: Array<{ name?: string; qty?: number; unit?: string }> | null
  cuisine: string | null
  protein_type: string | null
  updated_at: string | null
}

interface HourlyGoToRow {
  dedup_name: string
  dedup_source_ref: string
  name: string
  source_ref: string | null
  weight: number
  total_logs: number
  last_logged_at: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  qty: number | null
  unit: string | null
}

interface IdentityAliasRow {
  target_source_ref: string
  alias: string
}

interface IdentityRejectionRow {
  rejected_source_ref: string
  phrase: string
}

interface IdentityLearning {
  aliasesByRef: Map<string, string[]>
  rejectionsByRef: Map<string, string[]>
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokensFor(...values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values
        .flatMap((value) => normalize(value).split(' '))
        .filter((token) => token.length > 0),
    ),
  ]
}

function sourcePriority(authority: FoodIdentityAuthority): number {
  switch (authority) {
    case 'user_corrected':
      return 1
    case 'saved_meal':
    case 'recipe':
      return 2
    case 'product':
    case 'barcode':
      return 3
    case 'off':
    case 'usda':
      return 4
    case 'llm_estimated':
      return 5
    case 'history_signal':
      return 6
  }
}

function macros(
  calories: number | null | undefined,
  protein_g: number | null | undefined,
  carbs_g: number | null | undefined,
  fat_g: number | null | undefined,
): FoodIdentityDocument['macros_per_serving'] {
  if (calories == null && protein_g == null && carbs_g == null && fat_g == null) {
    return null
  }
  return {
    calories: Number(calories ?? 0),
    protein_g: Number(protein_g ?? 0),
    carbs_g: Number(carbs_g ?? 0),
    fat_g: Number(fat_g ?? 0),
  }
}

function savedMealUnitAlternatives(foods: FoodItem[] | null): UnitAlternative[] {
  if (!Array.isArray(foods) || foods.length !== 1) return []
  return foods[0]?.unit_alternatives ?? []
}

function savedMealDocument(row: SavedMealRow): FoodIdentityDocument {
  const yieldServings = row.yield_servings && row.yield_servings > 0 ? row.yield_servings : 1
  const displayName = row.name ?? ''
  const aliases = row.tags ?? []
  return {
    identity_id: `saved_meal:${row.id}`,
    identity_type: 'saved_meal',
    canonical_source_ref: `lib:saved_meal:${row.id}`,
    display_name: displayName,
    brand: null,
    restaurant: null,
    aliases,
    rejected_aliases: [],
    search_text: [displayName, ...aliases].join(' '),
    identity_tokens: tokensFor(displayName, ...aliases),
    context_tokens: [],
    macros_per_serving: {
      calories: Math.round(Number(row.total_calories ?? 0) / yieldServings),
      protein_g: Math.round((Number(row.total_protein_g ?? 0) / yieldServings) * 10) / 10,
      carbs_g: Math.round((Number(row.total_carbs_g ?? 0) / yieldServings) * 10) / 10,
      fat_g: Math.round((Number(row.total_fat_g ?? 0) / yieldServings) * 10) / 10,
    },
    serving: { qty: 1, unit: 'serving', grams: null },
    unit_alternatives: savedMealUnitAlternatives(row.foods_json),
    components: (row.foods_json ?? []).map((food) => ({
      name: food.name,
      qty: food.qty,
      unit: food.unit,
      source_ref: food.source_ref ?? null,
    })),
    authority: 'saved_meal',
    ranking_signals: {
      is_favorite: row.is_favorite === true,
      times_logged: Number(row.times_logged ?? 0),
      last_logged_at: row.last_logged_at,
      hourly_weight: 0,
      source_priority: sourcePriority('saved_meal'),
      correction_weight: 0,
    },
    safety: {
      generic_overmatch_guard: true,
      requires_review: false,
      can_auto_commit: true,
      warnings: [],
    },
    index_version: 1,
    updated_at: row.created_at,
  }
}

function productDocument(row: ProductRow): FoodIdentityDocument {
  const displayName =
    row.brand && !row.name.toLowerCase().startsWith(row.brand.toLowerCase())
      ? `${row.brand} ${row.name}`
      : row.name
  const authority: FoodIdentityAuthority = row.barcode ? 'barcode' : 'product'
  return {
    identity_id: `product:${row.id}`,
    identity_type: row.barcode ? 'barcode_product' : 'product',
    canonical_source_ref: `lib:product:${row.id}`,
    display_name: displayName,
    brand: row.brand,
    restaurant: null,
    aliases: row.barcode ? [row.barcode] : [],
    rejected_aliases: [],
    search_text: [displayName, row.brand, row.barcode].filter(Boolean).join(' '),
    identity_tokens: tokensFor(displayName, row.brand),
    context_tokens: row.brand ? tokensFor(row.brand) : [],
    macros_per_serving: macros(
      row.calories_per_serving,
      row.protein_g_per_serving,
      row.carbs_g_per_serving,
      row.fat_g_per_serving,
    ),
    serving: {
      qty: 1,
      unit: row.unit,
      grams: row.serving_size_g,
    },
    unit_alternatives: row.unit_alternatives ?? [],
    components: [
      {
        name: displayName,
        qty: 1,
        unit: row.unit,
        source_ref: `lib:product:${row.id}`,
      },
    ],
    authority,
    ranking_signals: {
      is_favorite: false,
      times_logged: 0,
      last_logged_at: null,
      hourly_weight: 0,
      source_priority: sourcePriority(authority),
      correction_weight: 0,
    },
    safety: {
      generic_overmatch_guard: true,
      requires_review: false,
      can_auto_commit: true,
      warnings: [],
    },
    index_version: 1,
    updated_at: row.updated_at,
  }
}

function recipeDocument(row: RecipeRow): FoodIdentityDocument {
  const servings = row.servings > 0 ? row.servings : 1
  return {
    identity_id: `recipe:${row.id}`,
    identity_type: 'recipe',
    canonical_source_ref: `recipe:${row.id}`,
    display_name: row.name,
    brand: null,
    restaurant: null,
    aliases: [row.cuisine, row.protein_type].filter((x): x is string => Boolean(x)),
    rejected_aliases: [],
    search_text: [row.name, row.cuisine, row.protein_type].filter(Boolean).join(' '),
    identity_tokens: tokensFor(row.name),
    context_tokens: tokensFor(row.cuisine, row.protein_type),
    macros_per_serving: macros(
      row.calories == null ? null : Number(row.calories) / servings,
      row.protein_g == null ? null : Number(row.protein_g) / servings,
      row.carbs_g == null ? null : Number(row.carbs_g) / servings,
      row.fat_g == null ? null : Number(row.fat_g) / servings,
    ),
    serving: { qty: 1, unit: 'serving', grams: null },
    unit_alternatives: [],
    components: (row.ingredients ?? []).map((ingredient) => ({
      name: ingredient.name ?? 'Ingredient',
      qty: Number(ingredient.qty ?? 1),
      unit: ingredient.unit ?? 'serving',
      source_ref: null,
    })),
    authority: 'recipe',
    ranking_signals: {
      is_favorite: false,
      times_logged: 0,
      last_logged_at: null,
      hourly_weight: 0,
      source_priority: sourcePriority('recipe'),
      correction_weight: 0,
    },
    safety: {
      generic_overmatch_guard: true,
      requires_review: true,
      can_auto_commit: false,
      warnings: ['recipe_identity_not_live_in_parse_yet'],
    },
    index_version: 1,
    updated_at: row.updated_at,
  }
}

function hourlyDocument(row: HourlyGoToRow): FoodIdentityDocument {
  const canonicalRef =
    row.source_ref?.startsWith('lib:saved_meal:') || row.source_ref?.startsWith('lib:product:')
      ? row.source_ref
      : null
  return {
    identity_id: `history:${Buffer.from(`${row.dedup_name}|${row.dedup_source_ref}`).toString('base64url')}`,
    identity_type: 'history_signal',
    canonical_source_ref: canonicalRef,
    display_name: row.name,
    brand: null,
    restaurant: null,
    aliases: [],
    rejected_aliases: [],
    search_text: row.name,
    identity_tokens: tokensFor(row.name),
    context_tokens: [],
    macros_per_serving: macros(row.calories, row.protein_g, row.carbs_g, row.fat_g),
    serving: {
      qty: Number(row.qty ?? 1),
      unit: row.unit ?? 'serving',
      grams: null,
    },
    unit_alternatives: [],
    components: [
      {
        name: row.name,
        qty: Number(row.qty ?? 1),
        unit: row.unit ?? 'serving',
        source_ref: row.source_ref,
      },
    ],
    authority: 'history_signal',
    ranking_signals: {
      is_favorite: false,
      times_logged: Number(row.total_logs ?? 0),
      last_logged_at: row.last_logged_at,
      hourly_weight: Number(row.weight ?? 0),
      source_priority: sourcePriority('history_signal'),
      correction_weight: 0,
    },
    safety: {
      generic_overmatch_guard: true,
      requires_review: !canonicalRef,
      can_auto_commit: Boolean(canonicalRef),
      warnings: canonicalRef ? ['history_signal_points_to_canonical'] : ['history_signal_only'],
    },
    index_version: 1,
    updated_at: row.last_logged_at,
  }
}

async function loadIdentityLearning(supabase: SupabaseClient): Promise<IdentityLearning> {
  const aliasesByRef = new Map<string, string[]>()
  const rejectionsByRef = new Map<string, string[]>()
  const isMissingGovernanceTable = (error: { code?: string; message?: string }) =>
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /food_identity_(aliases|rejections)|does not exist|could not find/i.test(error.message ?? '')

  const [aliasesRes, rejectionsRes] = await Promise.all([
    supabase
      .from('food_identity_aliases')
      .select('target_source_ref, alias')
      .eq('active', true),
    supabase
      .from('food_identity_rejections')
      .select('rejected_source_ref, phrase')
      .eq('active', true),
  ])

  if (aliasesRes.error && !isMissingGovernanceTable(aliasesRes.error)) {
    console.warn('[food-identity] aliases unavailable:', aliasesRes.error.message)
  } else if (!aliasesRes.error) {
    for (const row of (aliasesRes.data ?? []) as IdentityAliasRow[]) {
      const existing = aliasesByRef.get(row.target_source_ref) ?? []
      existing.push(row.alias)
      aliasesByRef.set(row.target_source_ref, existing)
    }
  }

  if (rejectionsRes.error && !isMissingGovernanceTable(rejectionsRes.error)) {
    console.warn('[food-identity] rejections unavailable:', rejectionsRes.error.message)
  } else if (!rejectionsRes.error) {
    for (const row of (rejectionsRes.data ?? []) as IdentityRejectionRow[]) {
      const existing = rejectionsByRef.get(row.rejected_source_ref) ?? []
      existing.push(row.phrase)
      rejectionsByRef.set(row.rejected_source_ref, existing)
    }
  }

  return { aliasesByRef, rejectionsByRef }
}

function applyIdentityLearning(
  doc: FoodIdentityDocument,
  learning: IdentityLearning,
): FoodIdentityDocument {
  if (!doc.canonical_source_ref) return doc

  const learnedAliases = learning.aliasesByRef.get(doc.canonical_source_ref) ?? []
  const learnedRejections = learning.rejectionsByRef.get(doc.canonical_source_ref) ?? []
  if (learnedAliases.length === 0 && learnedRejections.length === 0) return doc

  const aliases = [...new Set([...doc.aliases, ...learnedAliases])]
  const rejectedAliases = [...new Set([...doc.rejected_aliases, ...learnedRejections])]
  return {
    ...doc,
    aliases,
    rejected_aliases: rejectedAliases,
    search_text: [doc.display_name, ...aliases].join(' '),
    identity_tokens: tokensFor(doc.display_name, ...aliases),
  }
}

export async function buildFoodIdentityDocuments(
  supabase: SupabaseClient,
  userId: string,
  targetHour = new Date().getUTCHours(),
): Promise<FoodIdentityDocument[]> {
  const [mealsRes, productsRes, recipesRes, hourlyRes] = await Promise.all([
    supabase
      .from('saved_meals')
      .select(
        'id, name, foods_json, total_calories, total_protein_g, total_carbs_g, total_fat_g, yield_servings, times_logged, last_logged_at, tags, is_favorite, created_at',
      )
      .eq('user_id', userId),
    supabase
      .from('products')
      .select(
        'id, name, brand, unit, serving_size_g, calories_per_serving, protein_g_per_serving, fat_g_per_serving, carbs_g_per_serving, barcode, updated_at, unit_alternatives',
      ),
    supabase
      .from('recipes')
      .select('id, name, servings, calories, protein_g, carbs_g, fat_g, ingredients, cuisine, protein_type, updated_at'),
    supabase
      .from('hourly_go_tos')
      .select(
        'dedup_name, dedup_source_ref, name, source_ref, weight, total_logs, last_logged_at, calories, protein_g, carbs_g, fat_g, qty, unit',
      )
      .eq('user_id', userId)
      .eq('target_hour', targetHour),
  ])

  if (mealsRes.error) throw mealsRes.error
  if (productsRes.error) throw productsRes.error
  if (recipesRes.error) throw recipesRes.error
  if (hourlyRes.error) throw hourlyRes.error
  const learning = await loadIdentityLearning(supabase)

  const docs = [
    ...((mealsRes.data ?? []) as SavedMealRow[]).map(savedMealDocument),
    ...((productsRes.data ?? []) as ProductRow[]).map(productDocument),
    ...((recipesRes.data ?? []) as RecipeRow[]).map(recipeDocument),
    ...((hourlyRes.data ?? []) as HourlyGoToRow[]).map(hourlyDocument),
  ].map((doc) => applyIdentityLearning(doc, learning))

  return dedupeIdentityDocuments(docs)
}

export function dedupeIdentityDocuments(docs: FoodIdentityDocument[]): FoodIdentityDocument[] {
  const byCanonical = new Map<string, FoodIdentityDocument>()
  const output: FoodIdentityDocument[] = []

  for (const doc of docs) {
    if (!doc.canonical_source_ref) {
      output.push(doc)
      continue
    }

    const existing = byCanonical.get(doc.canonical_source_ref)
    if (!existing) {
      byCanonical.set(doc.canonical_source_ref, doc)
      output.push(doc)
      continue
    }

    const winner = betterIdentityDocument(doc, existing)
    if (winner !== existing) {
      byCanonical.set(doc.canonical_source_ref, winner)
      const index = output.indexOf(existing)
      if (index >= 0) output[index] = winner
    }
  }

  return output
}

function betterIdentityDocument(
  next: FoodIdentityDocument,
  existing: FoodIdentityDocument,
): FoodIdentityDocument {
  if (next.ranking_signals.source_priority < existing.ranking_signals.source_priority) return next
  if (next.ranking_signals.source_priority > existing.ranking_signals.source_priority) return existing
  if (next.ranking_signals.is_favorite && !existing.ranking_signals.is_favorite) return next
  if (!next.ranking_signals.is_favorite && existing.ranking_signals.is_favorite) return existing
  return next.ranking_signals.times_logged > existing.ranking_signals.times_logged ? next : existing
}

export function searchFoodIdentityDocuments(
  query: string,
  docs: FoodIdentityDocument[],
  options: { minScore?: number; limit?: number } = {},
): IdentitySearchHit[] {
  const minScore = options.minScore ?? 0.5
  const limit = options.limit ?? 5
  const { substituted } = applyBrandAliases(query)
  const normalizedQuery = normalize(substituted)

  const hits = docs
    .map((doc): IdentitySearchHit | null => {
      if (doc.rejected_aliases.some((alias) => normalize(alias) === normalizedQuery)) return null
      const textScore = guardedLibraryNameSimilarity(substituted, doc.search_text, doc.aliases)
      if (textScore < minScore) return null
      const boost =
        (doc.ranking_signals.is_favorite ? 0.03 : 0)
        + Math.min(doc.ranking_signals.hourly_weight, 1) * 0.03
        + Math.min(doc.ranking_signals.times_logged, 10) * 0.002
        - (doc.ranking_signals.source_priority - 1) * 0.004
      const score = Math.max(0, Math.min(1, Math.round((textScore + boost) * 1000) / 1000))
      return {
        document: doc,
        score,
        text_score: textScore,
        outcome: 'needs_review',
        warnings: doc.safety.warnings,
      }
    })
    .filter((hit): hit is IdentitySearchHit => hit !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return classifyHits(hits)
}

function classifyHits(hits: IdentitySearchHit[]): IdentitySearchHit[] {
  if (hits.length === 0) return []

  const top = hits[0]
  const second = hits[1]
  const gap = second ? top.score - second.score : 1
  let outcome: ResolverOutcome

  if (!top.document.safety.can_auto_commit || top.document.safety.requires_review) {
    outcome = top.document.authority === 'llm_estimated' ? 'estimated' : 'needs_review'
  } else if (top.score >= 0.85 && gap >= 0.1 && top.document.canonical_source_ref) {
    outcome = 'resolved_high'
  } else if (second && top.score >= 0.7 && gap < 0.1) {
    outcome = 'needs_choice'
  } else if (top.score >= 0.7) {
    outcome = 'needs_review'
  } else {
    outcome = 'fallback_required'
  }

  return hits.map((hit, index) => ({
    ...hit,
    outcome: index === 0 ? outcome : 'needs_choice',
  }))
}
