// Op FASTRAK Brick Gamma A — USDA food_portions integration.
//
// The existing search-food-database tool hits USDA's /v1/foods/search
// (lighter list, no portions). This module hits /v1/food/{fdcId} for the
// full record including foodPortions[] — the canonical source for unit-
// to-grams conversion data feeding products.unit_alternatives.
//
// Filtering rules (per Phase 0 §F.3 empirical probe):
//   - Skip rows where portionDescription === 'Quantity not specified'
//   - Skip rows where gramWeight === 0 or null
//   - Skip rows where the resolved unit name is empty after cleaning
//
// Unit name canonicalization (per Q1 in EXECUTE brief): lowercase the
// label, preserve internal spaces, strip leading numeric/quantity prefix
// ("1 fl oz" → "fl oz", "1 drink" → "drink"). Keeps human readability
// for UI display while making (qty, unit) → grams parseable downstream.
//
// Confidence by USDA dataset (per A.2 source-ranking framing):
//   - Survey (FNDDS) → 'high' (research-grade portion data)
//   - SR Legacy → 'medium' (curated but older)
//   - Foundation → 'high' (newest, research-grade)
//   - Branded → 'medium' (label-derived, single canonical serving)
//   - Anything else → 'low'

const USDA_DETAILS_URL = 'https://api.nal.usda.gov/fdc/v1/food'
const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'
const USER_AGENT = 'Pantheon/1.0 (luke@scrog.dev)'

export type UnitAlternativeSource =
  | 'usda'
  | 'off'
  | 'standard'
  | 'user_corrected'
  | 'llm_estimated'

export type UnitAlternativeConfidence = 'high' | 'medium' | 'low'

export interface UnitAlternative {
  unit: string
  grams: number
  source: UnitAlternativeSource
  confidence: UnitAlternativeConfidence
}

interface UsdaPortion {
  id?: number
  measureUnit?: { id?: number; name?: string; abbreviation?: string }
  modifier?: string
  amount?: number
  gramWeight?: number
  portionDescription?: string
  sequenceNumber?: number
}

interface UsdaFoodDetail {
  fdcId: number
  description?: string
  dataType?: string
  foodPortions?: UsdaPortion[]
}

function confidenceForDataType(dataType: string | undefined): UnitAlternativeConfidence {
  switch (dataType) {
    case 'Survey (FNDDS)':
    case 'Foundation':
      return 'high'
    case 'SR Legacy':
    case 'Branded':
      return 'medium'
    default:
      return 'low'
  }
}

// Strip a leading numeric prefix ("1 fl oz" → "fl oz") and lowercase.
// Drops trailing/leading whitespace. Empty string return signals "skip".
function canonicalizeUnit(raw: string | undefined): string {
  if (!raw) return ''
  let s = raw.trim().toLowerCase()
  // Strip leading "1 " or any single number followed by a space.
  // Decimals + fractions like "0.5 cup" or "1/2 cup" too.
  s = s.replace(/^\d+(?:\.\d+)?\s+/, '')
  s = s.replace(/^\d+\/\d+\s+/, '')
  s = s.trim()
  return s
}

/**
 * Map a single USDA foodPortion entry to a UnitAlternative.
 * Returns null when the portion fails filtering rules.
 *
 * Resolution order for the unit label (USDA's foodPortions shape varies
 * across datasets — Survey/FNDDS uses portionDescription, SR Legacy uses
 * modifier, Branded uses measureUnit.name):
 *   1. measureUnit.name (when present and != 'undetermined')
 *   2. portionDescription (when present and != 'Quantity not specified')
 *   3. modifier (SR Legacy fallback — unit name like 'tbsp', 'cup')
 *
 * Then canonicalizeUnit drops the leading numeric prefix.
 *
 * USDA's `gramWeight` is the total grams for `amount` of `unit`. When
 * amount is set and != 1, normalize: grams_per_one_unit = gramWeight/amount.
 */
export function portionToUnitAlternative(
  p: UsdaPortion,
  dataType: string | undefined,
): UnitAlternative | null {
  const grams = Number(p.gramWeight ?? 0)
  if (!Number.isFinite(grams) || grams <= 0) return null

  const measureName = p.measureUnit?.name
  const desc = p.portionDescription
  if (desc === 'Quantity not specified') return null
  // Skip "RACC" (Reference Amount Customarily Consumed) — FDA
  // regulatory shorthand, not a user-meaningful portion name.
  if (measureName === 'RACC') return null

  let rawLabel = ''
  if (measureName && measureName !== 'undetermined') {
    rawLabel = measureName
  } else if (desc) {
    rawLabel = desc
  } else if (p.modifier) {
    // SR Legacy commonly stores the unit name in modifier when measureUnit
    // is 'undetermined' and portionDescription is absent. modifier values
    // are short ("tbsp", "cup", "fl oz", "slice").
    rawLabel = p.modifier
  }

  const unit = canonicalizeUnit(rawLabel)
  if (unit.length === 0) return null

  // Normalize for amount > 0 (rare; mostly 1).
  const amount = Number(p.amount ?? 1)
  const gramsPerUnit = amount > 0 ? grams / amount : grams

  return {
    unit,
    grams: Math.round(gramsPerUnit * 100) / 100,
    source: 'usda',
    confidence: confidenceForDataType(dataType),
  }
}

/**
 * Fetch /v1/food/{fdcId} from USDA, parse foodPortions[] into
 * UnitAlternative[]. Returns [] on any API failure (caller proceeds).
 */
export async function usdaFetchPortions(fdcId: number): Promise<UnitAlternative[]> {
  const apiKey = process.env.USDA_FDC_API_KEY
  if (!apiKey) return []

  const url = `${USDA_DETAILS_URL}/${fdcId}?api_key=${encodeURIComponent(apiKey)}`
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return []
    const json = (await r.json()) as UsdaFoodDetail
    const portions = json.foodPortions ?? []
    const dataType = json.dataType
    const alternatives: UnitAlternative[] = []
    const seenUnits = new Set<string>()
    for (const p of portions) {
      const ua = portionToUnitAlternative(p, dataType)
      if (!ua) continue
      // Dedup by unit (lowercase). USDA sometimes lists the same unit
      // multiple times with subtle modifiers; keep the first one seen.
      if (seenUnits.has(ua.unit)) continue
      seenUnits.add(ua.unit)
      alternatives.push(ua)
    }
    return alternatives
  } catch {
    return []
  }
}

/**
 * Name-search USDA to recover an fdcId for a product whose original
 * fdcId wasn't preserved at create time. Used by the Gamma A backfill
 * script. Returns the top match's fdcId or null.
 *
 * Tiered preference (per A.2 source-ranking framing): research-grade
 * dataTypes (Foundation, Survey/FNDDS) carry the most reliable portion
 * data; SR Legacy and Branded are fallbacks. Within each tier, prefer
 * the shortest description (more canonical — "Banana, raw" beats
 * "Bananas, dehydrated, or banana powder").
 *
 * Search strategy:
 *   1. If brand present: dataType=Branded with "{brand} {name}" first.
 *   2. Otherwise (or branded miss): pageSize=10 across all dataTypes,
 *      pick the best by tier+description-length.
 */
export async function usdaResolveFdcId(
  name: string,
  brand: string | null | undefined,
): Promise<number | null> {
  const apiKey = process.env.USDA_FDC_API_KEY
  if (!apiKey) return null

  interface UsdaFoodLite {
    fdcId?: number
    dataType?: string
    description?: string
  }

  async function searchPaged(query: string, dataType?: string): Promise<UsdaFoodLite[]> {
    const params = new URLSearchParams({
      query,
      pageSize: '10',
      api_key: apiKey!,
    })
    if (dataType) params.set('dataType', dataType)
    try {
      const r = await fetch(`${USDA_SEARCH_URL}?${params}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(10000),
      })
      if (!r.ok) return []
      const json = (await r.json()) as { foods?: UsdaFoodLite[] }
      return json.foods ?? []
    } catch {
      return []
    }
  }

  function rankTier(dt: string | undefined): number {
    switch (dt) {
      case 'Foundation':
      case 'Survey (FNDDS)':
        return 1
      case 'SR Legacy':
        return 2
      case 'Branded':
        return 3
      default:
        return 4
    }
  }

  // Prefer descriptions that START with the query (or its first token).
  // Without this, "Blueberries" search would prefer "Waffle, fruit" (13
  // chars) over "Blueberries, raw" (16 chars) on raw description-length
  // sort. Query-prefix match captures the canonical-name signal.
  const queryFirstToken = name.toLowerCase().split(/\s+/)[0] ?? ''
  function prefixScore(desc: string | undefined): number {
    if (!desc) return 0
    const lower = desc.toLowerCase()
    if (lower.startsWith(name.toLowerCase())) return 2
    if (lower.startsWith(queryFirstToken)) return 1
    return 0
  }

  function pickBest(foods: UsdaFoodLite[]): number | null {
    if (foods.length === 0) return null
    const ranked = [...foods].sort((a, b) => {
      const tierDiff = rankTier(a.dataType) - rankTier(b.dataType)
      if (tierDiff !== 0) return tierDiff
      // Higher prefixScore wins (sort desc on score).
      const prefDiff = prefixScore(b.description) - prefixScore(a.description)
      if (prefDiff !== 0) return prefDiff
      const aLen = (a.description ?? '').length
      const bLen = (b.description ?? '').length
      return aLen - bLen
    })
    return ranked[0]?.fdcId ?? null
  }

  // Foundation/FNDDS FIRST — research-grade entries carry the most
  // reliable portion data, even for foods with a brand. (Branded entries
  // typically have 0 portions; the brand label captures one canonical
  // serving in serving_size_g, not a portion array.) If the food is
  // truly proprietary (specific commercial product), the brand fallback
  // below catches it.
  const research = await searchPaged(name, 'Foundation,Survey (FNDDS)')
  const fdcResearch = pickBest(research)
  if (fdcResearch) return fdcResearch

  // Branded fallback: brand-anchored search for proprietary products
  // not in the research-grade datasets.
  if (brand && brand.length > 0) {
    const branded = await searchPaged(`${brand} ${name}`, 'Branded')
    const fdc = pickBest(branded)
    if (fdc) return fdc
  }

  // Final fallback: SR Legacy + anything else.
  const all = await searchPaged(name)
  return pickBest(all)
}
