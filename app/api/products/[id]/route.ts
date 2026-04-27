import { createClient } from '@/lib/supabase/server'
import type { ProductFulfillmentSource } from '@/types/database'

const ALLOWED_SOURCES: ProductFulfillmentSource[] = [
  'amazon_fresh', 'amazon_prime', 'whole_foods', 'manual',
]

const UPDATABLE_KEYS = [
  'name', 'brand', 'unit',
  'serving_size_g',
  'calories_per_serving', 'protein_g_per_serving',
  'fat_g_per_serving', 'carbs_g_per_serving', 'fiber_g_per_serving',
  'fulfillment_source', 'barcode', 'product_url', 'notes',
  'tracks_inventory', 'servings_per_unit',
] as const

type UpdatableKey = (typeof UPDATABLE_KEYS)[number]

const NUMERIC_REQUIRED: UpdatableKey[] = [
  'calories_per_serving', 'protein_g_per_serving',
  'fat_g_per_serving', 'carbs_g_per_serving',
]
const NUMERIC_NULLABLE: UpdatableKey[] = [
  'serving_size_g', 'fiber_g_per_serving',
]
const STRING_REQUIRED: UpdatableKey[] = ['name', 'unit']
const STRING_NULLABLE: UpdatableKey[] = ['brand', 'barcode', 'product_url', 'notes']

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return Response.json({ error: 'not found' }, { status: 404 })
    }
    return Response.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>

    const updates: Record<string, unknown> = {}
    for (const key of UPDATABLE_KEYS) {
      if (!(key in body)) continue
      const v = body[key]

      if ((NUMERIC_REQUIRED as string[]).includes(key)) {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          return Response.json({ error: `${key} must be a number` }, { status: 400 })
        }
        updates[key] = v
      } else if ((NUMERIC_NULLABLE as string[]).includes(key)) {
        if (v !== null && (typeof v !== 'number' || !Number.isFinite(v))) {
          return Response.json({ error: `${key} must be a number or null` }, { status: 400 })
        }
        updates[key] = v
      } else if ((STRING_REQUIRED as string[]).includes(key)) {
        if (typeof v !== 'string' || !v.trim()) {
          return Response.json({ error: `${key} must be a non-empty string` }, { status: 400 })
        }
        updates[key] = v.trim()
      } else if ((STRING_NULLABLE as string[]).includes(key)) {
        if (v !== null && typeof v !== 'string') {
          return Response.json({ error: `${key} must be a string or null` }, { status: 400 })
        }
        updates[key] = v
      } else if (key === 'fulfillment_source') {
        if (typeof v !== 'string' || !(ALLOWED_SOURCES as string[]).includes(v)) {
          return Response.json(
            { error: `fulfillment_source must be one of ${ALLOWED_SOURCES.join('|')}` },
            { status: 400 },
          )
        }
        updates[key] = v
      } else if (key === 'tracks_inventory') {
        if (typeof v !== 'boolean') {
          return Response.json({ error: `tracks_inventory must be a boolean` }, { status: 400 })
        }
        updates[key] = v
      } else if (key === 'servings_per_unit') {
        if (v !== null && (typeof v !== 'number' || !Number.isInteger(v))) {
          return Response.json({ error: `servings_per_unit must be an integer or null` }, { status: 400 })
        }
        updates[key] = v
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'no updatable fields supplied' }, { status: 400 })
    }
    updates.updated_at = new Date().toISOString()

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return new Response(null, { status: 204 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}
