// S26 Step 4d Phase 1a — report_food_items enumeration tool.
//
// This tool is used in the candidates-first parse-meal architecture
// to have Haiku 4.5 enumerate the foods mentioned in a transcript
// in a single forced-tool-choice call. The pipeline then drives
// per-food library + database dispatches in parallel without a
// second LLM round-trip.
//
// Schema and prompt validated in P0.5 probe (10/10 pass on
// claude-haiku-4-5-20251001 across simple, multi-food, and edge
// transcripts; avg latency 781ms). See H-S4d-p0.5 for fixtures.
//
// Phase 1a: this module is NOT yet wired into the pipeline. P1b
// restructures parse-meal-pipeline.ts to use it.

import type { Message, Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages'

export interface EnumeratedItem {
  label: string
  qty: number
  unit: string
  brand?: string
  barcode?: string
  // S26 Step 4d Phase 1b — voice_recite_label support. When the user
  // recites macro values from a package label, Haiku populates these
  // with TOTAL values (already multiplied by servings consumed). The
  // classifier short-circuits library/DB lookup and emits the food
  // with source='user_recited' using these values verbatim.
  recited_calories?: number
  recited_protein_g?: number
  recited_carbs_g?: number
  recited_fat_g?: number
  // S26 Step 4d Phase 1b — calorie_anchored support. When the user
  // specifies a calorie target ("a 500-calorie bean burrito"), Haiku
  // populates this. After classifier picks a candidate, the pipeline
  // scales its macros so total kcal == target_calories.
  target_calories?: number
}

export const REPORT_FOOD_ITEMS_TOOL: Tool = {
  name: 'report_food_items',
  description:
    'Enumerate the food items mentioned in the transcript. Call this exactly once.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            qty: { type: 'number' },
            unit: { type: 'string' },
            brand: { type: 'string' },
            barcode: { type: 'string' },
            recited_calories: { type: 'number' },
            recited_protein_g: { type: 'number' },
            recited_carbs_g: { type: 'number' },
            recited_fat_g: { type: 'number' },
            target_calories: { type: 'number' },
          },
          required: ['label', 'qty', 'unit'],
        },
      },
    },
    required: ['items'],
  },
}

// Pull the items array out of an Anthropic Message. Returns null when
// the response did not include a report_food_items tool_use block,
// or when its input shape was malformed. The pipeline treats null as
// a hard failure (no foods enumerated → cannot proceed).
export function parseReportFoodItemsCall(response: Message): EnumeratedItem[] | null {
  for (const block of response.content) {
    if (block.type !== 'tool_use') continue
    const tu = block as ToolUseBlock
    if (tu.name !== 'report_food_items') continue
    const input = tu.input as { items?: unknown }
    if (!Array.isArray(input.items)) return null
    const out: EnumeratedItem[] = []
    for (const raw of input.items) {
      if (!raw || typeof raw !== 'object') return null
      const r = raw as Record<string, unknown>
      if (typeof r.label !== 'string' || typeof r.qty !== 'number' || typeof r.unit !== 'string') {
        return null
      }
      const item: EnumeratedItem = { label: r.label, qty: r.qty, unit: r.unit }
      if (typeof r.brand === 'string') item.brand = r.brand
      if (typeof r.barcode === 'string') item.barcode = r.barcode
      if (typeof r.recited_calories === 'number') item.recited_calories = r.recited_calories
      if (typeof r.recited_protein_g === 'number') item.recited_protein_g = r.recited_protein_g
      if (typeof r.recited_carbs_g === 'number') item.recited_carbs_g = r.recited_carbs_g
      if (typeof r.recited_fat_g === 'number') item.recited_fat_g = r.recited_fat_g
      if (typeof r.target_calories === 'number') item.target_calories = r.target_calories
      out.push(item)
    }
    return out
  }
  return null
}
