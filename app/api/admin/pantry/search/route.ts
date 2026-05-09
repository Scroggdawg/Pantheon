// Op FASTRAK Brick Gamma E.2 — bulk-add UI search endpoint.
//
// POST /api/admin/pantry/search
// Body: { names: string[] }
// Response: { results: PantrySearchResult[] }
//
// For each name, fan out three sub-tasks in parallel:
//   1. OFF text search (lib/off/search.ts; bulk-cache integration)
//   2. USDA name search → top fdcId resolution + lightweight detail map
//   3. Dedup check against existing products by lower(trim(name))
//
// Per-name error isolation: if any sub-task throws, that section's
// field is set to its empty default (or `error: <message>`); other
// sub-tasks for the same name proceed independently. Other names'
// fan-outs are unaffected.
//
// Auth via existing pantheon_session cookie at proxy.ts (no extra
// gating needed; admin routes are browser-only for now).

import { createClient } from '@/lib/supabase/server'
import { offTextSearch } from '@/lib/off/search'
import type { OffProduct } from '@/lib/off/types'

const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'
const USER_AGENT = 'Pantheon/1.0 (luke@scrog.dev)'

interface SearchBody {
  names: string[]
}

interface UsdaCandidate {
  fdc_id: number
  description: string
  data_type: string
  brand: string | null
  per_serving: {
    kcal: number | null
    protein_g: number | null
    carbs_g: number | null
    fat_g: number | null
  }
}

interface PantrySearchResult {
  input_name: string
  already_exists?: { product_id: string; existing_name: string }
  off: OffProduct[]
  usda: UsdaCandidate[]
  off_error?: string
  usda_error?: string
  dedup_error?: string
}

function bad(status: number, error: string) {
  return Response.json({ error }, { status })
}

// USDA helpers ---------------------------------------------------------

interface UsdaSearchResponse {
  foods?: Array<{
    fdcId?: number
    description?: string
    dataType?: string
    brandName?: string
    brandOwner?: string
    foodNutrients?: Array<{ nutrientId?: number; nutrientName?: string; value?: number }>
    servingSize?: number
    servingSizeUnit?: string
  }>
}

const USDA_NUTRIENT_ENERGY_KCAL = 1008
const USDA_NUTRIENT_PROTEIN_G = 1003
const USDA_NUTRIENT_CARBS_G = 1005
const USDA_NUTRIENT_FAT_G = 1004

async function usdaQuery(
  name: string,
  pageSize: number,
  dataType: string | undefined,
  apiKey: string,
): Promise<UsdaSearchResponse['foods']> {
  const params = new URLSearchParams({
    query: name,
    pageSize: String(pageSize),
    api_key: apiKey,
  })
  if (dataType) params.set('dataType', dataType)
  try {
    const r = await fetch(`${USDA_SEARCH_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return []
    const json = (await r.json()) as UsdaSearchResponse
    return json.foods ?? []
  } catch {
    return []
  }
}

async function usdaSearchTopN(name: string, limit: number = 3): Promise<UsdaCandidate[]> {
  const apiKey = process.env.USDA_FDC_API_KEY
  if (!apiKey) return []

  // Greek God Bod bulk-add smoke (LEAN PROTEINS) surfaced that USDA's
  // /foods/search ranks Branded entries first for many generic queries
  // ("Chicken breast" returned 5 Branded; 0 Foundation/FNDDS in top-9).
  // In-memory tier sort then has nothing research-grade to surface.
  // Fix: query Foundation/Survey (FNDDS) explicitly first; fall back to
  // all-types only when research-grade returns 0. Mirrors the proven
  // pattern in lib/usda/portions.ts:usdaResolveFdcId from Gamma A.
  const research = await usdaQuery(name, limit * 3, 'Foundation,Survey (FNDDS)', apiKey)
  const foods = (research && research.length > 0)
    ? research
    : (await usdaQuery(name, limit * 3, undefined, apiKey)) ?? []

  try {
    // Tier preference: Foundation/Survey FNDDS > SR Legacy > Branded.
    function tier(dt: string | undefined): number {
      if (dt === 'Foundation' || dt === 'Survey (FNDDS)') return 1
      if (dt === 'SR Legacy') return 2
      if (dt === 'Branded') return 3
      return 4
    }

    const ranked = [...(foods ?? [])].sort((a, b) => tier(a.dataType) - tier(b.dataType))
    return ranked.slice(0, limit).map((f) => {
      const nutrients = f.foodNutrients ?? []
      function findValue(id: number): number | null {
        const n = nutrients.find((x) => x.nutrientId === id)
        if (!n || typeof n.value !== 'number') return null
        return n.value
      }
      // USDA per_100g values; scale to per-serving when servingSize present.
      const sizeG = typeof f.servingSize === 'number' ? f.servingSize : null
      const factor = sizeG && f.servingSizeUnit === 'g' ? sizeG / 100 : null
      const per100 = {
        kcal: findValue(USDA_NUTRIENT_ENERGY_KCAL),
        protein_g: findValue(USDA_NUTRIENT_PROTEIN_G),
        carbs_g: findValue(USDA_NUTRIENT_CARBS_G),
        fat_g: findValue(USDA_NUTRIENT_FAT_G),
      }
      const perServing = factor !== null ? {
        kcal: per100.kcal !== null ? Math.round(per100.kcal * factor * 100) / 100 : null,
        protein_g: per100.protein_g !== null ? Math.round(per100.protein_g * factor * 100) / 100 : null,
        carbs_g: per100.carbs_g !== null ? Math.round(per100.carbs_g * factor * 100) / 100 : null,
        fat_g: per100.fat_g !== null ? Math.round(per100.fat_g * factor * 100) / 100 : null,
      } : per100  // fall back to per-100g when no serving info

      return {
        fdc_id: f.fdcId ?? 0,
        description: f.description ?? '',
        data_type: f.dataType ?? '',
        brand: f.brandName ?? f.brandOwner ?? null,
        per_serving: perServing,
      }
    })
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------

export async function POST(request: Request) {
  let body: SearchBody
  try {
    body = (await request.json()) as SearchBody
  } catch {
    return bad(400, 'invalid JSON body')
  }
  if (!Array.isArray(body.names)) return bad(400, 'names must be array')
  const cleanedNames = body.names
    .map((n) => (typeof n === 'string' ? n.trim() : ''))
    .filter((n) => n.length > 0)
  if (cleanedNames.length === 0) return bad(400, 'no valid names supplied')
  if (cleanedNames.length > 50) return bad(400, 'maximum 50 names per request')

  const supabase = await createClient()

  // Per-name fan-out. Each name spawns three independent sub-tasks; failures
  // are captured per-task so the others can still return.
  const results: PantrySearchResult[] = await Promise.all(
    cleanedNames.map(async (name) => {
      const [offSettled, usdaSettled, dedupSettled] = await Promise.allSettled([
        offTextSearch(name, null, 3),
        usdaSearchTopN(name, 3),
        supabase
          .from('products')
          .select('id, name')
          .ilike('name', name)
          .limit(1)
          .maybeSingle(),
      ])

      const result: PantrySearchResult = {
        input_name: name,
        off: [],
        usda: [],
      }
      if (offSettled.status === 'fulfilled') result.off = offSettled.value
      else result.off_error = (offSettled.reason as Error)?.message ?? 'OFF lookup failed'

      if (usdaSettled.status === 'fulfilled') result.usda = usdaSettled.value
      else result.usda_error = (usdaSettled.reason as Error)?.message ?? 'USDA lookup failed'

      if (dedupSettled.status === 'fulfilled') {
        const data = dedupSettled.value.data
        if (data) {
          result.already_exists = { product_id: data.id, existing_name: data.name }
        }
      } else {
        result.dedup_error = (dedupSettled.reason as Error)?.message ?? 'dedup lookup failed'
      }
      return result
    }),
  )

  return Response.json({ results })
}
