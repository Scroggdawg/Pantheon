import { createClient } from '@/lib/supabase/server'
import type { ProductFulfillmentSource } from '@/types/database'

const ALLOWED_SOURCES: ProductFulfillmentSource[] = [
  'amazon_fresh', 'amazon_prime', 'whole_foods', 'manual',
]

interface IncomingBody {
  name?: unknown
  brand?: unknown
  unit?: unknown
  serving_size_g?: unknown
  calories_per_serving?: unknown
  protein_g_per_serving?: unknown
  fat_g_per_serving?: unknown
  carbs_g_per_serving?: unknown
  fiber_g_per_serving?: unknown
  fulfillment_source?: unknown
  barcode?: unknown
  product_url?: unknown
  notes?: unknown
  tracks_inventory?: unknown
  servings_per_unit?: unknown
}

function reqString(o: IncomingBody, key: keyof IncomingBody): string | { error: string } {
  const v = o[key]
  if (typeof v !== 'string' || !v.trim()) {
    return { error: `${String(key)} is required` }
  }
  return v
}

function reqNumber(o: IncomingBody, key: keyof IncomingBody): number | { error: string } {
  const v = o[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    return { error: `${String(key)} is required and must be a number` }
  }
  return v
}

function nullableNumber(o: IncomingBody, key: keyof IncomingBody): number | null | { error: string } {
  const v = o[key]
  if (v === undefined || v === null) return null
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    return { error: `${String(key)} must be a number or null` }
  }
  return v
}

function nullableString(o: IncomingBody, key: keyof IncomingBody): string | null | { error: string } {
  const v = o[key]
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') {
    return { error: `${String(key)} must be a string or null` }
  }
  return v
}

function nullableInteger(o: IncomingBody, key: keyof IncomingBody): number | null | { error: string } {
  const v = o[key]
  if (v === undefined || v === null) return null
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    return { error: `${String(key)} must be an integer or null` }
  }
  return v
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true })
    if (error) {
      console.error('[api/products] select error:', error.message)
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json(data ?? [])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[api/products] GET FULL ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IncomingBody

    const name = reqString(body, 'name')
    if (typeof name !== 'string') return Response.json(name, { status: 400 })

    const unit = reqString(body, 'unit')
    if (typeof unit !== 'string') return Response.json(unit, { status: 400 })

    if (typeof body.fulfillment_source !== 'string' ||
        !(ALLOWED_SOURCES as string[]).includes(body.fulfillment_source)) {
      return Response.json(
        { error: `fulfillment_source must be one of ${ALLOWED_SOURCES.join('|')}` },
        { status: 400 },
      )
    }

    const cal = reqNumber(body, 'calories_per_serving')
    if (typeof cal !== 'number') return Response.json(cal, { status: 400 })
    const prot = reqNumber(body, 'protein_g_per_serving')
    if (typeof prot !== 'number') return Response.json(prot, { status: 400 })
    const fat = reqNumber(body, 'fat_g_per_serving')
    if (typeof fat !== 'number') return Response.json(fat, { status: 400 })
    const carb = reqNumber(body, 'carbs_g_per_serving')
    if (typeof carb !== 'number') return Response.json(carb, { status: 400 })

    const brand = nullableString(body, 'brand')
    if (typeof brand === 'object' && brand !== null && 'error' in brand) return Response.json(brand, { status: 400 })
    const servingSize = nullableNumber(body, 'serving_size_g')
    if (typeof servingSize === 'object' && servingSize !== null && 'error' in servingSize) return Response.json(servingSize, { status: 400 })
    const fiber = nullableNumber(body, 'fiber_g_per_serving')
    if (typeof fiber === 'object' && fiber !== null && 'error' in fiber) return Response.json(fiber, { status: 400 })
    const barcode = nullableString(body, 'barcode')
    if (typeof barcode === 'object' && barcode !== null && 'error' in barcode) return Response.json(barcode, { status: 400 })
    const productUrl = nullableString(body, 'product_url')
    if (typeof productUrl === 'object' && productUrl !== null && 'error' in productUrl) return Response.json(productUrl, { status: 400 })
    const notes = nullableString(body, 'notes')
    if (typeof notes === 'object' && notes !== null && 'error' in notes) return Response.json(notes, { status: 400 })
    const servingsPerUnit = nullableInteger(body, 'servings_per_unit')
    if (typeof servingsPerUnit === 'object' && servingsPerUnit !== null && 'error' in servingsPerUnit) return Response.json(servingsPerUnit, { status: 400 })

    const tracksInventory =
      typeof body.tracks_inventory === 'boolean' ? body.tracks_inventory : false

    const supabase = await createClient()
    const insertRow = {
      name: name.trim(),
      brand: brand as string | null,
      unit: unit.trim(),
      serving_size_g: servingSize as number | null,
      calories_per_serving: cal,
      protein_g_per_serving: prot,
      fat_g_per_serving: fat,
      carbs_g_per_serving: carb,
      fiber_g_per_serving: fiber as number | null,
      fulfillment_source: body.fulfillment_source as ProductFulfillmentSource,
      barcode: barcode as string | null,
      product_url: productUrl as string | null,
      notes: notes as string | null,
      tracks_inventory: tracksInventory,
      servings_per_unit: servingsPerUnit as number | null,
    }
    const { data, error } = await supabase
      .from('products')
      .insert(insertRow)
      .select('*')
      .single()
    if (error) {
      console.error('[api/products] insert error:', error.message)
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[api/products] POST FULL ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
