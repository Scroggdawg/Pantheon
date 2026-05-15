import type { UnitAlternative } from '@/types/database'

export type PantrySourceKind = 'usda' | 'off' | 'manual' | 'restaurant' | 'llm'
export type PantryDecision = 'auto_approved' | 'review_required' | 'rejected'
export type PantryCategory =
  | 'whole_foods'
  | 'proteins'
  | 'cuisine_staples'
  | 'sauces_condiments_oils'
  | 'breakfast_snacks'
  | 'beverages'
  | 'prepared_common'
  | 'coverage_buffer'

export interface PantryTarget {
  query: string
  category: PantryCategory
  reviewOnly: boolean
}

export interface PantryProductPayload {
  name: string
  brand: string | null
  unit: string
  serving_size_g: number | null
  calories_per_serving: number
  protein_g_per_serving: number
  fat_g_per_serving: number
  carbs_g_per_serving: number
  fiber_g_per_serving: number | null
  fulfillment_source: 'manual'
  barcode: string | null
  product_url: string | null
  notes: string | null
  tracks_inventory: boolean
  servings_per_unit: number | null
  unit_alternatives: UnitAlternative[]
  fdc_id: number | null
  unit_alternatives_updated_at: string
  provenance_source_kind: PantrySourceKind
  provenance_dataset: string | null
  provenance_external_id: string | null
  provenance_release: string | null
  import_confidence: 'low' | 'medium' | 'high'
  canonical_category: PantryCategory
}

export interface PantryCandidate {
  candidate_key: string
  target_query: string
  normalized_name: string
  display_name: string
  source_kind: PantrySourceKind
  source_dataset: string | null
  external_id: string | null
  source_release: string | null
  category: PantryCategory
  proposed_product: PantryProductPayload
  aliases: string[]
  rejected_aliases: string[]
  unit_alternatives: UnitAlternative[]
  risk_score: number
  decision: PantryDecision
  reasons: string[]
}

export interface ExistingProductSummary {
  id: string
  name: string
  brand: string | null
  barcode: string | null
}

export interface PantryProfile {
  version: number
  name: string
  target_count: number
  luke_food_profile: {
    core_cuisines: string[]
    restaurants: string[]
    protein_anchors: string[]
    staple_categories: string[]
  }
  already_covered: string[]
  allocation: Record<PantryCategory, number>
  categories: Record<PantryCategory, string[]>
  count_unit_grams: Record<string, number>
  review_only_patterns: string[]
}
