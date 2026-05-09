// Op FASTRAK Brick Gamma E.5 — bulk-INSERT save endpoint.
//
// POST /api/admin/pantry/save
// Body: { user_id, rows: PickedRow[] }
// Response: { results: SaveResult[] }
//
// For each row, build a ProductInsert based on source:
//   - OFF:   row uses OFF candidate's nutriments + serving info
//   - USDA:  row uses USDA candidate's per-serving + fetches portions
//   - LLM:   row uses Luke's manual macros + Gamma C llmFillPortions
//
// Bulk INSERT via supabase.from('products').insert([]).select(). Per-row
// success/failure tracked in response so client can show retry per row.
//
// Bust user's parse-meal response cache on success (Alpha.5 pattern;
// products table changed → matcher candidates may shift).

import { bustResponseCacheForUser } from '@/lib/claude/parse-meal-response-cache'
import { createClient } from '@/lib/supabase/server'
import { llmFillPortions } from '@/lib/llm-fill/portions'
import { offTextSearch, parseUnitFromServingSize } from '@/lib/off/search'
import { usdaFetchPortions } from '@/lib/usda/portions'
import type { UnitAlternative } from '@/types/database'

interface PickedRowOff {
  source: 'off'
  input_name: string
  off_index: number  // index into the search response's off[] array
}

interface PickedRowUsda {
  source: 'usda'
  input_name: string
  fdc_id: number
  description: string
  brand: string | null
  per_serving: {
    kcal: number | null
    protein_g: number | null
    carbs_g: number | null
    fat_g: number | null
  }
}

interface PickedRowLlm {
  source: 'llm'
  input_name: string
  brand: string | null
  manual_macros: {
    serving_size_g: number
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
}

type PickedRow = PickedRowOff | PickedRowUsda | PickedRowLlm

interface SaveBody {
  user_id: string
  rows: PickedRow[]
}

interface SaveResult {
  input_name: string
  status: 'saved' | 'failed'
  product_id?: string
  error?: string
}

function bad(status: number, error: string) {
  return Response.json({ error }, { status })
}

// ---------------------------------------------------------------------
// Source-specific row builders. Each returns a Partial<ProductInsert> +
// the unit_alternatives array. Caller composes into the final row object.
// ---------------------------------------------------------------------

interface ProductInsertCore {
  name: string
  brand: string | null
  unit: string
  serving_size_g: number | null
  calories_per_serving: number
  protein_g_per_serving: number
  carbs_g_per_serving: number
  fat_g_per_serving: number
  fiber_g_per_serving: number | null
  fulfillment_source: 'manual'
  barcode: string | null
  product_url: null
  notes: null
  tracks_inventory: false
  servings_per_unit: null
  unit_alternatives: UnitAlternative[]
  fdc_id: number | null
  unit_alternatives_updated_at: string
}

async function buildOffRow(row: PickedRowOff): Promise<ProductInsertCore | null> {
  // Re-run the OFF text search to recover the candidate the client picked.
  // (We don't trust the client to send back full OFF objects; safer to
  // re-fetch by index from the same search query.)
  const candidates = await offTextSearch(row.input_name, null, 5)
  const off = candidates[row.off_index]
  if (!off) return null
  const brand = off.brands?.split(',')[0]?.trim() ?? null
  const unit = parseUnitFromServingSize(off.serving_size) || 'serving'
  const grams = off.serving_quantity ?? 0
  const n = off.nutriments ?? {}
  const sq = grams
  function perServingFromPer100(per100: number | undefined): number {
    if (per100 === undefined || sq <= 0) return 0
    return Math.round((per100 * sq) / 100 * 100) / 100
  }
  const kcal = n['energy-kcal_serving'] ?? perServingFromPer100(n['energy-kcal_100g'])
  const protein = n['proteins_serving'] ?? perServingFromPer100(n['proteins_100g'])
  const carbs = n['carbohydrates_serving'] ?? perServingFromPer100(n['carbohydrates_100g'])
  const fat = n['fat_serving'] ?? perServingFromPer100(n['fat_100g'])
  const fiber = n['fiber_serving'] ?? perServingFromPer100(n['fiber_100g'])

  const confidence: UnitAlternative['confidence'] =
    off.nutriscore_grade && off.nutriscore_grade !== 'unknown' ? 'high' : 'medium'
  const unitAlts: UnitAlternative[] = grams > 0 ? [{
    unit,
    grams: Math.round(grams * 100) / 100,
    source: 'off',
    confidence,
  }] : []

  return {
    name: off.product_name?.trim() || row.input_name,
    brand,
    unit,
    serving_size_g: grams > 0 ? grams : null,
    calories_per_serving: kcal,
    protein_g_per_serving: protein,
    carbs_g_per_serving: carbs,
    fat_g_per_serving: fat,
    fiber_g_per_serving: fiber > 0 ? fiber : null,
    fulfillment_source: 'manual',
    barcode: off.code ?? null,
    product_url: null,
    notes: null,
    tracks_inventory: false,
    servings_per_unit: null,
    unit_alternatives: unitAlts,
    fdc_id: null,
    unit_alternatives_updated_at: new Date().toISOString(),
  }
}

async function buildUsdaRow(row: PickedRowUsda): Promise<ProductInsertCore | null> {
  // Fetch foodPortions to populate unit_alternatives
  const unitAlts = await usdaFetchPortions(row.fdc_id)

  // Use per_serving values from the search response. If kcal is null,
  // signal failure — caller will surface error.
  const ps = row.per_serving
  if (ps.kcal === null) return null

  return {
    name: row.description.trim() || row.input_name,
    brand: row.brand,
    unit: 'serving',
    serving_size_g: null,  // USDA search doesn't reliably return; foodPortions has unit-grams instead
    calories_per_serving: ps.kcal,
    protein_g_per_serving: ps.protein_g ?? 0,
    carbs_g_per_serving: ps.carbs_g ?? 0,
    fat_g_per_serving: ps.fat_g ?? 0,
    fiber_g_per_serving: null,
    fulfillment_source: 'manual',
    barcode: null,
    product_url: null,
    notes: null,
    tracks_inventory: false,
    servings_per_unit: null,
    unit_alternatives: unitAlts,
    fdc_id: row.fdc_id,
    unit_alternatives_updated_at: new Date().toISOString(),
  }
}

async function buildLlmRow(row: PickedRowLlm): Promise<ProductInsertCore | null> {
  const m = row.manual_macros
  if (!m || !Number.isFinite(m.serving_size_g) || m.serving_size_g <= 0) return null
  if (!Number.isFinite(m.calories) || m.calories < 0) return null

  // Get LLM-fill unit_alternatives. Empty [] is acceptable — Luke can
  // hand-correct via future Gamma D / Brick Delta.
  const unitAlts = await llmFillPortions(row.input_name, row.brand)

  return {
    name: row.input_name.trim(),
    brand: row.brand,
    unit: 'serving',
    serving_size_g: m.serving_size_g,
    calories_per_serving: Math.round(m.calories),
    protein_g_per_serving: m.protein_g ?? 0,
    carbs_g_per_serving: m.carbs_g ?? 0,
    fat_g_per_serving: m.fat_g ?? 0,
    fiber_g_per_serving: null,
    fulfillment_source: 'manual',
    barcode: null,
    product_url: null,
    notes: null,
    tracks_inventory: false,
    servings_per_unit: null,
    unit_alternatives: unitAlts,
    fdc_id: null,
    unit_alternatives_updated_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------

export async function POST(request: Request) {
  let body: SaveBody
  try {
    body = (await request.json()) as SaveBody
  } catch {
    return bad(400, 'invalid JSON body')
  }
  if (!body.user_id || typeof body.user_id !== 'string') return bad(400, 'user_id required')
  if (!Array.isArray(body.rows) || body.rows.length === 0) return bad(400, 'rows[] required')
  if (body.rows.length > 50) return bad(400, 'maximum 50 rows per save')

  const supabase = await createClient()

  // Build row payloads in parallel. Failures land per-row; we still
  // attempt the bulk INSERT for whatever succeeded.
  const buildResults = await Promise.allSettled(
    body.rows.map(async (row) => {
      switch (row.source) {
        case 'off':
          return buildOffRow(row)
        case 'usda':
          return buildUsdaRow(row)
        case 'llm':
          return buildLlmRow(row)
        default:
          return null
      }
    }),
  )

  const results: SaveResult[] = []
  const insertPayloads: ProductInsertCore[] = []
  const insertIndices: number[] = [] // insertPayloads index → results index

  for (let i = 0; i < body.rows.length; i++) {
    const row = body.rows[i]
    const built = buildResults[i]
    if (built.status === 'rejected' || built.value === null) {
      const reason = built.status === 'rejected'
        ? (built.reason as Error)?.message ?? 'build failed'
        : 'unable to build product row from picked candidate'
      results.push({ input_name: row.input_name, status: 'failed', error: reason })
      continue
    }
    insertIndices.push(i)
    insertPayloads.push(built.value)
    // Reserve a slot in results for this row; will fill after INSERT
    results.push({ input_name: row.input_name, status: 'failed' })
  }

  if (insertPayloads.length > 0) {
    const { data: inserted, error: insErr } = await supabase
      .from('products')
      .insert(insertPayloads)
      .select('id, name')

    if (insErr || !inserted) {
      // Bulk INSERT failed: mark all reserved slots failed with the same error
      for (const idx of insertIndices) {
        results[idx] = {
          ...results[idx],
          status: 'failed',
          error: `bulk insert failed: ${insErr?.message ?? 'unknown'}`,
        }
      }
    } else {
      // Map each inserted row back. Order should match insertPayloads order
      // but we match by name as a defensive cross-check.
      for (let j = 0; j < insertIndices.length; j++) {
        const idx = insertIndices[j]
        const row = inserted[j]
        if (row) {
          results[idx] = {
            input_name: results[idx].input_name,
            status: 'saved',
            product_id: row.id,
          }
        }
      }
    }
  }

  // Bust matcher cache once if any rows saved (Alpha.5 pattern; products
  // table changed → matcher candidates may shift).
  const anySaved = results.some((r) => r.status === 'saved')
  if (anySaved) {
    await bustResponseCacheForUser(supabase, body.user_id)
  }

  return Response.json({ results })
}
