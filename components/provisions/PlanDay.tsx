import type { MealPlanEntry, MealSlot } from '@/types/database'
import PlanSlot from './PlanSlot'
import { formatDayHeader } from './formatHelpers'

const GOLD_LIGHT = '#c9a03c'
const TEXT_DARK = '#3d3225'

const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

export interface PlanDayProps {
  /** YYYY-MM-DD calendar date for this day. */
  date: string
  /** All entries belonging to this date, any slot, any source type. */
  entries: MealPlanEntry[]
  /** Map from source_id → display name (joined recipes + products). */
  nameMap: Map<string, string>
  /** Cook day for the plan; null if no cook day signal. */
  cookDate: string | null
}

/**
 * One day card. Surface matches the recipe library card pattern
 * (rounded-xl, translucent fill, hairline gold border at low opacity)
 * — opacity-based contrast rather than a heavier outline.
 *
 * Header is uppercase tracked text matching the dashboard hierarchy
 * ('MON · APR 27'). When this date is the cook day, an inline COOK DAY
 * chip sits next to the header.
 */
export default function PlanDay({
  date,
  entries,
  nameMap,
  cookDate,
}: PlanDayProps) {
  const isCookDay = cookDate !== null && cookDate === date
  const grouped: Record<MealSlot, MealPlanEntry[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  }
  for (const entry of entries) grouped[entry.slot].push(entry)

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'rgba(255,253,249,0.55)',
        border: '1px solid rgba(201,160,60,0.18)',
        color: TEXT_DARK,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-[11px] uppercase tracking-[0.15em] font-semibold"
          style={{ color: TEXT_DARK }}
        >
          {formatDayHeader(date)}
        </span>
        {isCookDay && (
          <span
            className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5"
            style={{
              background: 'rgba(201,160,60,0.18)',
              color: GOLD_LIGHT,
            }}
          >
            COOK DAY
          </span>
        )}
      </div>
      {SLOT_ORDER.map((slot) => (
        <PlanSlot
          key={slot}
          slot={slot}
          entries={grouped[slot]}
          nameMap={nameMap}
          isCookDayDinner={isCookDay && slot === 'dinner'}
        />
      ))}
    </div>
  )
}
