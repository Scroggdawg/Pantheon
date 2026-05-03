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
  CLAUDE_MODEL_FAST,
  CLAUDE_MODEL_SMART,
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
  model: string
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
  per_iter_model: string[]
  escalated: boolean
  escalated_at_iter: number | null
}

export interface ParseMealPipelineResult {
  result: ParsedMealResponse | null
  final_text: string
  telemetry: ParseMealTelemetry
}

// ---------------------------------------------------------------------
// Tiered routing — should this iter's tool results escalate to SMART?
// (S26 Step 4c)
//
// Triggers (any of):
//   1. Disambig zone — two+ candidates within 0.10 score gap above
//      CONFIDENCE_MEDIUM_THRESHOLD (0.60). Applied to BOTH library and
//      database results.
//   2. No good database match — zero database candidates with score
//      >= 0.65.
//   3. Library ambiguity — 2+ library results with label='high' AND
//      score >= 0.85 across all library calls in this iter.
//   4. Macro-math mismatch — top database candidate has a warning
//      matching /^macro_math_mismatch_/.
//
// Library suppression: if exactly one library result hits label='high'
// AND score >= 0.85, skip database trigger evaluation (the clean
// library hit moots database results per system prompt rule 1).
// ---------------------------------------------------------------------

interface ToolDispatchInfo {
  tool: string
  out: unknown
}

function shouldEscalate(dispatches: ToolDispatchInfo[]): boolean {
  type Result = {
    match_confidence?: { score?: number; label?: string; warnings?: string[] }
  }
  const getResults = (out: unknown): Result[] => {
    if (!out || typeof out !== 'object') return []
    const r = (out as { results?: unknown }).results
    return Array.isArray(r) ? (r as Result[]) : []
  }
  const score = (r: Result) => r.match_confidence?.score ?? 0
  const label = (r: Result) => r.match_confidence?.label ?? ''
  const warnings = (r: Result) => r.match_confidence?.warnings ?? []

  const libraryDispatches = dispatches.filter((d) => d.tool === 'search_user_library')
  const databaseDispatches = dispatches.filter((d) => d.tool === 'search_food_database')

  // Criterion 3: library ambiguity — count high-label library hits
  let totalHighLib = 0
  for (const d of libraryDispatches) {
    for (const r of getResults(d.out)) {
      if (label(r) === 'high' && score(r) >= 0.85) totalHighLib += 1
    }
  }
  if (totalHighLib >= 2) return true

  // Library disambig zone (criterion 1 applied to library)
  for (const d of libraryDispatches) {
    const sorted = getResults(d.out)
      .slice()
      .sort((a, b) => score(b) - score(a))
    if (sorted.length >= 2 && score(sorted[0]) >= 0.6 && score(sorted[1]) >= 0.6) {
      if (score(sorted[0]) - score(sorted[1]) < 0.1) return true
    }
  }

  // Library suppression: single clean high hit moots database triggers
  if (totalHighLib === 1) return false

  // Database-side criteria 1, 2, 4
  for (const d of databaseDispatches) {
    const sorted = getResults(d.out)
      .slice()
      .sort((a, b) => score(b) - score(a))
    // Criterion 2 (strict): no results at all
    if (sorted.length === 0) return true
    // Criterion 4: macro_math_mismatch on top candidate
    if (warnings(sorted[0]).some((w) => /^macro_math_mismatch_/.test(w))) return true
    // Criterion 2: no candidate above 0.65
    if (!sorted.some((r) => score(r) >= 0.65)) return true
    // Criterion 1: top two within 0.10 gap, both above 0.60
    if (sorted.length >= 2 && score(sorted[0]) >= 0.6 && score(sorted[1]) >= 0.6) {
      if (score(sorted[0]) - score(sorted[1]) < 0.1) return true
    }
  }

  return false
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

  // Tiered routing state (S26 Step 4c). Start on FAST; sticky escalate
  // to SMART when shouldEscalate() returns true on this iter's tool
  // results.
  let currentModel = CLAUDE_MODEL_FAST
  let escalated = false
  let escalatedAtIter: number | null = null
  const perIterModel: string[] = []

  for (it = 0; it < maxIters; it++) {
    const iterModel = currentModel
    perIterModel.push(iterModel)

    const resp: Message = await client.messages.create({
      model: iterModel,
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
      const dispatchesThisIter: ToolDispatchInfo[] = []
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
            model: iterModel,
          })
          dispatchesThisIter.push({ tool: tu.name, out })
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(out),
          })
        } else if (block.type === 'text') {
          finalText += (block as TextBlock).text + '\n'
        }
      }
      // Sticky escalation: once SMART, stay SMART for the rest of the request.
      if (!escalated && shouldEscalate(dispatchesThisIter)) {
        currentModel = CLAUDE_MODEL_SMART
        escalated = true
        escalatedAtIter = it
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
      per_iter_model: perIterModel,
      escalated,
      escalated_at_iter: escalatedAtIter,
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
