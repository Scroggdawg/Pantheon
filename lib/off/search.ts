// Op FASTRAK Brick Gamma B — Open Food Facts text search + bulk-cache integration.
//
// The existing parse-time barcode integration (offLookupByUpc in lib/claude/
// tools/search-food-database.ts) covers per-parse barcode resolution. This
// module owns the OPPOSITE side: bulk-cache writes for the products table.
// Used by:
//   - scripts/backfill-products-off.ts (Gamma B.2 one-time backfill)
//   - future Gamma E bulk-add UI (per V20's locked architectural calls)
//
// Three exports:
//   - offTextSearch(query, brand?)    → OffProduct[]    (top results, ranked)
//   - offProductDetail(barcode)       → OffProduct | null (mirror USDA /v1/food/{fdcId})
//   - parseUnitFromServingSize(s)     → string (extract unit token from "1 bar (65 g)")
//
// Reliability discipline (per Phase 0 §F.1 empirical findings):
//   - 10s timeout per request
//   - try/catch + 1-retry pattern
//   - non-JSON responses (OFF flaky on broad/generic queries) treated as miss
//   - User-Agent header per OFF TOS (mirrors existing constants USER_AGENT)
//
// NOT for parse-time. The LLM tool path runs through search-food-database.ts.

import type {
  OffProduct,
  OffProductDetailResponse,
  OffSearchResponse,
} from './types'

const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl'
const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product/{barcode}.json'
const USER_AGENT = 'Pantheon/1.0 (luke@scrog.dev)'
const TIMEOUT_MS = 10000

async function fetchJson<T>(url: string): Promise<T | null> {
  // Single attempt with timeout. Returns null on:
  //   - non-2xx status
  //   - non-JSON body (OFF returns HTML on backend hiccups)
  //   - timeout
  //   - any other fetch failure
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!r.ok) return null
    const text = await r.text()
    if (!text || text.trim().length === 0) return null
    try {
      return JSON.parse(text) as T
    } catch {
      // OFF sometimes returns HTML error pages with 200 status during
      // transient issues. Treat as miss.
      return null
    }
  } catch {
    return null
  }
}

async function fetchJsonRetry<T>(url: string): Promise<T | null> {
  // 1-retry pattern. Second attempt waits 500ms before firing — enough
  // for transient OFF hiccups to clear without dragging the script.
  const first = await fetchJson<T>(url)
  if (first !== null) return first
  await new Promise((resolve) => setTimeout(resolve, 500))
  return await fetchJson<T>(url)
}

/**
 * Text-search OFF for products matching `query`. When `brand` is supplied,
 * prefixes the search to bias toward brand-matched results — empirically
 * branded queries return cleaner candidate lists than generic queries
 * (Phase 0 §F.1 finding).
 *
 * Returns up to `limit` (default 5) candidates, in OFF's native ranking
 * order (which roughly tracks relevance + completeness). Caller selects
 * the best per Q1 picking logic.
 */
export async function offTextSearch(
  query: string,
  brand: string | null | undefined,
  limit: number = 5,
): Promise<OffProduct[]> {
  const searchTerms = brand && brand.length > 0 ? `${brand} ${query}` : query
  const params = new URLSearchParams({
    search_terms: searchTerms,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(Math.max(1, Math.min(20, limit))),
  })
  const url = `${OFF_SEARCH_URL}?${params}`
  const json = await fetchJsonRetry<OffSearchResponse>(url)
  if (!json || !Array.isArray(json.products)) return []
  return json.products
}

/**
 * Fetch a single OFF product by barcode. Mirror of USDA's
 * /v1/food/{fdcId} pattern from lib/usda/portions.ts. Used when we
 * already have a barcode (e.g., Gamma E's barcode-paste path) and
 * want canonical product data without going through text search.
 */
export async function offProductDetail(barcode: string): Promise<OffProduct | null> {
  const url = OFF_PRODUCT_URL.replace('{barcode}', encodeURIComponent(barcode))
  const json = await fetchJsonRetry<OffProductDetailResponse>(url)
  if (!json || json.status !== 1 || !json.product) return null
  return json.product
}

/**
 * Extract a unit token from an OFF serving_size string.
 *
 *   "1 bar (65 g)"        → "bar"
 *   "0.5 cup (123 g)"     → "cup"
 *   "1 container (111 g)" → "container"
 *   "110.0g"              → "" (raw weight, no unit name)
 *   "1 fl oz (30 ml)"     → "fl oz"
 *
 * Returns empty string when no unit is parseable; caller falls back to
 * "serving" (per Phase 0 §F.2 mapping convention).
 */
export function parseUnitFromServingSize(s: string | null | undefined): string {
  if (!s) return ''
  const trimmed = s.trim()
  if (trimmed.length === 0) return ''

  // Strip the trailing parenthesized weight ("1 bar (65 g)" → "1 bar")
  const noParen = trimmed.replace(/\s*\([^)]*\)\s*$/, '').trim()

  // Match optional leading number (decimal or fraction) + unit text.
  // Examples:
  //   "1 bar"        → ["1", "bar"]
  //   "0.5 cup"      → ["0.5", "cup"]
  //   "1/2 cup"      → ["1/2", "cup"]
  //   "1 fl oz"      → ["1", "fl oz"]
  //   "110.0g"       → ["110.0", "g"]   (treat as raw weight; return '')
  //   "container"    → ["", "container"]
  const match = /^(\d+(?:\.\d+)?(?:\/\d+)?)?\s*(.+?)$/.exec(noParen)
  if (!match) return ''

  const unit = (match[2] ?? '').trim().toLowerCase()
  if (unit.length === 0) return ''

  // Drop bare-weight units (caller will fall back to "serving"). These
  // mean the product has no labeled portion — just a gram-weight serving.
  if (unit === 'g' || unit === 'ml' || unit === 'gram' || unit === 'grams') return ''

  return unit
}
