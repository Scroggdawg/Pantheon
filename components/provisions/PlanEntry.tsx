import type { MealPlanEntry } from '@/types/database'
import { formatServings } from './formatHelpers'

const TEXT_DARK = '#3d3225'
const TEXT_MUTED = '#8a7a60'

export interface PlanEntryProps {
  entry: MealPlanEntry
  /** Display name resolved from recipes / products by source_id. */
  name: string
}

/**
 * One line of a meal plan: '{servings} × {name}'.
 *
 * Recipe entries render in italics (no color shift, no weight change,
 * no icon) — the visual convention is "italic = something you cook".
 * Product entries render plain.
 *
 * If a name fails to resolve (orphaned source_id), falls back to a
 * muted '— missing —' so the line still aligns with the rest of the
 * slot.
 */
export default function PlanEntry({ entry, name }: PlanEntryProps) {
  const servings = formatServings(Number(entry.servings))
  const isRecipe = entry.source_type === 'recipe'
  const resolved = name.trim().length > 0
  const displayName = resolved ? name : '\u2014 missing \u2014'

  return (
    <div className="text-sm" style={{ color: resolved ? TEXT_DARK : TEXT_MUTED }}>
      <span>{servings}</span>
      <span style={{ color: TEXT_MUTED }}> {'\u00D7'} </span>
      <span style={{ fontStyle: isRecipe ? 'italic' : 'normal' }}>{displayName}</span>
    </div>
  )
}
