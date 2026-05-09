// Op FASTRAK Brick Gamma B — Open Food Facts response types.
//
// Mirrors the subset of OFF's product schema we consume during bulk-
// cache writes (text search + product detail). Existing barcode-lookup
// integration in lib/claude/tools/search-food-database.ts has its own
// narrower OffProduct interface for parse-time use; this module owns
// the bulk-cache-side shape (richer field set, includes serving + brand
// + nutriscore for confidence tiering).

export interface OffNutriments {
  'energy-kcal_serving'?: number
  'energy-kcal_100g'?: number
  'proteins_serving'?: number
  'proteins_100g'?: number
  'carbohydrates_serving'?: number
  'carbohydrates_100g'?: number
  'fat_serving'?: number
  'fat_100g'?: number
  'fiber_serving'?: number
  'fiber_100g'?: number
}

export interface OffProduct {
  code: string                  // barcode (typically EAN-13 or UPC-12)
  brands?: string               // comma-separated brand list; first token is canonical
  product_name?: string
  serving_size?: string         // human label "1 bar (65 g)" / "0.5 cup (123 g)"
  serving_quantity?: number     // canonical numeric (65)
  serving_quantity_unit?: string // "g" or "ml"
  nutriments?: OffNutriments
  nutriscore_grade?: string     // 'a' | 'b' | 'c' | 'd' | 'e' if curated; absent on uncurated entries
  countries?: string            // comma-separated; sometimes useful for ranking
}

export interface OffSearchResponse {
  count?: number
  page?: number
  page_count?: number
  page_size?: number
  products?: OffProduct[]
}

export interface OffProductDetailResponse {
  status?: number               // 1 if found, 0 if not
  product?: OffProduct
}
