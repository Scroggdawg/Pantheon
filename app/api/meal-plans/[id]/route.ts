import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    if (!id) {
      return Response.json({ error: 'id is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: plan, error: planErr } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (planErr) {
      console.error('[api/meal-plans/:id] plan select error:', planErr.message)
      return Response.json({ error: planErr.message }, { status: 500 })
    }
    if (!plan) {
      return Response.json({ error: 'not found' }, { status: 404 })
    }

    const { data: entries, error: eErr } = await supabase
      .from('meal_plan_entries')
      .select('*')
      .eq('plan_id', id)
      .order('meal_date', { ascending: true })
      .order('slot', { ascending: true })
    if (eErr) {
      console.error('[api/meal-plans/:id] entries select error:', eErr.message)
      return Response.json({ error: eErr.message }, { status: 500 })
    }

    return Response.json({ plan, entries: entries ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[api/meal-plans/:id] FULL ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
