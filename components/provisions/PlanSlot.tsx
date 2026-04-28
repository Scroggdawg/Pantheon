import type { CSSProperties } from 'react'
import type { MealPlanEntry, MealSlot } from '@/types/database'
import PlanEntry from './PlanEntry'

const TEXT_MUTED = '#8a7a60'

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'BREAKFAST',
  lunch: 'LUNCH',
  dinner: 'DINNER',
  snack: 'SNACKS',
}

export interface PlanSlotProps {
  slot: MealSlot
  entries: MealPlanEntry[]
  /** Map from source_id → display name (joined recipes + products). */
  nameMap: Map<string, string>
  /** True when this is the dinner slot on the plan's cook day. */
  isCookDayDinner: boolean
}

/**
 * One slot inside a day card: header + entry list.
 *
 * When the slot is the cook-day dinner, the entry list (NOT the header)
 * gets a subtle gold background tint. Per design feedback: tint, not
 * outline — the warmth signals "this is the cook moment" without
 * drawing a hard rectangle.
 *
 * Empty slots render nothing — caller decides whether to skip them.
 */
export default function PlanSlot({
  slot,
  entries,
  nameMap,
  isCookDayDinner,
}: PlanSlotProps) {
  if (entries.length === 0) return null

  // All styles inline to avoid any Tailwind compile / class-scan
  // gotchas around conditional class strings.
  const listStyle: CSSProperties = isCookDayDinner
    ? {
        background: 'rgba(201,160,60,0.06)',
        borderRadius: '0.75rem',
        padding: '0.75rem',
      }
    : {}

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div
        className="text-[10px] uppercase tracking-wider"
        style={{ color: TEXT_MUTED, marginBottom: '0.25rem' }}
      >
        {SLOT_LABELS[slot]}
      </div>
      <div style={listStyle}>
        {entries.map((entry) => (
          <PlanEntry
            key={entry.id}
            entry={entry}
            name={nameMap.get(entry.source_id) ?? ''}
          />
        ))}
      </div>
    </div>
  )
}
