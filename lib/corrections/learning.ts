import type { FoodItem } from '@/types/database'

export type CorrectionLearningProposalType =
  | 'identity_alias'
  | 'identity_rejection'
  | 'unit_or_quantity_review'
  | 'pantry_suggestion'

export interface CorrectionLearningProposal {
  type: CorrectionLearningProposalType
  source_ref: string | null
  rejected_source_ref?: string | null
  phrase: string | null
  food_name: string
  reason: string
  confidence: 'low' | 'medium' | 'high'
  payload: Record<string, unknown>
}

export interface PlateEditLearningInput {
  before: FoodItem | null
  after: FoodItem | null
  phrase?: string | null
}

function canonicalRef(food: FoodItem | null): string | null {
  return food?.source_ref ?? null
}

function normalized(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function sameFoodIdentity(before: FoodItem | null, after: FoodItem | null): boolean {
  const beforeRef = canonicalRef(before)
  const afterRef = canonicalRef(after)
  if (beforeRef && afterRef) return beforeRef === afterRef
  return normalized(before?.name) === normalized(after?.name)
}

function macroDelta(before: FoodItem, after: FoodItem): Record<string, number> {
  return {
    calories: Math.round((after.calories - before.calories) * 100) / 100,
    protein_g: Math.round((after.protein_g - before.protein_g) * 100) / 100,
    carbs_g: Math.round((after.carbs_g - before.carbs_g) * 100) / 100,
    fat_g: Math.round((after.fat_g - before.fat_g) * 100) / 100,
  }
}

export function proposeLearningFromPlateEdit(
  input: PlateEditLearningInput,
): CorrectionLearningProposal[] {
  const { before, after, phrase = null } = input
  const proposals: CorrectionLearningProposal[] = []

  if (!before && !after) return proposals

  if (!before && after) {
    proposals.push({
      type: after.source_ref ? 'identity_alias' : 'pantry_suggestion',
      source_ref: canonicalRef(after),
      phrase,
      food_name: after.name,
      reason: after.source_ref
        ? 'user added a canonical food from a phrase'
        : 'user added a food without canonical identity',
      confidence: after.source_ref ? 'medium' : 'low',
      payload: {
        qty: after.qty,
        unit: after.unit,
        macros: {
          calories: after.calories,
          protein_g: after.protein_g,
          carbs_g: after.carbs_g,
          fat_g: after.fat_g,
        },
      },
    })
    return proposals
  }

  if (before && !after) {
    proposals.push({
      type: 'identity_rejection',
      source_ref: null,
      rejected_source_ref: canonicalRef(before),
      phrase,
      food_name: before.name,
      reason: 'user removed a staged food',
      confidence: before.source_ref ? 'medium' : 'low',
      payload: {
        removed_name: before.name,
        removed_source_ref: before.source_ref ?? null,
      },
    })
    return proposals
  }

  if (!before || !after) return proposals

  const beforeRef = canonicalRef(before)
  const afterRef = canonicalRef(after)
  if (beforeRef !== afterRef && afterRef) {
    proposals.push({
      type: 'identity_alias',
      source_ref: afterRef,
      rejected_source_ref: beforeRef,
      phrase,
      food_name: after.name,
      reason: 'user swapped the staged identity',
      confidence: 'high',
      payload: {
        accepted_name: after.name,
        rejected_name: before.name,
      },
    })
  }

  if (
    sameFoodIdentity(before, after) &&
    (before.qty !== after.qty ||
      normalized(before.unit) !== normalized(after.unit) ||
      before.calories !== after.calories ||
      before.protein_g !== after.protein_g ||
      before.carbs_g !== after.carbs_g ||
      before.fat_g !== after.fat_g)
  ) {
    proposals.push({
      type: 'unit_or_quantity_review',
      source_ref: afterRef,
      phrase,
      food_name: after.name,
      reason: 'user changed quantity, unit, or macros for the same identity',
      confidence: afterRef ? 'medium' : 'low',
      payload: {
        before: {
          qty: before.qty,
          unit: before.unit,
          calories: before.calories,
          protein_g: before.protein_g,
          carbs_g: before.carbs_g,
          fat_g: before.fat_g,
        },
        after: {
          qty: after.qty,
          unit: after.unit,
          calories: after.calories,
          protein_g: after.protein_g,
          carbs_g: after.carbs_g,
          fat_g: after.fat_g,
        },
        macro_delta: macroDelta(before, after),
      },
    })
  }

  if (!afterRef && after.match_confidence?.label === 'low') {
    proposals.push({
      type: 'pantry_suggestion',
      source_ref: null,
      phrase,
      food_name: after.name,
      reason: 'low-confidence edited item has no canonical identity',
      confidence: 'low',
      payload: {
        qty: after.qty,
        unit: after.unit,
        source: after.source ?? null,
      },
    })
  }

  return proposals
}

