import { client } from './claude'
import type {
  EntrySourceType,
  MealSlot,
  Product,
  Recipe,
  UserPreferences,
} from '@/types/database'

export const MEAL_PLAN_SYSTEM_PROMPT = `
You are Pantheon's batch meal planner. Generate a 4-day meal batch as
strict JSON only — no prose, no code fences. Honor preferences,
excluded ingredients, and macro targets within ±10% variance.

A batch covers ~4 consecutive days. The user cooks one dinner recipe
at the start of the batch (yielding ~6 servings) and eats it as
dinner across most days of the batch, occasionally as lunch when
convenient. Plan accordingly: assign the same dinner recipe to
multiple days; lunch can sometimes reuse dinner leftovers (set
source_id to the dinner recipe with a note like 'leftover from cook
day').

Each day has slots: breakfast, lunch, dinner, snack, and optionally
a second snack or dessert.

A slot may contain one or more entries — e.g., a 'breakfast' slot
might be a single egg recipe (1 entry) or a parfait of yogurt +
berries + honey (3 entries). Use multiple entries when the meal is
genuinely multi-component.

Each slot's entries must collectively resemble its meal type:
  - breakfast: cereals, yogurts, eggs, oatmeal, fruit, bread —
    morning foods
  - lunch: a primary item (recipe, scramble, cottage cheese bowl)
    plus optional sides
  - dinner: a primary cooked dish (recipe) with optional sides.
    NEVER fill dinner with only bars/shakes/snacks.
  - snack: bars, shakes, fruit, yogurt, small handheld items
Multi-entry slots are fine, but the entries must collectively look
like the meal type. 'Two protein bars' is not a dinner.
'Bolognese 1.5x + side salad' is.

When choosing the cook-day dinner that anchors a 3-4 day batch,
prefer recipes with servings >= 6. Lower-yield recipes are
acceptable when no high-yield option fits the day's macros or
excludes.

Before returning the JSON, verify each entry: if source_id appears
in AVAILABLE RECIPES, set source_type='recipe'. If source_id
appears in AVAILABLE PRODUCTS, set source_type='product'. The two
lists never overlap.

Macro targets are daily totals, not per-slot. If one slot runs heavy
or light, balance the day by adjusting other slots — e.g., a heavier
lunch can be paired with a smaller snack or dessert; a light
breakfast can be paired with a more substantial mid-morning snack.

Prefer recipes for cooked meals (lunch, dinner). Prefer products for
assembly meals (breakfast, snacks, desserts) when they fit. Lunch
can be either — leftovers from dinner OR a product/light recipe.

Vary cuisine and protein source across the batch. Do not repeat
dishes from the user's recent batches (provided as context).

Never invent items not in the catalog. Every entry must reference a
real id from AVAILABLE RECIPES or AVAILABLE PRODUCTS. If no item in
the catalog fits a slot, return that slot with the closest available
item and add a note like 'closest available — catalog gap'. Never
fabricate a UUID.

Return strict JSON in this exact shape:
{
  "entries": [
    {
      "meal_date": "YYYY-MM-DD",
      "slot": "breakfast|lunch|dinner|snack",
      "source_type": "recipe|product",
      "source_id": "<uuid from supplied lists>",
      "servings": <number>,
      "notes": "<short string or null>"
    }
  ]
}

Servings can be fractional for products (0.5, 0.25). Notes per entry
should be brief.
`

export const MEAL_PLAN_DAY_CORRECTION_PROMPT = `
You are correcting a single day in an existing meal plan to hit
macro targets. The plan was generated in a first pass that came up
short on calories or protein for this day. Make MINIMAL changes —
this is a touch-up, not a redo.

Return strict JSON only — no prose, no code fences. Same shape as
plan generation, but containing only this day's entries:
{
  "entries": [
    {
      "meal_date": "YYYY-MM-DD",
      "slot": "breakfast|lunch|dinner|snack",
      "source_type": "recipe|product",
      "source_id": "<uuid from supplied lists>",
      "servings": <number>,
      "notes": "<short string or null>"
    }
  ]
}

Return the FULL day's corrected entries (the server replaces the
day's entries wholesale — do not return deltas).

GOAL — hit the macro band:
Aim for both calorie and protein totals in the 90-110% band, ideally
95-105%. Once protein crosses 100% of target, prefer carb/fat-
balanced foods (oats, breads, fruit, honey, ice cream, pasta) for
any remaining calorie gap. Do NOT keep stacking protein once protein
is on target.

FRACTIONAL SERVINGS — encouraged and expected:
Servings should be tuned to the precision needed to land in the
95-105% band. Fractional servings are valid and expected: 1.5x,
0.66x, 2.25x, 0.75x are all fine. Do not restrict yourself to whole
numbers — the user is targeting precise macros, and round numbers
are rarely the right answer.
Examples:
  - Cottage Cheese 0.66 (≈ 2/3 cup, ~73 cal)
  - Quaker Oats 1.5 (1.5x base serving)
  - Killer Bread 1.33 (slightly more than one slice's worth)
  - Protein Shake 1.5 (1.5 scoops worth)

ABSORPTION ORDER — where to put calories:
Close calorie shortfall via lunch first (largest flexible slot),
then breakfast, then snacks. Increase servings on existing entries
(including fractional bumps) before adding new entries.

SLOT SEMANTICS — entries must look like the meal:
Each slot's entries must collectively resemble its meal type:
  - breakfast: cereals, yogurts, eggs, oatmeal, fruit, bread —
    morning foods
  - lunch: a primary item (recipe, scramble, cottage cheese bowl)
    plus optional sides
  - dinner: a primary cooked dish (recipe) with optional sides.
    NEVER fill dinner with only bars/shakes/snacks.
  - snack: bars, shakes, fruit, yogurt, small handheld items
Multi-entry slots are fine, but 'two protein bars' is not a dinner.
'Bolognese 1.5x + side salad' is.

OTHER RULES:
- When you must add entries, prefer the catalog's existing
  high-protein products: cottage cheese, protein shakes, eggs,
  Greek yogurt, protein bars. Repetition is fine.
- Do NOT change the dinner entry if it carries a 'cook day' or
  'leftover from cook day' note — that's a multi-day batch anchor.
- Verify each entry: if source_id appears in AVAILABLE RECIPES set
  source_type='recipe'; if in AVAILABLE PRODUCTS set
  source_type='product'. The two lists never overlap.
- Never invent items not in the catalog. Use only ids from the
  supplied lists.

Notes per entry should be brief.
`

export interface GeneratedEntry {
  meal_date: string
  slot: MealSlot
  source_type: EntrySourceType
  source_id: string
  servings: number
  notes: string | null
}

export interface LockedEntrySnapshot {
  date: string
  slot: MealSlot
  source_name: string
  macros: {
    calories: number | null
    protein_g: number | null
    fat_g: number | null
    carbs_g: number | null
  }
}

export interface GenerateMealPlanInput {
  plan_date_start: string
  plan_date_end: string
  daily_target_macros: {
    calories?: number | null
    protein_g?: number | null
    carbs_g?: number | null
    fat_g?: number | null
  } | null
  preferences: UserPreferences
  recipes: Recipe[]
  products: Product[]
  recent_dinner_names: string[]
  locked_entries: LockedEntrySnapshot[]
  notes?: string | null
}

function compactRecipes(recipes: Recipe[]) {
  return recipes.map((r) => ({
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    protein_type: r.protein_type,
    calories: r.calories,
    protein_g: r.protein_g,
    carbs_g: r.carbs_g,
    fat_g: r.fat_g,
    servings: r.servings,
  }))
}

function compactProducts(products: Product[]) {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    unit: p.unit,
    calories: p.calories_per_serving,
    protein_g: p.protein_g_per_serving,
    fat_g: p.fat_g_per_serving,
    carbs_g: p.carbs_g_per_serving,
    fulfillment_source: p.fulfillment_source,
  }))
}

function buildUserMessage(input: GenerateMealPlanInput): string {
  const m = input.daily_target_macros ?? {}
  const macroLine =
    `protein ${m.protein_g ?? '?'}g, fat ${m.fat_g ?? '?'}g, ` +
    `carbs ${m.carbs_g ?? '?'}g (calories ~${m.calories ?? '?'}, ±10% variance OK)`

  const lockedRendered =
    input.locked_entries.length === 0
      ? 'none'
      : JSON.stringify(input.locked_entries)

  return [
    `PLAN WINDOW: ${input.plan_date_start} to ${input.plan_date_end}`,
    `DAILY MACRO TARGETS: ${macroLine}`,
    `FREEFORM NOTES: ${input.preferences.notes ?? 'none'}`,
    `CUISINE LIKES: ${JSON.stringify(input.preferences.cuisine_likes)}`,
    `CUISINE DISLIKES: ${JSON.stringify(input.preferences.cuisine_dislikes)}`,
    `PROTEIN LIKES: ${JSON.stringify(input.preferences.protein_likes)}`,
    `PROTEIN DISLIKES: ${JSON.stringify(input.preferences.protein_dislikes)}`,
    `EXCLUDED INGREDIENTS: ${JSON.stringify(input.preferences.excluded_ingredients)}`,
    '',
    `AVAILABLE RECIPES:`,
    JSON.stringify(compactRecipes(input.recipes)),
    '',
    `AVAILABLE PRODUCTS:`,
    JSON.stringify(compactProducts(input.products)),
    '',
    `RECENT BATCHES (avoid duplicating dinners):`,
    JSON.stringify(input.recent_dinner_names),
    '',
    `LOCKED SLOTS (do not change, plan around these):`,
    lockedRendered,
    '',
    `NOTES FROM USER: ${input.notes ?? 'none'}`,
  ].join('\n')
}

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
}

const VALID_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

function isYmd(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

export function validateGeneratedEntries(
  raw: unknown,
  recipeIds: Set<string>,
  productIds: Set<string>,
  windowStart: string,
  windowEnd: string,
): { ok: true; entries: GeneratedEntry[] } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'response is not an object' }
  }
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.entries)) {
    return { ok: false, error: 'entries must be an array' }
  }
  const out: GeneratedEntry[] = []
  for (let i = 0; i < obj.entries.length; i++) {
    const e = obj.entries[i] as Record<string, unknown>
    if (!e || typeof e !== 'object') {
      return { ok: false, error: `entries[${i}] is not an object` }
    }
    if (!isYmd(e.meal_date)) {
      return { ok: false, error: `entries[${i}].meal_date must be YYYY-MM-DD` }
    }
    if (e.meal_date < windowStart || e.meal_date > windowEnd) {
      return {
        ok: false,
        error: `entries[${i}].meal_date ${e.meal_date} outside [${windowStart}, ${windowEnd}]`,
      }
    }
    if (typeof e.slot !== 'string' || !(VALID_SLOTS as string[]).includes(e.slot)) {
      return { ok: false, error: `entries[${i}].slot must be one of ${VALID_SLOTS.join('|')}` }
    }
    if (e.source_type !== 'recipe' && e.source_type !== 'product') {
      return { ok: false, error: `entries[${i}].source_type must be 'recipe' or 'product'` }
    }
    if (typeof e.source_id !== 'string') {
      return { ok: false, error: `entries[${i}].source_id must be a string` }
    }
    const pool = e.source_type === 'recipe' ? recipeIds : productIds
    if (!pool.has(e.source_id)) {
      return {
        ok: false,
        error: `entries[${i}].source_id ${e.source_id} not in supplied ${e.source_type} catalog`,
      }
    }
    if (typeof e.servings !== 'number' || !(e.servings > 0)) {
      return { ok: false, error: `entries[${i}].servings must be a positive number` }
    }
    if (e.notes !== null && e.notes !== undefined && typeof e.notes !== 'string') {
      return { ok: false, error: `entries[${i}].notes must be a string or null` }
    }
    out.push({
      meal_date: e.meal_date,
      slot: e.slot as MealSlot,
      source_type: e.source_type,
      source_id: e.source_id,
      servings: e.servings,
      notes: (e.notes as string | null | undefined) ?? null,
    })
  }
  return { ok: true, entries: out }
}

/**
 * Overwrite each entry's source_type with the catalog's truth.
 * If source_id is in neither pool, leave the claimed source_type
 * alone — the strict validator will catch it downstream.
 */
export function correctSourceTypes(
  entries: GeneratedEntry[],
  recipeIds: Set<string>,
  productIds: Set<string>,
): { corrected: GeneratedEntry[]; corrections: number } {
  let corrections = 0
  const corrected = entries.map((e) => {
    const truth: EntrySourceType | null = recipeIds.has(e.source_id)
      ? 'recipe'
      : productIds.has(e.source_id)
        ? 'product'
        : null
    if (truth && truth !== e.source_type) {
      corrections += 1
      return { ...e, source_type: truth }
    }
    return e
  })
  return { corrected, corrections }
}

export interface DayTotals {
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
}

/**
 * Sum macros per day from validated entries, joined to catalog rows.
 * Recipe macros are stored per-recipe (calories, protein_g, etc. are
 * totals for the recipe's `servings` count — divide by recipe.servings
 * to get per-serving). Product macros are stored per-serving.
 */
export function computeDayMacros(
  entries: GeneratedEntry[],
  recipes: Recipe[],
  products: Product[],
): Map<string, DayTotals> {
  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  const productById = new Map(products.map((p) => [p.id, p]))
  const out = new Map<string, DayTotals>()
  for (const e of entries) {
    let cal = 0
    let p = 0
    let f = 0
    let c = 0
    if (e.source_type === 'recipe') {
      const r = recipeById.get(e.source_id)
      if (r) {
        const denom = r.servings && r.servings > 0 ? r.servings : 1
        cal = ((r.calories ?? 0) / denom) * e.servings
        p = ((r.protein_g ?? 0) / denom) * e.servings
        f = ((r.fat_g ?? 0) / denom) * e.servings
        c = ((r.carbs_g ?? 0) / denom) * e.servings
      }
    } else {
      const pr = productById.get(e.source_id)
      if (pr) {
        cal = (pr.calories_per_serving ?? 0) * e.servings
        p = (pr.protein_g_per_serving ?? 0) * e.servings
        f = (pr.fat_g_per_serving ?? 0) * e.servings
        c = (pr.carbs_g_per_serving ?? 0) * e.servings
      }
    }
    const cur = out.get(e.meal_date) ?? { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 }
    cur.calories += cal
    cur.protein_g += p
    cur.fat_g += f
    cur.carbs_g += c
    out.set(e.meal_date, cur)
  }
  return out
}

export interface DayCorrectionInput {
  date: string
  current_entries: GeneratedEntry[]
  current_totals: DayTotals
  daily_target_macros: GenerateMealPlanInput['daily_target_macros']
  preferences: UserPreferences
  recipes: Recipe[]
  products: Product[]
}

/**
 * Build an explicit shortfall analysis block. Gives Claude the math
 * up-front: target, band bounds (90%/110%, ideal 95-105%), current
 * totals, % of target, and the gap to the lower band edge. This is
 * what Claude needs to choose servings precisely instead of stacking
 * protein and undershooting calories.
 */
function buildShortfallAnalysis(
  current: DayTotals,
  target: { calories?: number | null; protein_g?: number | null; fat_g?: number | null; carbs_g?: number | null },
): string {
  const tCal = target.calories ?? 0
  const tP = target.protein_g ?? 0
  const tF = target.fat_g ?? 0
  const tC = target.carbs_g ?? 0

  const fmtBand = (label: string, cur: number, t: number, unit: string): string => {
    if (t <= 0) return `${label}: target unset`
    const lo90 = t * 0.9
    const hi110 = t * 1.1
    const lo95 = t * 0.95
    const hi105 = t * 1.05
    const pct = Math.round((cur / t) * 100)
    let status = ''
    if (cur < lo90) {
      const gap = lo90 - cur
      status = `BELOW BAND — need at least ${Math.round(gap)}${unit} more to reach 90%`
    } else if (cur < lo95) {
      status = `at 90-95% band edge — small bump preferred`
    } else if (cur <= hi105) {
      status = `in ideal 95-105% band ✓`
    } else if (cur <= hi110) {
      status = `at 105-110% band edge — small reduction preferred`
    } else {
      const over = cur - hi110
      status = `ABOVE BAND — ${Math.round(over)}${unit} over 110%`
    }
    return [
      `${label}:`,
      `  current: ${Math.round(cur)}${unit} (${pct}% of target)`,
      `  target:  ${t}${unit}`,
      `  band:    ${Math.round(lo90)}-${Math.round(hi110)}${unit} (90-110%)`,
      `  ideal:   ${Math.round(lo95)}-${Math.round(hi105)}${unit} (95-105%)`,
      `  status:  ${status}`,
    ].join('\n')
  }

  return [
    'SHORTFALL ANALYSIS:',
    fmtBand('CALORIES', current.calories, tCal, ''),
    fmtBand('PROTEIN ', current.protein_g, tP, 'g'),
    fmtBand('FAT     ', current.fat_g, tF, 'g'),
    fmtBand('CARBS   ', current.carbs_g, tC, 'g'),
  ].join('\n')
}

function buildDayCorrectionMessage(input: DayCorrectionInput): string {
  const t = input.daily_target_macros ?? {}
  const tCal = t.calories ?? 0
  const tP = t.protein_g ?? 0
  const tF = t.fat_g ?? 0
  const tC = t.carbs_g ?? 0
  const cur = input.current_totals

  const shortfall = buildShortfallAnalysis(cur, t)

  const recipeById = new Map(input.recipes.map((r) => [r.id, r]))
  const productById = new Map(input.products.map((p) => [p.id, p]))

  // Annotate entries with computed per-entry macros + name for context.
  const annotated = input.current_entries.map((e) => {
    let cal = 0, prot = 0, fat = 0, carb = 0, name = '???'
    if (e.source_type === 'recipe') {
      const r = recipeById.get(e.source_id)
      if (r) {
        const denom = r.servings && r.servings > 0 ? r.servings : 1
        cal = ((r.calories ?? 0) / denom) * e.servings
        prot = ((r.protein_g ?? 0) / denom) * e.servings
        fat = ((r.fat_g ?? 0) / denom) * e.servings
        carb = ((r.carbs_g ?? 0) / denom) * e.servings
        name = r.name
      }
    } else {
      const pr = productById.get(e.source_id)
      if (pr) {
        cal = (pr.calories_per_serving ?? 0) * e.servings
        prot = (pr.protein_g_per_serving ?? 0) * e.servings
        fat = (pr.fat_g_per_serving ?? 0) * e.servings
        carb = (pr.carbs_g_per_serving ?? 0) * e.servings
        name = pr.name
      }
    }
    return {
      slot: e.slot,
      source_type: e.source_type,
      source_id: e.source_id,
      name,
      servings: e.servings,
      notes: e.notes,
      calories: Math.round(cal),
      protein_g: Math.round(prot),
      fat_g: Math.round(fat),
      carbs_g: Math.round(carb),
    }
  })

  return [
    `DAY TO CORRECT: ${input.date}`,
    `DAILY MACRO TARGETS: protein ${tP}g, fat ${tF}g, carbs ${tC}g (calories ~${tCal})`,
    '',
    shortfall,
    '',
    `CURRENT ENTRIES (with computed per-entry macros):`,
    JSON.stringify(annotated),
    '',
    `CUISINE LIKES: ${JSON.stringify(input.preferences.cuisine_likes)}`,
    `CUISINE DISLIKES: ${JSON.stringify(input.preferences.cuisine_dislikes)}`,
    `PROTEIN LIKES: ${JSON.stringify(input.preferences.protein_likes)}`,
    `PROTEIN DISLIKES: ${JSON.stringify(input.preferences.protein_dislikes)}`,
    `EXCLUDED INGREDIENTS: ${JSON.stringify(input.preferences.excluded_ingredients)}`,
    '',
    `AVAILABLE RECIPES:`,
    JSON.stringify(compactRecipes(input.recipes)),
    '',
    `AVAILABLE PRODUCTS:`,
    JSON.stringify(compactProducts(input.products)),
  ].join('\n')
}

/**
 * Pass-2: re-prompt Claude to correct a single day's entries.
 * Returns the day's full corrected entries (replaces day wholesale).
 * Source_type correction + strict validation applied to the result.
 */
export async function correctDay(
  input: DayCorrectionInput,
): Promise<{ entries: GeneratedEntry[]; raw_text: string; usage_in: number; usage_out: number }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set in .env.local')
  }

  const userMessage = buildDayCorrectionMessage(input)
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: MEAL_PLAN_DAY_CORRECTION_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const block = response.content[0]
  const raw = block.type === 'text' ? block.text : ''
  const text = stripFences(raw)

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`correctDay: non-JSON response: ${msg}\n\n${text.slice(0, 500)}`)
  }

  // Pre-extract entries for source_type correction before strict validation.
  const obj = parsed as Record<string, unknown>
  if (!Array.isArray(obj.entries)) {
    throw new Error(`correctDay: response missing 'entries' array`)
  }
  const recipeIds = new Set(input.recipes.map((r) => r.id))
  const productIds = new Set(input.products.map((p) => p.id))
  const rawEntries = obj.entries as Array<Record<string, unknown>>
  const coercedEntries = rawEntries.map((e) => ({
    meal_date: typeof e.meal_date === 'string' ? e.meal_date : input.date,
    slot: e.slot,
    source_type: e.source_type,
    source_id: e.source_id,
    servings: e.servings,
    notes: e.notes,
  })) as unknown as GeneratedEntry[]
  const { corrected } = correctSourceTypes(coercedEntries, recipeIds, productIds)

  const validation = validateGeneratedEntries(
    { entries: corrected },
    recipeIds,
    productIds,
    input.date,
    input.date,
  )
  if (!validation.ok) {
    throw new Error(`correctDay validation failed for ${input.date}: ${validation.error}`)
  }
  return {
    entries: validation.entries,
    raw_text: text,
    usage_in: response.usage.input_tokens,
    usage_out: response.usage.output_tokens,
  }
}

export interface GenerateMealPlanResult {
  entries: GeneratedEntry[]
  raw_text: string
  warnings: string[]
  /** Internal trace for debug/observability. Not part of API contract. */
  trace: {
    pass1_corrections: number
    pass1_entries: GeneratedEntry[]
    pass2_days: string[]
    pass2_still_low: string[]
    pass2_usage: { in: number; out: number }
  }
}

export async function generateMealPlan(
  input: GenerateMealPlanInput,
): Promise<GenerateMealPlanResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set in .env.local')
  }

  // ---- Pass 1: full plan ---------------------------------------------------
  const userMessage = buildUserMessage(input)
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: MEAL_PLAN_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })
  const block = response.content[0]
  const raw = block.type === 'text' ? block.text : ''
  const text = stripFences(raw)

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Claude returned non-JSON response: ${msg}\n\n${text.slice(0, 500)}`)
  }

  const recipeIds = new Set(input.recipes.map((r) => r.id))
  const productIds = new Set(input.products.map((p) => p.id))

  // Source_type correction BEFORE strict validation: lookup catalog truth and
  // overwrite source_type. Belt-and-suspenders even with Rule B in the prompt.
  const obj = parsed as Record<string, unknown>
  if (!Array.isArray(obj.entries)) {
    throw new Error(`Claude response missing 'entries' array`)
  }
  const rawEntries = obj.entries as Array<Record<string, unknown>>
  const coercedEntries = rawEntries.map((e) => ({
    meal_date: e.meal_date,
    slot: e.slot,
    source_type: e.source_type,
    source_id: e.source_id,
    servings: e.servings,
    notes: e.notes,
  })) as unknown as GeneratedEntry[]
  const { corrected: pass1Corrected, corrections: pass1Corrections } =
    correctSourceTypes(coercedEntries, recipeIds, productIds)

  const validation = validateGeneratedEntries(
    { entries: pass1Corrected },
    recipeIds,
    productIds,
    input.plan_date_start,
    input.plan_date_end,
  )
  if (!validation.ok) {
    throw new Error(`Claude response failed validation: ${validation.error}`)
  }

  // Snapshot pass-1 entries for the trace before any pass-2 mutation.
  const pass1Entries = validation.entries.slice()

  // ---- Pass 2: per-day correction for short days ---------------------------
  const target = input.daily_target_macros ?? {}
  const tCal = target.calories ?? 0
  const tP = target.protein_g ?? 0
  const dayMacros = computeDayMacros(validation.entries, input.recipes, input.products)

  const lowDays: string[] = []
  for (const [date, totals] of [...dayMacros.entries()].sort()) {
    const calLow = tCal > 0 && totals.calories < tCal * 0.9
    const protLow = tP > 0 && totals.protein_g < tP * 0.9
    if (calLow || protLow) lowDays.push(date)
  }

  let finalEntries = validation.entries.slice()
  const warnings: string[] = []
  const pass2StillLow: string[] = []
  let pass2InTokens = 0
  let pass2OutTokens = 0

  for (const date of lowDays) {
    const dayEntries = finalEntries.filter((e) => e.meal_date === date)
    const currentTotals = dayMacros.get(date) ?? { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 }
    const correction = await correctDay({
      date,
      current_entries: dayEntries,
      current_totals: currentTotals,
      daily_target_macros: input.daily_target_macros,
      preferences: input.preferences,
      recipes: input.recipes,
      products: input.products,
    })
    pass2InTokens += correction.usage_in
    pass2OutTokens += correction.usage_out

    // Replace the day's entries wholesale.
    finalEntries = [
      ...finalEntries.filter((e) => e.meal_date !== date),
      ...correction.entries,
    ]

    // Re-check macros for this day after correction.
    const fixedDayTotals = computeDayMacros(correction.entries, input.recipes, input.products).get(date)
    if (fixedDayTotals) {
      const stillCalLow = tCal > 0 && fixedDayTotals.calories < tCal * 0.9
      const stillProtLow = tP > 0 && fixedDayTotals.protein_g < tP * 0.9
      if (stillCalLow || stillProtLow) {
        pass2StillLow.push(date)
        const calPct = tCal > 0 ? Math.round((fixedDayTotals.calories / tCal) * 100) : 0
        const pPct = tP > 0 ? Math.round((fixedDayTotals.protein_g / tP) * 100) : 0
        warnings.push(
          `${date}: still below 90% after pass-2 correction (${calPct}% cal, ${pPct}% protein) — accepting result`,
        )
      }
    }
  }

  // Upper-bound check: emit warnings for any final day that exceeds
  // 110% on calories or protein. Symmetric to the under-90% flagging
  // above. The UI uses these to surface 'Regenerate this day' prompts.
  const finalDayMacros = computeDayMacros(finalEntries, input.recipes, input.products)
  for (const [date, totals] of [...finalDayMacros.entries()].sort()) {
    if (tCal > 0 && totals.calories > tCal * 1.1) {
      warnings.push(
        `${date}: above 110% on calories (${Math.round(totals.calories)}/${tCal})`,
      )
    }
    if (tP > 0 && totals.protein_g > tP * 1.1) {
      warnings.push(
        `${date}: above 110% on protein (${Math.round(totals.protein_g)}/${tP})`,
      )
    }
  }

  // Sort final entries by date then slot for deterministic ordering.
  const slotOrder: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 }
  finalEntries.sort((a, b) => {
    if (a.meal_date !== b.meal_date) return a.meal_date < b.meal_date ? -1 : 1
    return (slotOrder[a.slot] ?? 9) - (slotOrder[b.slot] ?? 9)
  })

  return {
    entries: finalEntries,
    raw_text: text,
    warnings,
    trace: {
      pass1_corrections: pass1Corrections,
      pass1_entries: pass1Entries,
      pass2_days: lowDays,
      pass2_still_low: pass2StillLow,
      pass2_usage: { in: pass2InTokens, out: pass2OutTokens },
    },
  }
}

export const REROLL_SYSTEM_PROMPT = `
You are Pantheon's batch meal planner. The user wants to swap one
slot in an existing 4-day batch. Suggest exactly one replacement
that fits the slot, honors preferences and excluded ingredients,
and helps the day's macro totals stay within ±10% of targets.

Pick from AVAILABLE RECIPES or AVAILABLE PRODUCTS only — never
invent items.

Return strict JSON in this exact shape, no prose, no code fences:
{
  "source_type": "recipe|product",
  "source_id": "<uuid from supplied lists>",
  "servings": <number>,
  "notes": "<short string or null>"
}
`

export interface RerollInput {
  current_entry: {
    meal_date: string
    slot: MealSlot
    source_type: EntrySourceType
    source_id: string
    source_name: string
  }
  same_day_entries: Array<{
    slot: MealSlot
    source_type: EntrySourceType
    source_name: string
    calories: number | null
    protein_g: number | null
    fat_g: number | null
    carbs_g: number | null
    servings: number
  }>
  other_batch_dinners: Array<{
    date: string
    source_name: string
    cuisine: string | null
  }>
  daily_target_macros: GenerateMealPlanInput['daily_target_macros']
  preferences: UserPreferences
  recipes: Recipe[]
  products: Product[]
  reason?: string | null
}

export async function rerollSlot(
  input: RerollInput,
): Promise<GeneratedEntry> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set in .env.local')
  }

  const m = input.daily_target_macros ?? {}
  const userMessage = [
    `SLOT TO REPLACE: ${input.current_entry.slot} on ${input.current_entry.meal_date}`,
    `CURRENT ITEM: ${input.current_entry.source_name} (${input.current_entry.source_type})`,
    `REASON FOR REROLL: ${input.reason ?? 'no reason given'}`,
    '',
    `DAILY MACRO TARGETS: protein ${m.protein_g ?? '?'}g, fat ${m.fat_g ?? '?'}g, carbs ${m.carbs_g ?? '?'}g, calories ~${m.calories ?? '?'}`,
    '',
    `OTHER ENTRIES THE SAME DAY:`,
    JSON.stringify(input.same_day_entries),
    '',
    `OTHER DINNERS IN THIS BATCH:`,
    input.other_batch_dinners.length === 0
      ? '[]'
      : JSON.stringify(input.other_batch_dinners),
    '',
    `CUISINE LIKES: ${JSON.stringify(input.preferences.cuisine_likes)}`,
    `CUISINE DISLIKES: ${JSON.stringify(input.preferences.cuisine_dislikes)}`,
    `PROTEIN LIKES: ${JSON.stringify(input.preferences.protein_likes)}`,
    `PROTEIN DISLIKES: ${JSON.stringify(input.preferences.protein_dislikes)}`,
    `EXCLUDED INGREDIENTS: ${JSON.stringify(input.preferences.excluded_ingredients)}`,
    '',
    `AVAILABLE RECIPES:`,
    JSON.stringify(compactRecipes(input.recipes)),
    '',
    `AVAILABLE PRODUCTS:`,
    JSON.stringify(compactProducts(input.products)),
  ].join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: REROLL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const block = response.content[0]
  const raw = block.type === 'text' ? block.text : ''
  const text = stripFences(raw)

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Claude returned non-JSON response: ${msg}\n\n${text.slice(0, 500)}`)
  }

  const obj = parsed as Record<string, unknown>
  if (obj.source_type !== 'recipe' && obj.source_type !== 'product') {
    throw new Error(`reroll: source_type must be 'recipe' or 'product'`)
  }
  if (typeof obj.source_id !== 'string') {
    throw new Error(`reroll: source_id must be a string`)
  }
  const recipeIds = new Set(input.recipes.map((r) => r.id))
  const productIds = new Set(input.products.map((p) => p.id))
  const pool = obj.source_type === 'recipe' ? recipeIds : productIds
  if (!pool.has(obj.source_id)) {
    throw new Error(`reroll: source_id ${obj.source_id} not in supplied ${obj.source_type} catalog`)
  }
  if (typeof obj.servings !== 'number' || !(obj.servings > 0)) {
    throw new Error(`reroll: servings must be a positive number`)
  }
  if (obj.notes !== null && obj.notes !== undefined && typeof obj.notes !== 'string') {
    throw new Error(`reroll: notes must be a string or null`)
  }

  return {
    meal_date: input.current_entry.meal_date,
    slot: input.current_entry.slot,
    source_type: obj.source_type,
    source_id: obj.source_id,
    servings: obj.servings,
    notes: (obj.notes as string | null | undefined) ?? null,
  }
}
