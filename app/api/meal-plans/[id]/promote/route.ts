import { createClient } from '@/lib/supabase/server'
import type { MealPlan } from '@/types/database'

interface IncomingBody {
  cook_date?: unknown
  order_date?: unknown
  batch_position?: unknown
}

function isYmd(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
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

    let body: IncomingBody = {}
    try {
      body = (await request.json()) as IncomingBody
    } catch {
      // empty body is allowed for promote
    }

    if (body.cook_date !== undefined && body.cook_date !== null && !isYmd(body.cook_date)) {
      return Response.json({ error: 'cook_date must be YYYY-MM-DD' }, { status: 400 })
    }
    if (body.order_date !== undefined && body.order_date !== null && !isYmd(body.order_date)) {
      return Response.json({ error: 'order_date must be YYYY-MM-DD' }, { status: 400 })
    }
    if (
      body.batch_position !== undefined &&
      body.batch_position !== null &&
      (typeof body.batch_position !== 'number' || !Number.isFinite(body.batch_position))
    ) {
      return Response.json({ error: 'batch_position must be a number' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: planRow, error: planErr } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('id', planId)
      .maybeSingle()
    if (planErr) {
      return Response.json({ error: `plan select: ${planErr.message}` }, { status: 500 })
    }
    if (!planRow) {
      return Response.json({ error: 'not found' }, { status: 404 })
    }
    const plan = planRow as MealPlan

    // Phase 2.1.a.1 only implements on_deck -> up. The in_hole -> on_deck
    // transition will land in 2.1.a.2 alongside the planner UI.
    if (plan.status !== 'on_deck') {
      return Response.json(
        { error: `cannot promote plan in status '${plan.status}'; only 'on_deck' is promotable in this phase` },
        { status: 409 },
      )
    }

    // Cascade: archive any existing 'up' plan, then mark this one 'up'.
    // Two writes — supabase-js does not support multi-statement
    // transactions over PostgREST. The partial unique index on
    // status='up' protects against double-up, so order matters:
    // archive first, then promote.
    const { error: archiveErr } = await supabase
      .from('meal_plans')
      .update({ status: 'archived' })
      .eq('status', 'up')
    if (archiveErr) {
      return Response.json({ error: `archive existing up: ${archiveErr.message}` }, { status: 500 })
    }

    const updates: Record<string, unknown> = { status: 'up' }
    if (isYmd(body.cook_date)) updates.cook_date = body.cook_date
    if (isYmd(body.order_date)) updates.order_date = body.order_date
    if (typeof body.batch_position === 'number') updates.batch_position = body.batch_position

    const { data: promoted, error: promErr } = await supabase
      .from('meal_plans')
      .update(updates)
      .eq('id', planId)
      .select('*')
      .single()
    if (promErr) {
      return Response.json({ error: `promote: ${promErr.message}` }, { status: 500 })
    }

    return Response.json(promoted)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[promote] FULL ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
