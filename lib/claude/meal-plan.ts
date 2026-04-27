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

Aim for the daily macro targets within ±10%. If catalog density
makes ±10% impossible, get as close as you can and prefer protein
adherence over fat or carbs adherence — protein 200g is the most
important target.

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

export async function generateMealPlan(
  input: GenerateMealPlanInput,
): Promise<{ entries: GeneratedEntry[]; raw_text: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set in .env.local')
  }

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

  const validation = validateGeneratedEntries(
    parsed,
    recipeIds,
    productIds,
    input.plan_date_start,
    input.plan_date_end,
  )
  if (!validation.ok) {
    throw new Error(`Claude response failed validation: ${validation.error}`)
  }

  return { entries: validation.entries, raw_text: text }
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
