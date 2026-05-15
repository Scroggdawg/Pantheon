// LP-5 fast-planner contract tests.
//
// No model call here. These tests pin the strict JSON/tool contract and
// validator rules before the planner is wired into any live parse path.

import {
  coerceFastPlannerPlan,
  validateFastPlannerPlan,
  type FastPlannerPlan,
} from '../lib/claude/fast-planner'
import type { SearchFirstPlateDraft } from '../lib/claude/search-first-resolver'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const draft: SearchFirstPlateDraft = {
  transcript: '20 chips with guacamole and 3 dos xx 16 ounce',
  can_skip_expert_llm: false,
  fallback_required_count: 1,
  items: [
    {
      segment: { original: '20 chips', stripped: '20 chips' },
      query: 'chips',
      outcome: 'needs_choice',
      name: 'Tortilla chips',
      source_ref: 'lib:product:p1',
      identity_id: 'product:p1',
      confidence_label: 'medium',
      review_pill: 'CHOOSE',
      calories: 140,
      protein_g: 2,
      carbs_g: 18,
      fat_g: 7,
      warnings: [],
      candidates: [
        { name: 'Tortilla chips', source_ref: 'lib:product:p1', identity_id: 'product:p1', score: 0.82 },
        { name: 'Corn chips', source_ref: 'lib:product:p2', identity_id: 'product:p2', score: 0.79 },
      ],
    },
    {
      segment: { original: 'guacamole', stripped: 'guacamole' },
      query: 'guacamole',
      outcome: 'needs_review',
      name: 'Guacamole',
      source_ref: null,
      identity_id: 'history:g1',
      confidence_label: 'high',
      review_pill: 'REVIEW',
      calories: 190,
      protein_g: 3,
      carbs_g: 11,
      fat_g: 16,
      warnings: ['history_signal_only'],
      candidates: [
        { name: 'Guacamole', source_ref: null, identity_id: 'history:g1', score: 0.98 },
      ],
    },
    {
      segment: { original: '3 dos xx 16 ounce', stripped: '3 dos xx' },
      query: 'dos xx',
      outcome: 'fallback_required',
      name: null,
      source_ref: null,
      identity_id: null,
      confidence_label: 'low',
      review_pill: 'REVIEW',
      calories: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      warnings: ['no_identity_candidate'],
      candidates: [],
    },
  ],
}

const validPlan: FastPlannerPlan = {
  fallback_expert_required: true,
  notes: ['Dos Equis needs expert fallback or data coverage.'],
  items: [
    {
      segment_index: 0,
      action: 'choose_candidate',
      candidate_identity_id: 'product:p1',
      qty: 20,
      unit: 'chips',
      reason: 'chips is ambiguous enough to choose',
    },
    {
      segment_index: 1,
      action: 'estimate',
      candidate_identity_id: 'history:g1',
      reason: 'identity is clear but amount is estimated',
    },
    {
      segment_index: 2,
      action: 'fallback_expert',
      reason: 'no usable Dos Equis candidate',
    },
  ],
}

const coerced = coerceFastPlannerPlan(validPlan)
assert(coerced !== null, 'valid plan should coerce')
assert(validateFastPlannerPlan(draft, coerced).length === 0, 'valid plan should validate')

const unknownCandidate: FastPlannerPlan = {
  ...validPlan,
  items: [
    {
      segment_index: 0,
      action: 'accept_candidate',
      candidate_identity_id: 'product:not-real',
      reason: 'bad candidate',
    },
    ...validPlan.items.slice(1),
  ],
}
assert(
  validateFastPlannerPlan(draft, unknownCandidate).some((err) =>
    err.includes('unknown candidate_identity_id'),
  ),
  'unknown candidate should fail validation',
)

const invalidFallback: FastPlannerPlan = {
  ...validPlan,
  fallback_expert_required: false,
}
assert(
  validateFastPlannerPlan(draft, invalidFallback).some((err) =>
    err.includes('fallback_expert action requires'),
  ),
  'fallback action without fallback flag should fail validation',
)

const badShape = coerceFastPlannerPlan({
  items: [{ segment_index: 0, action: 'accept_candidate' }],
  fallback_expert_required: false,
  notes: [],
})
assert(badShape === null, 'missing reason should fail coercion')

console.log('LP-5 fast planner contract: pass')

