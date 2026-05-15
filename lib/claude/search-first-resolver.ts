import {
  relaxedSegmentQuery,
  segmentTranscript,
  type TranscriptSegment,
} from './parse-meal-library-shortcut'
import {
  searchFoodIdentityDocuments,
  type FoodIdentityDocument,
  type IdentitySearchHit,
  type ResolverOutcome,
} from './food-identity'

export interface SearchFirstPlateItem {
  segment: TranscriptSegment
  query: string
  outcome: ResolverOutcome
  name: string | null
  source_ref: string | null
  identity_id: string | null
  confidence_label: 'high' | 'medium' | 'low'
  review_pill: 'HIGH' | 'CHOOSE' | 'REVIEW' | 'ESTIMATE'
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  warnings: string[]
  candidates: Array<{
    name: string
    source_ref: string | null
    identity_id: string
    score: number
  }>
}

export interface SearchFirstPlateDraft {
  transcript: string
  items: SearchFirstPlateItem[]
  fallback_required_count: number
  can_skip_expert_llm: boolean
}

function reviewPill(outcome: ResolverOutcome): SearchFirstPlateItem['review_pill'] {
  switch (outcome) {
    case 'resolved_high':
      return 'HIGH'
    case 'needs_choice':
      return 'CHOOSE'
    case 'estimated':
      return 'ESTIMATE'
    case 'needs_review':
    case 'fallback_required':
      return 'REVIEW'
  }
}

function confidenceLabel(score: number): SearchFirstPlateItem['confidence_label'] {
  if (score >= 0.85) return 'high'
  if (score >= 0.7) return 'medium'
  return 'low'
}

function bestSearchQuery(segment: TranscriptSegment): string {
  return relaxedSegmentQuery(segment.stripped) || segment.stripped
}

function itemFromHit(segment: TranscriptSegment, query: string, hits: IdentitySearchHit[]): SearchFirstPlateItem {
  const top = hits[0]
  const macros = top.document.macros_per_serving
  return {
    segment,
    query,
    outcome: top.outcome,
    name: top.document.display_name,
    source_ref: top.document.canonical_source_ref,
    identity_id: top.document.identity_id,
    confidence_label: confidenceLabel(top.score),
    review_pill: reviewPill(top.outcome),
    calories: macros?.calories ?? null,
    protein_g: macros?.protein_g ?? null,
    carbs_g: macros?.carbs_g ?? null,
    fat_g: macros?.fat_g ?? null,
    warnings: top.warnings,
    candidates: hits.slice(0, 3).map((hit) => ({
      name: hit.document.display_name,
      source_ref: hit.document.canonical_source_ref,
      identity_id: hit.document.identity_id,
      score: hit.score,
    })),
  }
}

function fallbackItem(segment: TranscriptSegment, query: string): SearchFirstPlateItem {
  return {
    segment,
    query,
    outcome: 'fallback_required',
    name: null,
    source_ref: null,
    identity_id: null,
    confidence_label: 'low',
    review_pill: 'REVIEW',
    calories: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    warnings: ['no_identity_candidate'],
    candidates: [],
  }
}

export function resolvePlateDraftFromIdentities(
  transcript: string,
  docs: FoodIdentityDocument[],
): SearchFirstPlateDraft {
  const runtimeCompositeNames = docs
    .map((doc) => doc.display_name)
    .filter((name) => /\band\b/i.test(name) || name.includes('&'))
  const segments = segmentTranscript(transcript, runtimeCompositeNames)
  const items = segments.map((segment) => {
    const query = bestSearchQuery(segment)
    const hits = searchFoodIdentityDocuments(query, docs, { minScore: 0.5, limit: 5 })
    return hits.length > 0 ? itemFromHit(segment, query, hits) : fallbackItem(segment, query)
  })
  const fallbackRequiredCount = items.filter((item) => item.outcome === 'fallback_required').length

  return {
    transcript,
    items,
    fallback_required_count: fallbackRequiredCount,
    can_skip_expert_llm: fallbackRequiredCount === 0,
  }
}
