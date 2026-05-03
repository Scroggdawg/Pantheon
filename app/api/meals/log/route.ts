// S26 Step 3 — POST /api/meals/log
//
// Inserts a food_log_entries row and conditionally auto-promotes the
// meal into saved_meals (per V15 H0 Q1 — option c, conditional auto-promote):
//   - library_source_ref starts with "lib:saved_meal:" → increment
//     times_logged + bump last_logged_at on that saved_meals row
//   - library_source_ref null OR starts with "lib:product:" → INSERT
//     a new saved_meals row using foods[0].name, yield_servings=1
//
// "Transactional" guarantee per V15 brief: if the saved_meals step fails,
// roll back the food_log_entries insert. Supabase JS doesn't expose a
// real BEGIN/COMMIT, so we DELETE the inserted row on failure (best-effort
// compensation; surfaced in the response if compensation itself fails).

import { createClient } from '@/lib/supabase/server'
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

type SavedMealAction = 'incremented' | 'created' | 'none'

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

  if (!body.user_id || typeof body.user_id !== 'string') return bad(400, 'user_id required')
  if (!Array.isArray(body.foods) || body.foods.length === 0) return bad(400, 'foods[] required')
  if (!body.day_type) return bad(400, 'day_type required')
  if (!body.log_method) return bad(400, 'log_method required')
  if (!body.meal_label) return bad(400, 'meal_label required')

  const supabase = await createClient()

  // ---- 1. Insert the food_log_entries row ----
  const { data: logRow, error: logErr } = await supabase
    .from('food_log_entries')
    .insert({
      user_id: body.user_id,
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
    })
    .select('id')
    .single()

  if (logErr || !logRow) {
    console.error('[meals/log] food_log_entries insert failed:', logErr?.message)
    return bad(500, `food_log_entries insert failed: ${logErr?.message ?? 'unknown'}`)
  }

  // ---- 2. Conditional auto-promote ----
  let savedMealId: string | null = null
  let savedMealAction: SavedMealAction = 'none'
  const isSavedMealRef = body.library_source_ref?.startsWith('lib:saved_meal:') ?? false
  const isProductRef = body.library_source_ref?.startsWith('lib:product:') ?? false
  const noLibraryRef = body.library_source_ref == null || body.library_source_ref === ''

  try {
    if (isSavedMealRef) {
      const uuid = body.library_source_ref!.slice('lib:saved_meal:'.length)
      const { data: existing, error: getErr } = await supabase
        .from('saved_meals')
        .select('times_logged')
        .eq('id', uuid)
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
      if (updErr) throw new Error(`saved_meals update failed: ${updErr.message}`)
      savedMealId = uuid
      savedMealAction = 'incremented'
    } else if (noLibraryRef || isProductRef) {
      const { data: ins, error: insErr } = await supabase
        .from('saved_meals')
        .insert({
          user_id: body.user_id,
          name: body.foods[0]?.name ?? 'Untitled meal',
          foods_json: body.foods,
          total_calories: body.total_calories,
          total_protein_g: body.total_protein_g,
          total_carbs_g: body.total_carbs_g,
          total_fat_g: body.total_fat_g,
          times_logged: 1,
          last_logged_at: new Date().toISOString(),
          yield_servings: 1,
          is_staple: false,
          tags: [],
        })
        .select('id')
        .single()
      if (insErr || !ins) {
        throw new Error(`saved_meals insert failed: ${insErr?.message ?? 'unknown'}`)
      }
      savedMealId = ins.id
      savedMealAction = 'created'
    }
  } catch (e) {
    // Compensation: roll back the food_log_entries insert.
    const { error: delErr } = await supabase
      .from('food_log_entries')
      .delete()
      .eq('id', logRow.id)
    const message = e instanceof Error ? e.message : String(e)
    console.error('[meals/log] saved_meals step failed:', message)
    if (delErr) {
      console.error('[meals/log] compensation DELETE also failed:', delErr.message)
      return bad(500, `saved_meals step failed AND food_log compensation failed: ${message} / ${delErr.message}`)
    }
    return bad(500, `saved_meals step failed (food_log_entries rolled back): ${message}`)
  }

  return Response.json({
    food_log_entry_id: logRow.id,
    saved_meal_id: savedMealId,
    saved_meal_action: savedMealAction,
  })
}
