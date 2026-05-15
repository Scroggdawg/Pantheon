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
  'with gravy',
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
const STATE_MODIFIERS = [
  'babyfood',
  'bbq',
  'bake',
  'beef bacon',
  'breast',
  'bread',
  'canned',
  'cake',
  'chip',
  'chips',
  'cooked',
  'croissant',
  'croissants',
  'dehydrated',
  'dried',
  'drumstick',
  'dry',
  'flour',
  'florida',
  'frozen',
  'hopi',
  'juice',
  'mission',
  'mix',
  'nugget',
  'nuggets',
  'overripe',
  'pastry',
  'peel',
  'pickled',
  'pie',
  'powder',
  'powdered',
  'prepackaged',
  'refrigerated',
  'restaurant',
  'salad',
  'sauce',
  'scampi',
  'sliced',
  'strawberry',
  'strudel',
  'stew',
  'sweetened',
  'syrup',
  'sprouted',
  'thigh',
  'topping',
  'wing',
]

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
  return existing.some((row) => {
    const rowName = normalizeFoodText(row.name)
    if (rowName === normalized) return true
    if (rowName.replace(/\s+/g, '') === compact) return true
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

  return {
    ...candidate,
    decision,
    risk_score: Math.min(100, Math.round(score)),
    reasons: [...reasons],
  }
}
