import { createClient } from '@/lib/supabase/server'
import { rerollSlot } from '@/lib/claude/meal-plan'
import type {
  MealPlan,
  MealPlanEntry,
  Product,
  Recipe,
  UserPreferences,
} from '@/types/database'

interface IncomingBody {
  entry_id?: unknown
  reason?: unknown
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: planId } = await context.params
    if (!planId) {
      return Response.json({ error: 'plan id is required' }, { status: 400 })
    }

    const body = (await request.json()) as IncomingBody
    if (typeof body.entry_id !== 'string' || !body.entry_id) {
      return Response.json({ error: 'entry_id is required' }, { status: 400 })
    }
    if (
      body.reason !== undefined &&
      body.reason !== null &&
      typeof body.reason !== 'string'
    ) {
      return Response.json({ error: 'reason must be a string when provided' }, { status: 400 })
    }

    const supabase = await createClient()

    // Load target entry; verify it belongs to this plan and is not locked.
    const { data: entryRow, error: entryErr } = await supabase
      .from('meal_plan_entries')
      .select('*')
      .eq('id', body.entry_id)
      .maybeSingle()
    if (entryErr) {
      return Response.json({ error: `entry select: ${entryErr.message}` }, { status: 500 })
    }
    if (!entryRow) {
      return Response.json({ error: 'entry not found' }, { status: 404 })
    }
    const entry = entryRow as MealPlanEntry
    if (entry.plan_id !== planId) {
      return Response.json({ error: 'entry does not belong to this plan' }, { status: 400 })
    }
    if (entry.locked) {
      return Response.json({ error: 'entry is locked' }, { status: 409 })
    }

    // Load plan for daily_target_macros context.
    const { data: planRow, error: planErr } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('id', planId)
      .maybeSingle()
    if (planErr) {
      return Response.json({ error: `plan select: ${planErr.message}` }, { status: 500 })
    }
    if (!planRow) {
      return Response.json({ error: 'plan not found' }, { status: 404 })
    }
    const plan = planRow as MealPlan

    // Load preferences (assume exists; the generate flow auto-creates).
    const { data: prefsRow, error: prefsErr } = await supabase
      .from('user_preferences')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (prefsErr) {
      return Response.json({ error: `prefs select: ${prefsErr.message}` }, { status: 500 })
    }
    if (!prefsRow) {
      return Response.json(
        { error: 'no user_preferences row exists; call /api/user-preferences first' },
        { status: 409 },
      )
    }
    const prefs = prefsRow as UserPreferences

    // Resolve current entry's source name for the prompt.
    let currentSourceName = '(unknown)'
    if (entry.source_type === 'recipe') {
      const { data } = await supabase.from('recipes').select('name').eq('id', entry.source_id).maybeSingle()
      currentSourceName = data?.name ?? '(unknown recipe)'
    } else {
      const { data } = await supabase.from('products').select('name').eq('id', entry.source_id).maybeSingle()
      currentSourceName = data?.name ?? '(unknown product)'
    }

    // Build same_day_entries snapshot.
    const { data: sameDayRows, error: sdErr } = await supabase
      .from('meal_plan_entries')
      .select('*')
      .eq('plan_id', planId)
      .eq('meal_date', entry.meal_date)
      .neq('id', entry.id)
    if (sdErr) {
      return Response.json({ error: `same-day select: ${sdErr.message}` }, { status: 500 })
    }

    const sameDayEntries = await Promise.all(
      (sameDayRows ?? []).map(async (row) => {
        const e = row as MealPlanEntry
        let name = '(unknown)'
        let macros: { calories: number | null; protein_g: number | null; fat_g: number | null; carbs_g: number | null } = {
          calories: null, protein_g: null, fat_g: null, carbs_g: null,
        }
        if (e.source_type === 'recipe') {
          const { data } = await supabase
            .from('recipes')
            .select('name, calories, protein_g, fat_g, carbs_g')
            .eq('id', e.source_id)
            .maybeSingle()
          if (data) {
            name = data.name
            macros = {
              calories: data.calories,
              protein_g: data.protein_g,
              fat_g: data.fat_g,
              carbs_g: data.carbs_g,
            }
          }
        } else {
          const { data } = await supabase
            .from('products')
            .select('name, calories_per_serving, protein_g_per_serving, fat_g_per_serving, carbs_g_per_serving')
            .eq('id', e.source_id)
            .maybeSingle()
          if (data) {
            name = data.name
            macros = {
              calories: data.calories_per_serving,
              protein_g: data.protein_g_per_serving,
              fat_g: data.fat_g_per_serving,
              carbs_g: data.carbs_g_per_serving,
            }
          }
        }
        return {
          slot: e.slot,
          source_type: e.source_type,
          source_name: name,
          calories: macros.calories,
          protein_g: macros.protein_g,
          fat_g: macros.fat_g,
          carbs_g: macros.carbs_g,
          servings: e.servings,
        }
      }),
    )

    // Build other_batch_dinners snapshot (same plan, slot='dinner',
    // different meal_date than the entry being rerolled).
    const { data: otherDinnerRows, error: odErr } = await supabase
      .from('meal_plan_entries')
      .select('*')
      .eq('plan_id', planId)
      .eq('slot', 'dinner')
      .neq('meal_date', entry.meal_date)
    if (odErr) {
      return Response.json({ error: `other dinners select: ${odErr.message}` }, { status: 500 })
    }
    const otherBatchDinners = await Promise.all(
      (otherDinnerRows ?? []).map(async (row) => {
        const e = row as MealPlanEntry
        let name = '(unknown)'
        let cuisine: string | null = null
        if (e.source_type === 'recipe') {
          const { data } = await supabase
            .from('recipes')
            .select('name, cuisine')
            .eq('id', e.source_id)
            .maybeSingle()
          if (data) {
            name = data.name
            cuisine = data.cuisine
          }
        } else {
          const { data } = await supabase
            .from('products')
            .select('name')
            .eq('id', e.source_id)
            .maybeSingle()
          if (data) name = data.name
        }
        return { date: e.meal_date, source_name: name, cuisine }
      }),
    )

    // Load catalogs.
    const { data: recipes, error: rErr } = await supabase
      .from('recipes')
      .select('*')
      .order('name', { ascending: true })
    if (rErr) return Response.json({ error: `recipes: ${rErr.message}` }, { status: 500 })

    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true })
    if (pErr) return Response.json({ error: `products: ${pErr.message}` }, { status: 500 })

    let suggestion
    try {
      suggestion = await rerollSlot({
        current_entry: {
          meal_date: entry.meal_date,
          slot: entry.slot,
          source_type: entry.source_type,
          source_id: entry.source_id,
          source_name: currentSourceName,
        },
        same_day_entries: sameDayEntries,
        other_batch_dinners: otherBatchDinners,
        daily_target_macros: plan.daily_target_macros,
        preferences: prefs,
        recipes: (recipes ?? []) as Recipe[],
        products: (products ?? []) as Product[],
        reason: (body.reason as string | null | undefined) ?? null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[reroll-slot] Claude error:', message)
      return Response.json({ error: message }, { status: 502 })
    }

    const { data: updated, error: updErr } = await supabase
      .from('meal_plan_entries')
      .update({
        source_type: suggestion.source_type,
        source_id: suggestion.source_id,
        servings: suggestion.servings,
        notes: suggestion.notes,
      })
      .eq('id', entry.id)
      .select('*')
      .single()
    if (updErr) {
      return Response.json({ error: `entry update: ${updErr.message}` }, { status: 500 })
    }

    return Response.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[reroll-slot] FULL ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
