import { createClient } from '@/lib/supabase/server'
import type { RecipeIngredient } from '@/types/database'

interface IncomingBody {
  name?: unknown
  servings?: unknown
  cuisine?: unknown
  protein_type?: unknown
  calories?: unknown
  protein_g?: unknown
  carbs_g?: unknown
  fat_g?: unknown
  ingredients?: unknown
  notes?: unknown
}

function isOptionalString(v: unknown): v is string | null | undefined {
  return v === null || v === undefined || typeof v === 'string'
}

function isOptionalNumber(v: unknown): v is number | null | undefined {
  return v === null || v === undefined || (typeof v === 'number' && Number.isFinite(v))
}

function validateIngredients(v: unknown): { ok: true; value: RecipeIngredient[] } | { ok: false; error: string } {
  if (!Array.isArray(v)) return { ok: false, error: 'ingredients must be an array' }
  const out: RecipeIngredient[] = []
  for (let i = 0; i < v.length; i++) {
    const row = v[i] as Record<string, unknown> | null
    if (!row || typeof row !== 'object') {
      return { ok: false, error: `ingredients[${i}] must be an object` }
    }
    if (typeof row.name !== 'string') {
      return { ok: false, error: `ingredients[${i}].name must be a string` }
    }
    if (typeof row.qty !== 'number' || !Number.isFinite(row.qty)) {
      return { ok: false, error: `ingredients[${i}].qty must be a number` }
    }
    if (typeof row.unit !== 'string') {
      return { ok: false, error: `ingredients[${i}].unit must be a string` }
    }
    if (row.notes !== undefined && row.notes !== null && typeof row.notes !== 'string') {
      return { ok: false, error: `ingredients[${i}].notes must be a string when provided` }
    }
    out.push({
      name: row.name,
      qty: row.qty,
      unit: row.unit,
      notes: (row.notes as string | null | undefined) ?? null,
    })
  }
  return { ok: true, value: out }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IncomingBody

    // Required: name, servings, ingredients
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return Response.json({ error: 'name is required' }, { status: 400 })
    }
    if (typeof body.servings !== 'number' || !Number.isFinite(body.servings) || body.servings < 1) {
      return Response.json({ error: 'servings must be a number >= 1' }, { status: 400 })
    }
    const ingredientsResult = validateIngredients(body.ingredients)
    if (!ingredientsResult.ok) {
      return Response.json({ error: ingredientsResult.error }, { status: 400 })
    }

    // Optional fields
    if (!isOptionalString(body.cuisine)) {
      return Response.json({ error: 'cuisine must be a string or null' }, { status: 400 })
    }
    if (!isOptionalString(body.protein_type)) {
      return Response.json({ error: 'protein_type must be a string or null' }, { status: 400 })
    }
    if (!isOptionalNumber(body.calories)) {
      return Response.json({ error: 'calories must be a number or null' }, { status: 400 })
    }
    if (!isOptionalNumber(body.protein_g)) {
      return Response.json({ error: 'protein_g must be a number or null' }, { status: 400 })
    }
    if (!isOptionalNumber(body.carbs_g)) {
      return Response.json({ error: 'carbs_g must be a number or null' }, { status: 400 })
    }
    if (!isOptionalNumber(body.fat_g)) {
      return Response.json({ error: 'fat_g must be a number or null' }, { status: 400 })
    }
    if (!isOptionalString(body.notes)) {
      return Response.json({ error: 'notes must be a string or null' }, { status: 400 })
    }

    const supabase = await createClient()

    const insertRow = {
      name: body.name.trim(),
      servings: body.servings,
      cuisine: (body.cuisine as string | null | undefined) ?? null,
      protein_type: (body.protein_type as string | null | undefined) ?? null,
      calories: (body.calories as number | null | undefined) ?? null,
      protein_g: (body.protein_g as number | null | undefined) ?? null,
      carbs_g: (body.carbs_g as number | null | undefined) ?? null,
      fat_g: (body.fat_g as number | null | undefined) ?? null,
      ingredients: ingredientsResult.value,
      notes: (body.notes as string | null | undefined) ?? null,
      // Hardcoded server-side per C1 — this endpoint serves the
      // AI-parse flow only. Manual / imported flows are separate.
      source: 'ai_generated' as const,
    }

    const { data, error } = await supabase
      .from('recipes')
      .insert(insertRow)
      .select()
      .single()

    if (error) {
      console.error('[api/recipes] insert error:', error.message)
      return Response.json({ error: error.message }, { status: 500 })
    }

    console.log('[api/recipes] inserted:', data.id, data.name)
    return Response.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[api/recipes] FULL ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
