import Anthropic from '@anthropic-ai/sdk'
import type { Message, Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages'

import type { SearchFirstPlateDraft } from './search-first-resolver'

export type FastPlannerAction =
  | 'accept_candidate'
  | 'choose_candidate'
  | 'estimate'
  | 'fallback_expert'

export interface FastPlannerItem {
  segment_index: number
  action: FastPlannerAction
  candidate_identity_id?: string
  qty?: number
  unit?: string
  reason: string
}

export interface FastPlannerPlan {
  items: FastPlannerItem[]
  fallback_expert_required: boolean
  notes: string[]
}

export interface FastPlannerResult {
  plan: FastPlannerPlan | null
  latency_ms: number
  input_tokens: number
  output_tokens: number
}

export const FAST_PLANNER_MODEL = 'claude-haiku-4-5-20251001'

export const FAST_PLANNER_TOOL: Tool = {
  name: 'plan_plate',
  description:
    'Produce a strict Plate plan from already-searched food segments. Do not invent database results.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            segment_index: { type: 'integer' },
            action: {
              type: 'string',
              enum: ['accept_candidate', 'choose_candidate', 'estimate', 'fallback_expert'],
            },
            candidate_identity_id: { type: 'string' },
            qty: { type: 'number' },
            unit: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['segment_index', 'action', 'reason'],
        },
      },
      fallback_expert_required: { type: 'boolean' },
      notes: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['items', 'fallback_expert_required', 'notes'],
  },
}

const FAST_PLANNER_SYSTEM = `You are Pantheon's fast Plate planner.

You receive:
- the original food transcript
- deterministic segments
- already-fetched search candidates
- resolver outcomes

Your job is to choose a safe Plate action for each segment.

Rules:
- Never invent a candidate_identity_id. Use only a candidate shown in the input.
- Use accept_candidate only for high-confidence, identity-safe items.
- Use choose_candidate when multiple candidates are plausible or the top candidate is generic/branded-risky.
- Use estimate only when the food identity is clear but quantity/macros are approximate.
- Use fallback_expert when the segment lacks a usable candidate or needs database/LLM lookup.
- Prefer visible review over confident wrongness.
- Return exactly one plan_plate tool call.`

function compactDraftForPrompt(draft: SearchFirstPlateDraft) {
  return {
    transcript: draft.transcript,
    items: draft.items.map((item, index) => ({
      segment_index: index,
      original: item.segment.original,
      query: item.query,
      resolver_outcome: item.outcome,
      review_pill: item.review_pill,
      top_name: item.name,
      source_ref: item.source_ref,
      identity_id: item.identity_id,
      confidence_label: item.confidence_label,
      warnings: item.warnings,
      candidates: item.candidates.map((candidate) => ({
        name: candidate.name,
        identity_id: candidate.identity_id,
        source_ref: candidate.source_ref,
        score: candidate.score,
      })),
    })),
  }
}

export function buildFastPlannerPrompt(draft: SearchFirstPlateDraft): string {
  return [
    'Plan this Pantheon Plate from deterministic resolver output.',
    'Return one plan_plate tool call only.',
    '',
    JSON.stringify(compactDraftForPrompt(draft), null, 2),
  ].join('\n')
}

export function parseFastPlannerToolCall(response: Message): FastPlannerPlan | null {
  for (const block of response.content) {
    if (block.type !== 'tool_use') continue
    const toolUse = block as ToolUseBlock
    if (toolUse.name !== 'plan_plate') continue
    return coerceFastPlannerPlan(toolUse.input)
  }
  return null
}

export function coerceFastPlannerPlan(input: unknown): FastPlannerPlan | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>
  if (!Array.isArray(raw.items)) return null
  if (typeof raw.fallback_expert_required !== 'boolean') return null
  if (!Array.isArray(raw.notes) || raw.notes.some((note) => typeof note !== 'string')) return null

  const items: FastPlannerItem[] = []
  for (const itemRaw of raw.items) {
    if (!itemRaw || typeof itemRaw !== 'object') return null
    const item = itemRaw as Record<string, unknown>
    if (typeof item.segment_index !== 'number') return null
    if (
      item.action !== 'accept_candidate' &&
      item.action !== 'choose_candidate' &&
      item.action !== 'estimate' &&
      item.action !== 'fallback_expert'
    ) {
      return null
    }
    if (typeof item.reason !== 'string') return null
    const out: FastPlannerItem = {
      segment_index: item.segment_index,
      action: item.action,
      reason: item.reason,
    }
    if (typeof item.candidate_identity_id === 'string') {
      out.candidate_identity_id = item.candidate_identity_id
    }
    if (typeof item.qty === 'number') out.qty = item.qty
    if (typeof item.unit === 'string') out.unit = item.unit
    items.push(out)
  }

  return {
    items,
    fallback_expert_required: raw.fallback_expert_required,
    notes: raw.notes as string[],
  }
}

export function validateFastPlannerPlan(
  draft: SearchFirstPlateDraft,
  plan: FastPlannerPlan,
): string[] {
  const errors: string[] = []
  if (plan.items.length !== draft.items.length) {
    errors.push(`expected ${draft.items.length} planned items, got ${plan.items.length}`)
  }

  const seen = new Set<number>()
  for (const item of plan.items) {
    if (!Number.isInteger(item.segment_index)) {
      errors.push(`segment_index must be integer: ${item.segment_index}`)
      continue
    }
    if (item.segment_index < 0 || item.segment_index >= draft.items.length) {
      errors.push(`segment_index out of range: ${item.segment_index}`)
      continue
    }
    if (seen.has(item.segment_index)) errors.push(`duplicate segment_index: ${item.segment_index}`)
    seen.add(item.segment_index)

    const draftItem = draft.items[item.segment_index]
    const candidateIds = new Set(draftItem.candidates.map((candidate) => candidate.identity_id))
    if (
      (item.action === 'accept_candidate' || item.action === 'choose_candidate') &&
      (!item.candidate_identity_id || !candidateIds.has(item.candidate_identity_id))
    ) {
      errors.push(`segment ${item.segment_index} uses unknown candidate_identity_id`)
    }
    if (draftItem.outcome === 'fallback_required' && item.action !== 'fallback_expert') {
      errors.push(`segment ${item.segment_index} must fallback_expert because resolver required fallback`)
    }
    if (item.action === 'fallback_expert' && !plan.fallback_expert_required) {
      errors.push('fallback_expert action requires fallback_expert_required=true')
    }
  }

  return errors
}

export async function runFastPlanner(draft: SearchFirstPlateDraft): Promise<FastPlannerResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  const client = new Anthropic()
  const started = Date.now()
  const response = await client.messages.create({
    model: FAST_PLANNER_MODEL,
    max_tokens: 1200,
    system: FAST_PLANNER_SYSTEM,
    tools: [FAST_PLANNER_TOOL],
    tool_choice: { type: 'tool', name: 'plan_plate' },
    messages: [{ role: 'user', content: buildFastPlannerPrompt(draft) }],
  })

  return {
    plan: parseFastPlannerToolCall(response),
    latency_ms: Date.now() - started,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  }
}

