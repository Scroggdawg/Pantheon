import { createClient } from '@/lib/supabase/server'
import type { UserPreferences } from '@/types/database'

const DEFAULT_PREFS = {
  daily_target_macros: { protein_g: 200, fat_g: 100, carbs_g: 300, calories: 2400 },
  cuisine_likes: [] as string[],
  cuisine_dislikes: [] as string[],
  protein_likes: [] as string[],
  protein_dislikes: [] as string[],
  excluded_ingredients: [] as string[],
  default_servings: 1,
  default_batch_days: 4,
  notes: null as string | null,
}

const STRING_ARRAY_KEYS = [
  'cuisine_likes', 'cuisine_dislikes',
  'protein_likes', 'protein_dislikes',
  'excluded_ingredients',
] as const

const NUMERIC_KEYS = ['default_servings', 'default_batch_days'] as const

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: existing, error: selErr } = await supabase
      .from('user_preferences')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (selErr) {
      return Response.json({ error: selErr.message }, { status: 500 })
    }
    if (existing) {
      return Response.json(existing as UserPreferences)
    }

    const { data: created, error: createErr } = await supabase
      .from('user_preferences')
      .insert(DEFAULT_PREFS)
      .select('*')
      .single()
    if (createErr) {
      return Response.json({ error: createErr.message }, { status: 500 })
    }
    return Response.json(created as UserPreferences)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[user-preferences] GET FULL ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>

    const updates: Record<string, unknown> = {}

    if ('daily_target_macros' in body) {
      const v = body.daily_target_macros
      if (v !== null && (typeof v !== 'object' || Array.isArray(v))) {
        return Response.json({ error: 'daily_target_macros must be an object or null' }, { status: 400 })
      }
      updates.daily_target_macros = v
    }

    for (const k of STRING_ARRAY_KEYS) {
      if (!(k in body)) continue
      if (!isStringArray(body[k])) {
        return Response.json({ error: `${k} must be an array of strings` }, { status: 400 })
      }
      updates[k] = body[k]
    }

    for (const k of NUMERIC_KEYS) {
      if (!(k in body)) continue
      const v = body[k]
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        return Response.json({ error: `${k} must be a number` }, { status: 400 })
      }
      updates[k] = v
    }

    if ('notes' in body) {
      const v = body.notes
      if (v !== null && typeof v !== 'string') {
        return Response.json({ error: 'notes must be a string or null' }, { status: 400 })
      }
      updates.notes = v
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'no updatable fields supplied' }, { status: 400 })
    }
    updates.updated_at = new Date().toISOString()

    const supabase = await createClient()

    // Find or create the singleton row.
    const { data: existing, error: selErr } = await supabase
      .from('user_preferences')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (selErr) {
      return Response.json({ error: selErr.message }, { status: 500 })
    }

    let rowId: string
    if (existing) {
      rowId = existing.id
    } else {
      const seed = { ...DEFAULT_PREFS, ...updates }
      const { data: created, error: cErr } = await supabase
        .from('user_preferences')
        .insert(seed)
        .select('*')
        .single()
      if (cErr) {
        return Response.json({ error: cErr.message }, { status: 500 })
      }
      return Response.json(created as UserPreferences)
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .update(updates)
      .eq('id', rowId)
      .select('*')
      .single()
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json(data as UserPreferences)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[user-preferences] PUT FULL ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
