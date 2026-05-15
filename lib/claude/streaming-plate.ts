import type { SearchFirstPlateDraft, SearchFirstPlateItem } from './search-first-resolver'

export type PlateStreamEventType =
  | 'plate_started'
  | 'item_ready'
  | 'item_needs_fallback'
  | 'plate_completed'

export interface PlateStreamEvent {
  type: PlateStreamEventType
  seq: number
  transcript: string
  item_index?: number
  item?: {
    name: string | null
    query: string
    review_pill: SearchFirstPlateItem['review_pill']
    outcome: SearchFirstPlateItem['outcome']
    source_ref: string | null
    calories: number | null
    protein_g: number | null
    carbs_g: number | null
    fat_g: number | null
  }
  totals?: {
    ready_items: number
    fallback_items: number
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
}

function eventItem(item: SearchFirstPlateItem): NonNullable<PlateStreamEvent['item']> {
  return {
    name: item.name,
    query: item.query,
    review_pill: item.review_pill,
    outcome: item.outcome,
    source_ref: item.source_ref,
    calories: item.calories,
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
  }
}

function runningTotals(items: SearchFirstPlateItem[]): NonNullable<PlateStreamEvent['totals']> {
  const ready = items.filter((item) => item.outcome !== 'fallback_required')
  const fallback = items.length - ready.length
  return {
    ready_items: ready.length,
    fallback_items: fallback,
    calories: Math.round(ready.reduce((acc, item) => acc + Number(item.calories ?? 0), 0)),
    protein_g: Math.round(ready.reduce((acc, item) => acc + Number(item.protein_g ?? 0), 0) * 10) / 10,
    carbs_g: Math.round(ready.reduce((acc, item) => acc + Number(item.carbs_g ?? 0), 0) * 10) / 10,
    fat_g: Math.round(ready.reduce((acc, item) => acc + Number(item.fat_g ?? 0), 0) * 10) / 10,
  }
}

export function plateStreamEventsFromDraft(draft: SearchFirstPlateDraft): PlateStreamEvent[] {
  const events: PlateStreamEvent[] = [
    {
      type: 'plate_started',
      seq: 0,
      transcript: draft.transcript,
      totals: runningTotals([]),
    },
  ]

  const emittedItems: SearchFirstPlateItem[] = []
  for (const [index, item] of draft.items.entries()) {
    emittedItems.push(item)
    events.push({
      type: item.outcome === 'fallback_required' ? 'item_needs_fallback' : 'item_ready',
      seq: events.length,
      transcript: draft.transcript,
      item_index: index,
      item: eventItem(item),
      totals: runningTotals(emittedItems),
    })
  }

  events.push({
    type: 'plate_completed',
    seq: events.length,
    transcript: draft.transcript,
    totals: runningTotals(draft.items),
  })

  return events
}

