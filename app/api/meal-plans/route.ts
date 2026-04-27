import { createClient } from '@/lib/supabase/server'
import type { MealPlanStatus } from '@/types/database'

const VALID_STATUSES: MealPlanStatus[] = ['in_hole', 'on_deck', 'up', 'archived']

function isYmd(v: string | null): boolean {
  return v !== null && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const statusParam = url.searchParams.get('status')
    const fromParam = url.searchParams.get('from')
    const toParam = url.searchParams.get('to')

    let statuses: MealPlanStatus[] | null = null
    if (statusParam) {
      const requested = statusParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      for (const s of requested) {
        if (!(VALID_STATUSES as string[]).includes(s)) {
          return Response.json(
            { error: `invalid status '${s}'; must be one of ${VALID_STATUSES.join(',')}` },
            { status: 400 },
          )
        }
      }
      statuses = requested as MealPlanStatus[]
    }

    if (fromParam && !isYmd(fromParam)) {
      return Response.json({ error: 'from must be YYYY-MM-DD' }, { status: 400 })
    }
    if (toParam && !isYmd(toParam)) {
      return Response.json({ error: 'to must be YYYY-MM-DD' }, { status: 400 })
    }

    const supabase = await createClient()
    let query = supabase
      .from('meal_plans')
      .select('*')
      .order('plan_date_start', { ascending: false })

    if (statuses) query = query.in('status', statuses)
    if (fromParam) query = query.gte('plan_date_start', fromParam)
    if (toParam) query = query.lte('plan_date_end', toParam)

    const { data, error } = await query
    if (error) {
      console.error('[api/meal-plans] select error:', error.message)
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json(data ?? [])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[api/meal-plans] GET FULL ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
