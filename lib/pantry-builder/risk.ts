import type { ExistingProductSummary, PantryCandidate, PantryDecision, PantrySourceKind } from './types'
import { normalizeFoodText } from './normalize'

const REVIEW_SOURCE_KINDS = new Set<PantrySourceKind>(['off', 'manual', 'restaurant', 'llm'])
const REVIEW_CATEGORY_TERMS = [
  'chipotle',
  'restaurant',
  'mcdonald',
  'margarita',
  'julep',
  'beer',
  'cocktail',
  'rebbl',
  'yasso',
  'magic spoon',
  'silk',
  'kashi',
  'cracklin',
  'harmless harvest',
  'taste nirvana',
  'goya',
]
const PREPARED_DISH_TERMS = [
  'with sauce',
  'with vegetables',
  'with gravy',
  'with meat',
  'and meat',
  'sauce',
  'dip',
  'sandwich',
  'burrito',
  'bowl',
  'pizza',
  'casserole',
  'sweet chilli',
  'breaded',
  'fried',
]
const UNSPECIFIED_USDA_TERMS = [
  'nfs',
  'ns as to',
  'not specified',
]
const STATE_MODIFIERS = [
  'additives',
  'babyfood',
  'blade',
  'bbq',
  'bake',
  'beef bacon',
  'breast',
  'bread',
  'bun',
  'canned',
  'cake',
  'cheese',
  'chip',
  'chips',
  'choice',
  'cooked',
  'corned',
  'croissant',
  'croissants',
  'cured',
  'dehydrated',
  'dried',
  'drumstick',
  'dry',
  'egg',
  'enoki',
  'fast foods',
  'flour',
  'florida',
  'flavor',
  'flavored',
  'frozen',
  'german',
  'greens',
  'hopi',
  'imported',
  'juice',
  'light',
  'maitake',
  'mission',
  'mix',
  'morel',
  'nugget',
  'nuggets',
  'new zealand',
  'overripe',
  'oyster',
  'pastry',
  'peel',
  'pickled',
  'pie',
  'powder',
  'powdered',
  'portabella',
  'prepackaged',
  'prime',
  'protein fortified',
  'refrigerated',
  'relish',
  'restaurant',
  'salad',
  'sauce',
  'scampi',
  'sliced',
  'select',
  'shiitake',
  'spinach',
  'squash',
  'strawberry',
  'strudel',
  'stew',
  'stuffed',
  'stuffing',
  'sweetened',
  'syrup',
  'sprouted',
  'tartare',
  'thigh',
  'tofu',
  'topping',
  'wing',
  'baby',
  'fat added',
  'whole wheat',
  'white',
]
const DUPLICATE_TARGET_STOP_TOKENS = new Set([
  'and',
  'cooked',
  'fresh',
  'grade',
  'large',
  'low',
  'medium',
  'plain',
  'raw',
  'regular',
  'small',
  'with',
])

function macroCalories(candidate: PantryCandidate): number {
  const p = candidate.proposed_product
  return p.protein_g_per_serving * 4 + p.carbs_g_per_serving * 4 + p.fat_g_per_serving * 9
}

function macroSane(candidate: PantryCandidate): boolean {
  const p = candidate.proposed_product
  if (!Number.isFinite(p.calories_per_serving) || p.calories_per_serving <= 0) return false
  if (p.calories_per_serving > 2000) return false
  if (p.protein_g_per_serving < 0 || p.carbs_g_per_serving < 0 || p.fat_g_per_serving < 0) return false
  const macroKcal = macroCalories(candidate)
  if (macroKcal <= 0) return true
  if (p.calories_per_serving <= 50) {
    return Math.abs(macroKcal - p.calories_per_serving) <= 35
  }
  const pctOff = Math.abs(macroKcal - p.calories_per_serving) / Math.max(p.calories_per_serving, 1)
  return pctOff <= 0.45
}

function duplicateHit(candidate: PantryCandidate, existing: ExistingProductSummary[]): boolean {
  const normalized = normalizeFoodText(candidate.display_name)
  const compact = normalized.replace(/\s+/g, '')
  const aliases = candidate.aliases
    .map((alias) => normalizeFoodText(alias))
    .filter((alias) => alias.length >= 5)
  const targetTokens = normalizeFoodText(candidate.target_query)
    .split(' ')
    .map((token) => (token.endsWith('s') && token.length > 4 ? token.slice(0, -1) : token))
    .filter((token) => token.length > 1 && !DUPLICATE_TARGET_STOP_TOKENS.has(token))

  return existing.some((row) => {
    const rowName = normalizeFoodText(row.name)
    const rowTokens = new Set(
      rowName
        .split(' ')
        .map((token) => (token.endsWith('s') && token.length > 4 ? token.slice(0, -1) : token)),
    )
    if (rowName === normalized) return true
    if (rowName.replace(/\s+/g, '') === compact) return true
    if (targetTokens.length >= 2 && targetTokens.every((token) => rowTokens.has(token))) return true
    if (
      aliases.some(
        (alias) =>
          rowName === alias ||
          rowName.startsWith(`${alias} `) ||
          rowName.endsWith(` ${alias}`) ||
          rowName.includes(` ${alias} `),
      )
    ) {
      return true
    }
    const brand = normalizeFoodText(row.brand)
    return brand.length > 0 && normalizeFoodText(`${brand} ${row.name}`) === normalized
  })
}

export function classifyPantryCandidate(
  candidate: PantryCandidate,
  existing: ExistingProductSummary[],
  reviewOnlyPatterns: string[],
): PantryCandidate {
  const reasons = new Set(candidate.reasons)
  let score = candidate.risk_score
  let decision: PantryDecision = candidate.decision
  const name = normalizeFoodText(candidate.display_name)
  const targetQuery = normalizeFoodText(candidate.target_query)

  if (REVIEW_SOURCE_KINDS.has(candidate.source_kind)) {
    reasons.add(`review_source_${candidate.source_kind}`)
    decision = 'review_required'
    score += 30
  }
  if (!['Foundation', 'Survey (FNDDS)', 'SR Legacy'].includes(candidate.source_dataset ?? '')) {
    reasons.add(`review_dataset_${candidate.source_dataset ?? 'unknown'}`)
    decision = 'review_required'
    score += 15
  }
  if (candidate.proposed_product.brand) {
    reasons.add('branded_candidate_review_required')
    decision = decision === 'rejected' ? decision : 'review_required'
    score += 25
  }
  if (!macroSane(candidate)) {
    reasons.add('macro_sanity_failed')
    decision = 'rejected'
    score += 100
  }
  if (candidate.unit_alternatives.length === 0) {
    reasons.add('missing_unit_alternatives')
    decision = decision === 'rejected' ? decision : 'review_required'
    score += 20
  }
  if (/\bwith\b/.test(targetQuery)) {
    reasons.add('composite_target_review_required')
    decision = decision === 'rejected' ? decision : 'review_required'
    score += 25
  }
  if (targetQuery === 'mushrooms' && name !== 'mushrooms raw') {
    reasons.add('generic_mushroom_subtype_review_required')
    decision = decision === 'rejected' ? decision : 'review_required'
    score += 25
  }
  if (duplicateHit(candidate, existing)) {
    reasons.add('duplicate_existing_product')
    decision = 'rejected'
    score += 100
  }
  if (reviewOnlyPatterns.some((pattern) => name.includes(normalizeFoodText(pattern)))) {
    reasons.add('luke_overlay_review_required')
    decision = decision === 'rejected' ? decision : 'review_required'
    score += 25
  }
  if (REVIEW_CATEGORY_TERMS.some((term) => name.includes(term))) {
    reasons.add('branded_restaurant_or_alcohol_review_required')
    decision = decision === 'rejected' ? decision : 'review_required'
    score += 25
  }
  if (PREPARED_DISH_TERMS.some((term) => name.includes(term)) && candidate.category !== 'prepared_common') {
    reasons.add('prepared_dish_mismatch_risk')
    decision = decision === 'rejected' ? decision : 'review_required'
    score += 15
  }
  if (UNSPECIFIED_USDA_TERMS.some((term) => name.includes(term))) {
    reasons.add('not_further_specified_review_required')
    decision = decision === 'rejected' ? decision : 'review_required'
    score += 20
  }
  for (const term of STATE_MODIFIERS) {
    if (name.includes(term) && !targetQuery.includes(term)) {
      reasons.add(`state_modifier_mismatch_${term}`)
      decision = decision === 'rejected' ? decision : 'review_required'
      score += 20
    }
  }
  if (targetQuery.includes('cooked') && name.includes('raw')) {
    reasons.add('state_modifier_mismatch_raw_when_cooked_requested')
    decision = decision === 'rejected' ? decision : 'review_required'
    score += 20
  }
  if (targetQuery.includes('cooked') && !name.includes('cooked')) {
    reasons.add('state_modifier_mismatch_cooked_state_missing')
    decision = decision === 'rejected' ? decision : 'review_required'
    score += 20
  }
  if (targetQuery.includes('raw') && !name.includes('raw')) {
    reasons.add('state_modifier_mismatch_raw_state_missing')
    decision = decision === 'rejected' ? decision : 'review_required'
    score += 20
  }
  if (targetQuery.includes('lean') && !name.includes('lean')) {
    reasons.add('state_modifier_mismatch_lean_state_missing')
    decision = decision === 'rejected' ? decision : 'review_required'
    score += 20
  }
  for (const value of targetQuery.match(/\b\d{2,3}\b/g) ?? []) {
    if (name.includes(value)) continue
    reasons.add(`state_modifier_mismatch_number_${value}_missing`)
    decision = decision === 'rejected' ? decision : 'review_required'
    score += 20
  }

  return {
    ...candidate,
    decision,
    risk_score: Math.min(100, Math.round(score)),
    reasons: [...reasons],
  }
}
