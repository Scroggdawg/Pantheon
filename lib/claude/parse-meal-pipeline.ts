// parse-meal-pipeline — Anthropic tool-use loop. TypeScript port of
// prototype/parse_meal.py (S26 Step 2). Takes a meal transcript, exposes
// search_user_library + search_food_database to Claude, returns a structured
// ParsedMealResponse plus telemetry.

import Anthropic from '@anthropic-ai/sdk'
import type {
  Message,
  MessageParam,
  TextBlock,
  Tool,
  ToolResultBlockParam,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages'

import type { ParsedMealResponse } from '@/types/database'

import {
  CLAUDE_MAX_TOKENS,
  CLAUDE_MODEL,
  PARSE_MEAL_MAX_ITERS,
} from './tools/constants'
import {
  SEARCH_FOOD_DATABASE_TOOL,
  searchFoodDatabase,
  type SearchFoodDatabaseInput,
} from './tools/search-food-database'
import {
  SEARCH_USER_LIBRARY_TOOL,
  searchUserLibrary,
  type SearchUserLibraryCtx,
  type SearchUserLibraryInput,
} from './tools/search-user-library'

// Context the route handler must supply so library lookups can hit Supabase
// scoped to the requesting user. Threaded through the dispatcher closure;
// not visible to the LLM.
export interface ParseMealContext {
  library: SearchUserLibraryCtx
}

// ---------------------------------------------------------------------
// System prompt — port of prototype/parse_meal.py SYSTEM_PROMPT, with
// Luke-specific user-profile preamble grafted on per V15 Q2.
// Final-output JSON shape updated to match V2 ParsedMealResponse
// (drop meal_label, replace `confidence` enum with `match_confidence`
// object, add `disambiguation`).
// ---------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Pantheon's nutrition logging assistant. Your job is to take a user's meal transcript and produce a structured macros breakdown.

# User profile
- Goal: aggressive lean cut, 185 lbs by June 19 2026 (currently 198 lbs)
- Protein target: 200g/day — non-negotiable for muscle preservation
- Staple foods: eggs, chicken, rice, Greek yogurt, protein shakes, larb, poke, sushi, salads, Mediterranean
- The transcript may come from voice recognition. If a food name seems phonetically close to a real food (e.g. "keen-wah" for quinoa, "fay-jee-tah" for fajita), interpret it as the most likely food match and note it in the 'notes' field of that food.

# Rules

1. **Library FIRST.** For every distinct food item the user mentions, call search_user_library FIRST. Library entries reflect the user's own validated macros and aliases. If a library entry has match_confidence label "high", prefer it over any database hit. Common phrases like "my morning shake", "3 eggs", "tandoori chicken" should always trigger a library lookup.

   **CRITICAL — query the library with general meal-name phrasings, NOT component-specific terms.** Library entries are stored under user-friendly names. If the user describes ingredients ("whey protein isolate by IsoPure plus dextrose"), the right library query is "morning shake" or "isopure shake" or "pre-workout shake" — NOT "whey protein isolate". Always issue 2-3 library queries per meal candidate covering different naming angles (meal name, ingredient name, brand-anchored phrase) before concluding no library entry exists. Keep queries short (2-4 tokens). Examples:
   - User: "Protein shake with IsoPure whey and 25g dextrose"
     → query library with: "morning shake", "isopure shake", "protein shake"
   - User: "Two scrambled eggs"
     → query library with: "eggs", "scrambled eggs"
   - User: "11 oz tandoori chicken"
     → query library with: "tandoori chicken", "chicken"

2. **Barcode SECOND.** If the input begins with a \`[BARCODE: <digits>]\` prefix (this represents a scanned UPC alongside voice/text input), extract the barcode and pass it to search_food_database via the \`barcode\` parameter on your first database call for that item. Barcode lookups are exact-product matches and short-circuit the normal name-based ranking.

3. **Database THIRD.** For other items (generic foods, branded items without a known barcode), call search_food_database with a clean query and \`brand\` when known. Examine the returned candidates' match_confidence carefully:
   - High score (>= 0.85) = trustworthy
   - Medium (0.60-0.85) = usable but worth noting
   - Low (< 0.60) = use only if no better option, and mark item match_confidence label as low

4. **Macro-math warnings matter.** If a result has a \`macro_math_mismatch_*\` warning in match_confidence.warnings, the database entry is internally inconsistent (kcal != 4P+4C+9F). Prefer a different candidate, or compute macros from the protein/carbs/fat values rather than the reported kcal.

5. **Multi-item meals: one tool call per distinct food.** If a transcript mentions eggs + bacon + shake, that's three separate library lookups (and maybe three database lookups). You can batch them in parallel within one assistant turn.

6. **Quantity scaling.** When the user says "10oz of t-bone" but the database returns per-100g values, scale appropriately. The tool's per_user_serving field handles weight units (g, oz) automatically when you provide serving_amount + serving_unit. For non-weight units (cup, slice, medium) you must scale manually using per_100g and a reasonable gram estimate.

7. **Calorie-anchored input.** If the user gives a calorie target like "a 500-calorie bean burrito", look up a generic bean burrito in the database, then SCALE all macros so kcal hits the user's target. Don't return the database's default serving — return the scaled values. Set source = "user_recited" for these.

8. **Source attribution.** Every food in the final output must carry a \`source\` field:
   - \`library\`            — library hit you accepted (also set source_ref to the library_id)
   - \`database_exact\`     — USDA/OFF hit with high match_confidence (also set source_ref to the tool result id)
   - \`database_estimated\` — USDA/OFF hit, scaled or low/medium confidence (also set source_ref)
   - \`user_recited\`       — user gave macros directly ("a 200-cal protein bar")
   - \`llm_estimated\`      — pure estimate from your training data, no tool hit
   - \`quick_add\`          — bare-numbers entry, no name attached

9. **Disambiguation.** When two or more tool results for the same item are within 0.10 of each other in match_confidence and you can't pick confidently, populate \`disambiguation\` with a DisambiguationPrompt for that item (item_index references foods[]). Otherwise leave \`disambiguation\` as null.

   **INVARIANT:** If you emit a disambiguation entry with item_index N, you MUST include a corresponding entry in foods[N]. Use the most likely candidate's name as the placeholder's name field, set qty/unit from the user transcript, and set notes='multiple matches — see disambiguation candidates'. The placeholder's macros should match the top candidate's per_serving values (multiplied by qty if applicable). Never emit a disambiguation entry whose item_index references a non-existent foods slot.

10. **Final output.** When done, stop calling tools and return a JSON object with this exact shape:
{
  "foods": [
    {
      "name": "<descriptive name>",
      "qty": <number>,
      "unit": "<unit string>",
      "calories": <int>,
      "protein_g": <number>,
      "carbs_g": <number>,
      "fat_g": <number>,
      "source": "library | database_exact | database_estimated | user_recited | llm_estimated | quick_add",
      "source_ref": "<id from tool result, or null>",
      "match_confidence": {
        "score": <0..1>,
        "label": "high | medium | low",
        "warnings": ["<string>", ...]
      },
      "notes": "<optional caveat or null>"
    }
  ],
  "total_calories": <int>,
  "total_protein_g": <number>,
  "total_carbs_g": <number>,
  "total_fat_g": <number>,
  "clarification_needed": "<question for user, or null>",
  "disambiguation": [
    {
      "item_index": <int>,
      "query_used": "<string>",
      "candidates": [
        {
          "name": "<string>",
          "source": "<FoodItemSource>",
          "source_ref": "<string>",
          "per_serving": {
            "calories": <number>,
            "protein_g": <number>,
            "carbs_g": <number>,
            "fat_g": <number>
          },
          "match_confidence": { "score": <number>, "label": "<string>", "warnings": [] }
        }
      ]
    }
  ]
}

Wrap the JSON in \`\`\`json fences in your final response so it can be parsed.
`

const TOOLS: Tool[] = [SEARCH_USER_LIBRARY_TOOL, SEARCH_FOOD_DATABASE_TOOL]

// ---------------------------------------------------------------------
// S26 Step 4d Phase 1a — enumeration prompt for the candidates-first
// architecture. Validated in P0.5 (10/10 pass on Haiku 4.5; avg 781ms).
// Final line ("If a brand is detected...") added per V15 ruling P1a.2
// to prevent label/brand redundancy seen in P0.5 probes (c) and (e).
//
// Phase 1a: exported but NOT yet wired. P1b will replace the SYSTEM_PROMPT
// loop with a forced report_food_items call using this prompt.
// ---------------------------------------------------------------------
export const ENUMERATION_SYSTEM_PROMPT = `Read the transcript and identify each food item mentioned.
Call report_food_items exactly once with the structured list.
Each item needs label, qty, and unit. Brand and barcode are optional.
Don't invent foods not mentioned; don't skip foods that are mentioned.
Treat 'a' or 'an' as qty=1.
Treat plurals like 'eggs' as countable; the qty is the number specified (e.g. '3 eggs' → qty=3).
For countable items without an explicit unit, use unit="" (empty string).
For mass/volume units (cup, tbsp, oz, g, slice, strip), use the unit as stated.
If a brand is detected, populate the brand field; do not duplicate it in label.`

// ---------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------

function makeDispatcher(ctx: ParseMealContext) {
  return async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    if (name === 'search_user_library') {
      return searchUserLibrary(args as unknown as SearchUserLibraryInput, ctx.library)
    }
    if (name === 'search_food_database') {
      return searchFoodDatabase(args as unknown as SearchFoodDatabaseInput)
    }
    return { error: `unknown tool ${name}` }
  }
}

// Per-tool counts for the route handler's telemetry log line.
export function summarizeToolCalls(log: ToolCallLogEntry[]): string {
  const counts: Record<string, number> = {}
  for (const e of log) counts[e.tool] = (counts[e.tool] ?? 0) + 1
  const parts = Object.entries(counts).map(([k, v]) => `${k}:${v}`)
  return `[${parts.join(', ')}]`
}

// ---------------------------------------------------------------------
// Final-JSON extractor
// ---------------------------------------------------------------------

function extractFinalJson(text: string): ParsedMealResponse | null {
  const fenceMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
  const candidate = fenceMatch ? fenceMatch[1] : text.match(/\{[\s\S]*"foods"[\s\S]*\}/)?.[0]
  if (!candidate) return null
  try {
    return JSON.parse(candidate) as ParsedMealResponse
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------
// Telemetry shape (logged but not part of API response)
// ---------------------------------------------------------------------

export interface ToolCallLogEntry {
  iter: number
  tool: string
  args: Record<string, unknown>
  result_summary: string
  duration_ms: number
  cache_hit?: boolean
}

export interface ParseMealTelemetry {
  tool_calls: number
  iters: number
  latency_ms: number
  input_tokens: number
  output_tokens: number
  stop_reason: string | null
  tool_call_log: ToolCallLogEntry[]
  cache_hits: number
}

export interface ParseMealPipelineResult {
  result: ParsedMealResponse | null
  final_text: string
  telemetry: ParseMealTelemetry
}

// ---------------------------------------------------------------------
// Main entry point — runs the tool-use loop
// ---------------------------------------------------------------------

export async function runParseMealPipeline(
  transcript: string,
  ctx: ParseMealContext,
  opts: { maxIters?: number } = {},
): Promise<ParseMealPipelineResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  const client = new Anthropic()
  const dispatchTool = makeDispatcher(ctx)

  const maxIters = opts.maxIters ?? PARSE_MEAL_MAX_ITERS
  const messages: MessageParam[] = [{ role: 'user', content: transcript }]
  const toolCallLog: ToolCallLogEntry[] = []

  let inputTokensTotal = 0
  let outputTokensTotal = 0
  let stopReason: string | null = null
  let finalText = ''
  let it = 0
  const started = Date.now()

  for (it = 0; it < maxIters; it++) {
    const resp: Message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    })

    inputTokensTotal += resp.usage.input_tokens
    outputTokensTotal += resp.usage.output_tokens
    stopReason = resp.stop_reason ?? null

    // Append assistant turn (raw blocks pass through unchanged)
    messages.push({ role: 'assistant', content: resp.content })

    if (resp.stop_reason === 'end_turn') {
      for (const block of resp.content) {
        if (block.type === 'text') finalText += (block as TextBlock).text
      }
      break
    }

    if (resp.stop_reason === 'tool_use') {
      const toolResults: ToolResultBlockParam[] = []
      for (const block of resp.content) {
        if (block.type === 'tool_use') {
          const tu = block as ToolUseBlock
          const t0 = Date.now()
          let out: unknown
          try {
            out = await dispatchTool(tu.name, tu.input as Record<string, unknown>)
          } catch (e) {
            const err = e as Error
            out = { error: `${err.name}: ${err.message}` }
          }
          const dt = Date.now() - t0
          const cacheHit =
            tu.name === 'search_food_database' &&
            typeof out === 'object' &&
            out !== null &&
            (out as { _cache_hit?: boolean })._cache_hit === true
          toolCallLog.push({
            iter: it,
            tool: tu.name,
            args: tu.input as Record<string, unknown>,
            result_summary: summarizeToolResult(tu.name, out),
            duration_ms: dt,
            cache_hit: cacheHit,
          })
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(out),
          })
        } else if (block.type === 'text') {
          finalText += (block as TextBlock).text + '\n'
        }
      }
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // Some other stop reason — bail
    break
  }

  const latencyMs = Date.now() - started
  const parsed = extractFinalJson(finalText)
  const cacheHits = toolCallLog.filter((e) => e.cache_hit === true).length

  return {
    result: parsed,
    final_text: finalText,
    telemetry: {
      tool_calls: toolCallLog.length,
      iters: it + 1,
      latency_ms: latencyMs,
      input_tokens: inputTokensTotal,
      output_tokens: outputTokensTotal,
      stop_reason: stopReason,
      tool_call_log: toolCallLog,
      cache_hits: cacheHits,
    },
  }
}

function summarizeToolResult(toolName: string, out: unknown): string {
  if (out && typeof out === 'object' && 'error' in out) {
    return `ERROR: ${(out as { error: string }).error}`
  }
  const results = (out as { results?: unknown[] })?.results ?? []
  if (!Array.isArray(results) || results.length === 0) return '0 results'
  const top = results[0] as Record<string, unknown>
  const mc = top.match_confidence as { score?: number; label?: string; warnings?: string[] } | undefined
  if (toolName === 'search_user_library') {
    return `${results.length} results; top: ${top.library_id} score=${mc?.score} label=${mc?.label}`
  }
  const name = typeof top.name === 'string' ? top.name.slice(0, 40) : ''
  return `${results.length} results; top: ${top.id} name='${name}' score=${mc?.score} label=${mc?.label} warnings=${JSON.stringify(mc?.warnings ?? [])}`
}
