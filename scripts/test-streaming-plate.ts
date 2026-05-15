import { plateStreamEventsFromDraft } from '../lib/claude/streaming-plate'
import type { SearchFirstPlateDraft, SearchFirstPlateItem } from '../lib/claude/search-first-resolver'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function item(overrides: Partial<SearchFirstPlateItem>): SearchFirstPlateItem {
  return {
    segment: { original: '3 eggs', stripped: '3 eggs' },
    query: '3 eggs',
    outcome: 'resolved_high',
    name: '3 eggs',
    source_ref: 'lib:saved_meal:eggs',
    identity_id: 'saved_meal:eggs',
    confidence_label: 'high',
    review_pill: 'HIGH',
    calories: 215,
    protein_g: 18.9,
    carbs_g: 1.1,
    fat_g: 14.3,
    warnings: [],
    candidates: [],
    ...overrides,
  }
}

const draft: SearchFirstPlateDraft = {
  transcript: '3 eggs and dos xx',
  can_skip_expert_llm: false,
  fallback_required_count: 1,
  items: [
    item({}),
    item({
      segment: { original: 'dos xx', stripped: 'dos xx' },
      query: 'dos xx',
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
    }),
  ],
}

const events = plateStreamEventsFromDraft(draft)

assert(events.length === 4, `expected start + 2 items + complete, got ${events.length}`)
assert(events[0].type === 'plate_started', 'first event should start plate')
assert(events[1].type === 'item_ready', 'resolved item should emit item_ready')
assert(events[2].type === 'item_needs_fallback', 'fallback item should emit item_needs_fallback')
assert(events[3].type === 'plate_completed', 'last event should complete plate')
assert(events.every((event, index) => event.seq === index), 'seq should be monotonic')
assert(events[1].totals?.calories === 215, 'running totals should include first ready item')
assert(events[2].totals?.fallback_items === 1, 'running totals should count fallback item')
assert(events[3].totals?.ready_items === 1, 'completed totals should count ready items')

console.log('LP-9 streaming Plate events: pass')

