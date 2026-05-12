// Op FASTRAK Alpha.6 Sub-fix C / C.1 — heart-icon save/un-save handler.
//
// Per Sub-fix C.1 (per-food cards from Brick Zeta scope-fold), the
// endpoint takes a {user_id, food_log_entry_id, food_index} triple.
// Hearting a card targets THAT food (not the whole entry); un-hearting
// targets the same one.
//
//   POST   — heart food_log_entries[id].foods_json[food_index].
//            Two-path lookup for an existing single-food saved_meal:
//              Path A: if food.source_ref starts with 'lib:saved_meal:',
//                      direct ID lookup against that uuid (handles re-
//                      logged saved_meals where the food's source_ref
//                      points back at its origin).
//              Path B: name + foods_json[0].source_ref + jsonb_array_
//                      length=1 match (handles never-favorited foods,
//                      including legacy null-source entries).
//            If found: idempotent UPDATE is_favorite=true on that
//                      saved_meal.
//            If not: INSERT new single-food saved_meal from foods_json
//                    [food_index] with is_favorite=true.
//
//   DELETE — same lookup; UPDATE is_favorite=false. 404 if no match.
//
// The food_log_entries.saved_meal_id audit column tracks WHOLE-ENTRY
// → saved_meal correspondence (used by meals/log's lib:saved_meal: re-
// log increment path). It is NOT updated by per-food hearts; per-food
// dedup uses the lookup paths above. Independent semantics.
//
// Both flows bust the user's parse-meal response cache on success
// (Alpha.5 pattern relocated from meals/log/route.ts — library state
// changed, next parse-meal call should reflect the new favorites tier).

import type { SupabaseClient } from '@supabase/supabase-js'

import { bustResponseCacheForUser } from '@/lib/claude/parse-meal-response-cache'
import { assertCanonicalUserId, PantheonUserError } from '@/lib/pantheon-user'
import { createClient } from '@/lib/supabase/server'
import type { FoodItem } from '@/types/database'

interface HeartBody {
  user_id: string
  food_log_entry_id: string
  food_index: number
}

function bad(status: number, error: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error, ...extra }, { status })
}

async function parseAndValidate(request: Request): Promise<HeartBody | Response> {
  let body: HeartBody
  try {
    body = (await request.json()) as HeartBody
  } catch {
    return bad(400, 'invalid JSON body')
  }
  if (!body.food_log_entry_id || typeof body.food_log_entry_id !== 'string') {
    return bad(400, 'food_log_entry_id required')
  }
  if (typeof body.food_index !== 'number' || body.food_index < 0 || !Number.isInteger(body.food_index)) {
    return bad(400, 'food_index required (non-negative integer)')
  }
  return body
}

// Two-path lookup for the saved_meal that represents this food.
// Returns the saved_meal id if found, else null.
async function findSavedMealForFood(
  supabase: SupabaseClient,
  userId: string,
  food: FoodItem,
): Promise<string | null> {
  // Path A — food.source_ref points back at a saved_meal.
  const ref = food.source_ref ?? ''
  if (ref.startsWith('lib:saved_meal:')) {
    const targetId = ref.slice('lib:saved_meal:'.length)
    const { data } = await supabase
      .from('saved_meals')
      .select('id')
      .eq('id', targetId)
      .eq('user_id', userId)
      .maybeSingle()
    if (data) return data.id
  }

  // Path B — name + foods_json[0].source_ref + single-food match.
  // ilike on name is case-insensitive. Trim handles whitespace. Then
  // filter in JS for the source_ref + array-length constraints (mixing
  // SQL column filters with JSONB-deep filters in supabase-js is awkward;
  // single-tenant scale makes the in-memory filter cheap).
  const { data: candidates } = await supabase
    .from('saved_meals')
    .select('id, foods_json')
    .eq('user_id', userId)
    .ilike('name', food.name.trim())
    .limit(20)

  for (const row of candidates ?? []) {
    const foodsJson = row.foods_json as FoodItem[] | null
    if (!Array.isArray(foodsJson) || foodsJson.length !== 1) continue
    const candidateRef = foodsJson[0]?.source_ref ?? ''
    if (candidateRef === ref) return row.id
  }
  return null
}

export async function POST(request: Request) {
  const parsed = await parseAndValidate(request)
  if (parsed instanceof Response) return parsed
  const { user_id, food_log_entry_id, food_index } = parsed

  const supabase = await createClient()
  let userId: string
  try {
    userId = await assertCanonicalUserId(supabase, user_id)
  } catch (error) {
    if (error instanceof PantheonUserError) return bad(error.status, error.message)
    throw error
  }

  const { data: logRow, error: logErr } = await supabase
    .from('food_log_entries')
    .select('id, user_id, foods_json')
    .eq('id', food_log_entry_id)
    .maybeSingle()

  if (logErr) return bad(500, `food_log_entries lookup failed: ${logErr.message}`)
  if (!logRow) return bad(404, 'food_log_entry not found')
  if (logRow.user_id !== userId) return bad(403, 'user_id mismatch')

  const foods = (logRow.foods_json ?? []) as FoodItem[]
  if (food_index >= foods.length) {
    return bad(400, `food_index ${food_index} out of range (foods_json has ${foods.length} items)`)
  }
  const targetFood = foods[food_index]

  const existingId = await findSavedMealForFood(supabase, userId, targetFood)

  let savedMealId: string

  if (existingId) {
    const { error: updErr } = await supabase
      .from('saved_meals')
      .update({ is_favorite: true })
      .eq('id', existingId)
    if (updErr) return bad(500, `saved_meals update failed: ${updErr.message}`)
    savedMealId = existingId
  } else {
    // INSERT a new single-food saved_meal from targetFood. Macros
    // come straight from the food (not the entry's totals — those
    // would over-count when other foods exist in the same entry).
    const { data: ins, error: insErr } = await supabase
      .from('saved_meals')
      .insert({
        user_id: userId,
        name: targetFood.name ?? 'Untitled food',
        foods_json: [targetFood],
        total_calories: Math.round(targetFood.calories ?? 0),
        total_protein_g: Number(targetFood.protein_g ?? 0),
        total_carbs_g: Number(targetFood.carbs_g ?? 0),
        total_fat_g: Number(targetFood.fat_g ?? 0),
        times_logged: 1,
        last_logged_at: new Date().toISOString(),
        yield_servings: 1,
        is_favorite: true,
        tags: [],
      })
      .select('id')
      .single()
    if (insErr || !ins) {
      return bad(500, `saved_meals insert failed: ${insErr?.message ?? 'unknown'}`)
    }
    savedMealId = ins.id
  }

  await bustResponseCacheForUser(supabase, userId)

  return Response.json({
    saved_meal_id: savedMealId,
    is_favorite: true,
  })
}

export async function DELETE(request: Request) {
  const parsed = await parseAndValidate(request)
  if (parsed instanceof Response) return parsed
  const { user_id, food_log_entry_id, food_index } = parsed

  const supabase = await createClient()
  let userId: string
  try {
    userId = await assertCanonicalUserId(supabase, user_id)
  } catch (error) {
    if (error instanceof PantheonUserError) return bad(error.status, error.message)
    throw error
  }

  const { data: logRow, error: logErr } = await supabase
    .from('food_log_entries')
    .select('id, user_id, foods_json')
    .eq('id', food_log_entry_id)
    .maybeSingle()

  if (logErr) return bad(500, `food_log_entries lookup failed: ${logErr.message}`)
  if (!logRow) return bad(404, 'food_log_entry not found')
  if (logRow.user_id !== userId) return bad(403, 'user_id mismatch')

  const foods = (logRow.foods_json ?? []) as FoodItem[]
  if (food_index >= foods.length) {
    return bad(400, `food_index ${food_index} out of range (foods_json has ${foods.length} items)`)
  }
  const targetFood = foods[food_index]

  const existingId = await findSavedMealForFood(supabase, userId, targetFood)
  if (!existingId) {
    return bad(404, 'no saved_meal exists for this food')
  }

  const { error: updErr } = await supabase
    .from('saved_meals')
    .update({ is_favorite: false })
    .eq('id', existingId)
  if (updErr) return bad(500, `saved_meals update failed: ${updErr.message}`)

  await bustResponseCacheForUser(supabase, userId)

  return Response.json({
    saved_meal_id: existingId,
    is_favorite: false,
  })
}
