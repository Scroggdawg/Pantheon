// Op FASTRAK Alpha.6 Sub-fix C — heart-icon save/un-save handler.
//
// Replaces the meals/log auto-promote create path (deleted in Sub-fix B).
// User explicitly hearts a food_log_entries row to mark its referenced
// saved_meal as a favorite. Two flows:
//
//   POST   — user hearts a row.
//            If food_log_entries.saved_meal_id is populated, flip the
//            referenced saved_meal's is_favorite=true (idempotent).
//            If null, INSERT a new saved_meal from the row's foods_json +
//            totals with is_favorite=true, then backfill saved_meal_id
//            on the food_log_entries row.
//
//   DELETE — user un-hearts a row.
//            Flip the referenced saved_meal's is_favorite=false. 404 if
//            no saved_meal_id is linked (nothing to un-heart).
//
// Both flows bust the user's parse-meal response cache on success
// (Alpha.5 pattern relocated from meals/log/route.ts — library state
// changed, next parse-meal call should reflect the new favorites tier).

import { bustResponseCacheForUser } from '@/lib/claude/parse-meal-response-cache'
import { createClient } from '@/lib/supabase/server'
import type { FoodItem } from '@/types/database'

interface HeartBody {
  user_id: string
  food_log_entry_id: string
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
  if (!body.user_id || typeof body.user_id !== 'string') return bad(400, 'user_id required')
  if (!body.food_log_entry_id || typeof body.food_log_entry_id !== 'string') {
    return bad(400, 'food_log_entry_id required')
  }
  return body
}

export async function POST(request: Request) {
  const parsed = await parseAndValidate(request)
  if (parsed instanceof Response) return parsed
  const { user_id, food_log_entry_id } = parsed

  const supabase = await createClient()

  const { data: logRow, error: logErr } = await supabase
    .from('food_log_entries')
    .select(
      'id, user_id, foods_json, total_calories, total_protein_g, total_carbs_g, total_fat_g, saved_meal_id',
    )
    .eq('id', food_log_entry_id)
    .maybeSingle()

  if (logErr) return bad(500, `food_log_entries lookup failed: ${logErr.message}`)
  if (!logRow) return bad(404, 'food_log_entry not found')
  if (logRow.user_id !== user_id) return bad(403, 'user_id mismatch')

  let savedMealId: string

  if (logRow.saved_meal_id) {
    // Existing saved_meal — idempotent flip to is_favorite=true
    const { error: updErr } = await supabase
      .from('saved_meals')
      .update({ is_favorite: true })
      .eq('id', logRow.saved_meal_id)
    if (updErr) return bad(500, `saved_meals update failed: ${updErr.message}`)
    savedMealId = logRow.saved_meal_id
  } else {
    // Novel — INSERT new saved_meal from the row's foods_json + totals
    const foods = (logRow.foods_json ?? []) as FoodItem[]
    const name = foods[0]?.name ?? 'Untitled meal'
    const { data: ins, error: insErr } = await supabase
      .from('saved_meals')
      .insert({
        user_id,
        name,
        foods_json: foods,
        total_calories: logRow.total_calories,
        total_protein_g: logRow.total_protein_g,
        total_carbs_g: logRow.total_carbs_g,
        total_fat_g: logRow.total_fat_g,
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

    // Backfill saved_meal_id audit on the food_log_entries row. Best-
    // effort — a missed backfill leaves a stale NULL audit-trail value
    // but doesn't break the user's hearted state (the saved_meal exists
    // and is_favorite=true; the lost link only affects future re-logs
    // hitting the meals/log increment path).
    const { error: backfillErr } = await supabase
      .from('food_log_entries')
      .update({ saved_meal_id: savedMealId })
      .eq('id', food_log_entry_id)
    if (backfillErr) {
      console.warn(
        '[saved_meals/heart] saved_meal_id backfill failed:',
        backfillErr.message,
      )
    }
  }

  await bustResponseCacheForUser(supabase, user_id)

  return Response.json({
    saved_meal_id: savedMealId,
    is_favorite: true,
  })
}

export async function DELETE(request: Request) {
  const parsed = await parseAndValidate(request)
  if (parsed instanceof Response) return parsed
  const { user_id, food_log_entry_id } = parsed

  const supabase = await createClient()

  const { data: logRow, error: logErr } = await supabase
    .from('food_log_entries')
    .select('id, user_id, saved_meal_id')
    .eq('id', food_log_entry_id)
    .maybeSingle()

  if (logErr) return bad(500, `food_log_entries lookup failed: ${logErr.message}`)
  if (!logRow) return bad(404, 'food_log_entry not found')
  if (logRow.user_id !== user_id) return bad(403, 'user_id mismatch')
  if (!logRow.saved_meal_id) {
    return bad(404, 'no saved_meal linked to this food_log_entry')
  }

  const { error: updErr } = await supabase
    .from('saved_meals')
    .update({ is_favorite: false })
    .eq('id', logRow.saved_meal_id)
  if (updErr) return bad(500, `saved_meals update failed: ${updErr.message}`)

  await bustResponseCacheForUser(supabase, user_id)

  return Response.json({
    saved_meal_id: logRow.saved_meal_id,
    is_favorite: false,
  })
}
