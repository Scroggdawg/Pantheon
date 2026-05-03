// S26 Step 4d Phase 1b (P1B.0c) — reconcile_macros tool.
//
// Phase E of the candidates-first pipeline. After Phases A-D produce a
// foods array via deterministic ranking + classification, Phase E fires
// a single Haiku 4.5 forced-tool call asking the model to review each
// food's macros against its name/qty/unit and emit corrections only
// where values look obviously wrong.
//
// Why: P1B.6 validation surfaced systematic deterministic-rule failures
// on macro magnitude judgment (library 'total × qty' double-counting,
// USDA per-100g vs per-stated-serving heterogeneity, target_calories
// scaling on candidates state, multi-source placeholder bloat). The
// classifier picks the right food name well; it just can't sanity-check
// magnitudes. Phase E restores LLM judgment for that narrow concern
// while preserving the candidates-first orchestration.

import type { Message, Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages'

// One reconciliation entry per emitted food. Index is the position in
// the foods array as sent to Phase E; the model must return one entry
// per food (uncorrected foods returned with their original values).
export interface ReconciliationEntry {
  index: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export const RECONCILE_MACROS_TOOL: Tool = {
  name: 'reconcile_macros',
  description:
    'Review the macro values computed for each food and return corrected values where they look obviously wrong for the qty/unit/name. Return the same foods array; only adjust calories, protein_g, carbs_g, fat_g where corrections are needed. Do not add, remove, or reorder foods.',
  input_schema: {
    type: 'object',
    properties: {
      foods: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'number' },
            calories: { type: 'number' },
            protein_g: { type: 'number' },
            carbs_g: { type: 'number' },
            fat_g: { type: 'number' },
          },
          required: ['index', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
        },
      },
    },
    required: ['foods'],
  },
}

export const RECONCILE_MACROS_SYSTEM_PROMPT = `You are reviewing macro values computed by an automated food classifier. For each food in the input list, decide whether the calories/protein/carbs/fat values are reasonable for the food's name, quantity, unit, and source. Return corrections only where values are obviously wrong.

Common error patterns to check:
- Library entry named like '3 eggs' or '2 strips of bacon' had its macros multiplied by qty (e.g. 215 cal × 3 = 645 cal). The library entry's macros ALREADY represent the named quantity, so multiplication double-counts. Divide by qty if you detect this pattern. Source='library' with a counted-noun name is the strong signal.
- USDA serving size confusion: 'cereals ready-to-eat 1 cup' may have macros stored per-100g rather than per-1-cup. If macros look like they're for a different serving size than stated, correct to a reasonable per-stated-serving value.
- Calorie-anchored target: if user said 'a 500-calorie burrito' but macros sum to 220 calories, scale all four macros proportionally so calories === target.
- Multi-source bloat: if a 'candidates' state food has placeholder macros from a poorly-matched candidate (e.g. avocado matched to avocado dressing — see top_candidate_name field), reduce to reasonable estimate or zero.

Evaluate EACH food in the list independently. Don't assume fixing one food's macros means the others are correct. Review every food, applying the same checks to each.

For calorie-anchored foods (target_calories was specified), scale ALL FOUR macros proportionally so calories hits the target while preserving the macro ratio. Don't adjust only one or two macros.

If a food's macros look plausible for its name/qty/unit, return them unchanged. Don't second-guess values that look correct.

Don't add or remove foods. Don't change food names, sources, or candidates arrays. Only adjust calories/protein_g/carbs_g/fat_g for foods that need correction.

Use the reconcile_macros tool exactly once with the corrected values for ALL foods (return uncorrected foods unchanged).`

// Pull reconciliation entries out of an Anthropic Message. Returns null
// when the response did not include a reconcile_macros tool_use block
// or when its input shape was malformed. The pipeline treats null as a
// soft failure (Phase E falls back to uncorrected foods).
export function parseReconcileMacrosCall(response: Message): ReconciliationEntry[] | null {
  for (const block of response.content) {
    if (block.type !== 'tool_use') continue
    const tu = block as ToolUseBlock
    if (tu.name !== 'reconcile_macros') continue
    const input = tu.input as { foods?: unknown }
    if (!Array.isArray(input.foods)) return null
    const out: ReconciliationEntry[] = []
    for (const raw of input.foods) {
      if (!raw || typeof raw !== 'object') return null
      const r = raw as Record<string, unknown>
      if (
        typeof r.index !== 'number' ||
        typeof r.calories !== 'number' ||
        typeof r.protein_g !== 'number' ||
        typeof r.carbs_g !== 'number' ||
        typeof r.fat_g !== 'number'
      ) {
        return null
      }
      out.push({
        index: r.index,
        calories: r.calories,
        protein_g: r.protein_g,
        carbs_g: r.carbs_g,
        fat_g: r.fat_g,
      })
    }
    return out
  }
  return null
}
