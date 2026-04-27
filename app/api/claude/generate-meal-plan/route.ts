import { createClient } from '@/lib/supabase/server'
import { generateMealPlan } from '@/lib/claude/meal-plan'
import type { Product, Recipe, UserPreferences } from '@/types/database'

interface IncomingBody {
  plan_date_start?: unknown
  plan_date_end?: unknown
  batch_position?: unknown
  daily_target_macros?: unknown
  notes?: unknown
}

function isYmd(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IncomingBody

    if (!isYmd(body.plan_date_start)) {
      return Response.json({ error: 'plan_date_start must be YYYY-MM-DD' }, { status: 400 })
    }
    if (!isYmd(body.plan_date_end)) {
      return Response.json({ error: 'plan_date_end must be YYYY-MM-DD' }, { status: 400 })
    }
    if (body.plan_date_end < body.plan_date_start) {
      return Response.json({ error: 'plan_date_end must be >= plan_date_start' }, { status: 400 })
    }
    if (
      body.batch_position !== undefined &&
      body.batch_position !== null &&
      (typeof body.batch_position !== 'number' || !Number.isFinite(body.batch_position))
    ) {
      return Response.json({ error: 'batch_position must be a number when provided' }, { status: 400 })
    }
    if (
      body.notes !== undefined &&
      body.notes !== null &&
      typeof body.notes !== 'string'
    ) {
      return Response.json({ error: 'notes must be a string when provided' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Load (auto-create if missing) user_preferences singleton.
    let prefs: UserPreferences | null = null
    {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (error) {
        return Response.json({ error: `prefs select: ${error.message}` }, { status: 500 })
      }
      if (data) {
        prefs = data as UserPreferences
      } else {
        const seed = {
          daily_target_macros: { protein_g: 200, fat_g: 100, carbs_g: 300, calories: 2400 },
          cuisine_likes: [],
          cuisine_dislikes: [],
          protein_likes: [],
          protein_dislikes: [],
          excluded_ingredients: [],
          default_servings: 1,
          default_batch_days: 4,
          notes: null,
        }
        const { data: created, error: createErr } = await supabase
          .from('user_preferences')
          .insert(seed)
          .select('*')
          .single()
        if (createErr) {
          return Response.json({ error: `prefs autocreate: ${createErr.message}` }, { status: 500 })
        }
        prefs = created as UserPreferences
      }
    }

    // 2. Load recipes catalog.
    const { data: recipes, error: rErr } = await supabase
      .from('recipes')
      .select('*')
      .order('name', { ascending: true })
    if (rErr) return Response.json({ error: `recipes: ${rErr.message}` }, { status: 500 })

    // 3. Load products catalog.
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true })
    if (pErr) return Response.json({ error: `products: ${pErr.message}` }, { status: 500 })

    // 4. Recent dinner names — names from current up + on_deck plans'
    //    dinner entries, source_type='recipe' only.
    let recentDinnerNames: string[] = []
    {
      const { data: activePlans, error: apErr } = await supabase
        .from('meal_plans')
        .select('id')
        .in('status', ['up', 'on_deck'])
      if (apErr) {
        return Response.json({ error: `recent plans: ${apErr.message}` }, { status: 500 })
      }
      const planIds = (activePlans ?? []).map((p: { id: string }) => p.id)
      if (planIds.length > 0) {
        const { data: entries, error: eErr } = await supabase
          .from('meal_plan_entries')
          .select('source_id')
          .in('plan_id', planIds)
          .eq('slot', 'dinner')
          .eq('source_type', 'recipe')
        if (eErr) {
          return Response.json({ error: `recent entries: ${eErr.message}` }, { status: 500 })
        }
        const dinnerRecipeIds = Array.from(
          new Set((entries ?? []).map((e: { source_id: string }) => e.source_id)),
        )
        if (dinnerRecipeIds.length > 0) {
          const { data: recs, error: rnErr } = await supabase
            .from('recipes')
            .select('name')
            .in('id', dinnerRecipeIds)
          if (rnErr) {
            return Response.json({ error: `recent names: ${rnErr.message}` }, { status: 500 })
          }
          recentDinnerNames = (recs ?? []).map((r: { name: string }) => r.name)
        }
      }
    }

    const macros = (body.daily_target_macros as
      | { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number }
      | null
      | undefined) ?? prefs.daily_target_macros

    // 5. Call Claude.
    let generated
    try {
      generated = await generateMealPlan({
        plan_date_start: body.plan_date_start,
        plan_date_end: body.plan_date_end,
        daily_target_macros: macros,
        preferences: prefs,
        recipes: (recipes ?? []) as Recipe[],
        products: (products ?? []) as Product[],
        recent_dinner_names: recentDinnerNames,
        // No existing entries on a fresh plan; locked-slot plumbing
        // is wired through for 2.1.a.2+ regeneration flows.
        locked_entries: [],
        notes: (body.notes as string | null | undefined) ?? null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[generate-meal-plan] Claude error:', message)
      return Response.json({ error: message }, { status: 502 })
    }

    // 6. Insert plan as in_hole.
    const planRow = {
      plan_date_start: body.plan_date_start,
      plan_date_end: body.plan_date_end,
      daily_target_macros: macros,
      status: 'in_hole' as const,
      batch_position:
        typeof body.batch_position === 'number' ? body.batch_position : null,
    }
    const { data: plan, error: planErr } = await supabase
      .from('meal_plans')
      .insert(planRow)
      .select('*')
      .single()
    if (planErr) {
      return Response.json({ error: `plan insert: ${planErr.message}` }, { status: 500 })
    }

    // 7. Insert entries.
    const entryRows = generated.entries.map((e) => ({
      plan_id: plan.id,
      source_type: e.source_type,
      source_id: e.source_id,
      meal_date: e.meal_date,
      slot: e.slot,
      servings: e.servings,
      locked: false,
      status: 'planned' as const,
      notes: e.notes,
    }))
    const { data: entries, error: entriesErr } = await supabase
      .from('meal_plan_entries')
      .insert(entryRows)
      .select('*')
    if (entriesErr) {
      // Roll back the plan insert to avoid orphaned plans.
      await supabase.from('meal_plans').delete().eq('id', plan.id)
      return Response.json({ error: `entries insert: ${entriesErr.message}` }, { status: 500 })
    }

    return Response.json({ plan, entries: entries ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[generate-meal-plan] FULL ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
