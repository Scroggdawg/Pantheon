// S26 Step 3 — POST /api/meals/log (per Op FASTRAK Alpha.6 Sub-fix B,
// Shape E redesign).
//
// Inserts a food_log_entries row. If library_source_ref starts with
// "lib:saved_meal:", increment times_logged + bump last_logged_at on
// that saved_meals row (the only branch that mutates saved_meals from
// this route — Alpha.6 removed the auto-promote create path; the heart-
// icon save handler at /api/saved_meals/heart is the sole path that
// creates saved_meals or flips is_favorite).
//
// "Transactional" guarantee: if the saved_meals update step fails, roll
// back the food_log_entries insert. Supabase JS doesn't expose a real
// BEGIN/COMMIT, so we DELETE the inserted row on failure (best-effort
// compensation; surfaced in the response if compensation itself fails).

import { createClient } from '@/lib/supabase/server'
import { assertCanonicalUserId, PantheonUserError } from '@/lib/pantheon-user'
import type { DayType, FoodItem, LogMethod } from '@/types/database'

interface MealsLogBody {
  foods: FoodItem[]
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  meal_label: string
  day_type: DayType
  log_method: LogMethod
  raw_input_text: string | null
  claude_parse_json: unknown
  user_id: string
  library_source_ref: string | null
}

type SavedMealAction = 'incremented' | 'none'

function bad(status: number, error: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error, ...extra }, { status })
}

export async function POST(request: Request) {
  let body: MealsLogBody
  try {
    body = (await request.json()) as MealsLogBody
  } catch {
    return bad(400, 'invalid JSON body')
  }

  if (!Array.isArray(body.foods) || body.foods.length === 0) return bad(400, 'foods[] required')
  if (!body.day_type) return bad(400, 'day_type required')
  if (!body.log_method) return bad(400, 'log_method required')
  if (!body.meal_label) return bad(400, 'meal_label required')

  const supabase = await createClient()
  let userId: string
  try {
    userId = await assertCanonicalUserId(supabase, body.user_id)
  } catch (error) {
    if (error instanceof PantheonUserError) return bad(error.status, error.message)
    throw error
  }

  // Op FASTRAK Alpha.7 + Alpha.6 — extract the saved_meal UUID up front
  // for the food_log_entries.saved_meal_id audit column. Only the
  // "lib:saved_meal:" classification matters post-Alpha.6: product-ref
  // and no-library-ref paths no longer create saved_meals from this
  // route, so their classifier flags were trimmed in Sub-fix B.
  const isSavedMealRef = body.library_source_ref?.startsWith('lib:saved_meal:') ?? false
  const savedMealRefUuid: string | null = isSavedMealRef
    ? body.library_source_ref!.slice('lib:saved_meal:'.length)
    : null

  // ---- 1. Insert the food_log_entries row ----
  const { data: logRow, error: logErr } = await supabase
    .from('food_log_entries')
    .insert({
      user_id: userId,
      meal_label: body.meal_label,
      day_type: body.day_type,
      foods_json: body.foods,
      total_calories: body.total_calories,
      total_protein_g: body.total_protein_g,
      total_carbs_g: body.total_carbs_g,
      total_fat_g: body.total_fat_g,
      log_method: body.log_method,
      raw_input_text: body.raw_input_text,
      claude_parse_json: body.claude_parse_json,
      saved_meal_id: savedMealRefUuid,
    })
    .select('id')
    .single()

  if (logErr || !logRow) {
    console.error('[meals/log] food_log_entries insert failed:', logErr?.message)
    return bad(500, `food_log_entries insert failed: ${logErr?.message ?? 'unknown'}`)
  }

  // ---- 2. Increment-only saved_meals path ----
  // Re-logging an existing saved_meal bumps its times_logged + last_logged_at,
  // which feeds hourly_go_tos weighting (migration 016). Novel meals and
  // product-ref-only meals fall through with savedMealAction='none' — the
  // user explicitly hearts via /api/saved_meals/heart to promote.
  let savedMealId: string | null = null
  let savedMealAction: SavedMealAction = 'none'

  try {
    if (isSavedMealRef) {
      const uuid = savedMealRefUuid!
      const { data: existing, error: getErr } = await supabase
        .from('saved_meals')
        .select('times_logged')
        .eq('id', uuid)
        .eq('user_id', userId)
        .single()
      if (getErr || !existing) {
        throw new Error(
          `saved_meals lookup for ${uuid} failed: ${getErr?.message ?? 'not found'}`,
        )
      }
      const { error: updErr } = await supabase
        .from('saved_meals')
        .update({
          times_logged: (existing.times_logged ?? 0) + 1,
          last_logged_at: new Date().toISOString(),
        })
        .eq('id', uuid)
        .eq('user_id', userId)
      if (updErr) throw new Error(`saved_meals update failed: ${updErr.message}`)
      savedMealId = uuid
      savedMealAction = 'incremented'
    }
  } catch (e) {
    // Compensation: roll back the food_log_entries insert.
    const { error: delErr } = await supabase
      .from('food_log_entries')
      .delete()
      .eq('id', logRow.id)
    const message = e instanceof Error ? e.message : String(e)
    console.error('[meals/log] saved_meals update step failed:', message)
    if (delErr) {
      console.error('[meals/log] compensation DELETE also failed:', delErr.message)
      return bad(500, `saved_meals update failed AND food_log compensation failed: ${message} / ${delErr.message}`)
    }
    return bad(500, `saved_meals update failed (food_log_entries rolled back): ${message}`)
  }

  return Response.json({
    food_log_entry_id: logRow.id,
    saved_meal_id: savedMealId,
    saved_meal_action: savedMealAction,
  })
}
