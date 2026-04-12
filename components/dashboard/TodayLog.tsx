'use client'

import { useState } from 'react'
import { SaveMealModal } from '@/components/logging/SaveMealModal'
import type { FoodLogEntry, FoodItem } from '@/types/database'

interface TodayLogProps {
  userId: string
  entries: FoodLogEntry[]
  onEdit: (entry: FoodLogEntry) => void
  onUpdate: () => void
}

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack']

function groupByMeal(entries: FoodLogEntry[]): Map<string, FoodLogEntry[]> {
  const groups = new Map<string, FoodLogEntry[]>()

  for (const label of MEAL_ORDER) {
    const matching = entries.filter(
      (e) => (e.meal_label ?? 'snack').toLowerCase() === label
    )
    if (matching.length > 0) {
      groups.set(label, matching)
    }
  }

  const knownLabels = new Set(MEAL_ORDER)
  for (const entry of entries) {
    const label = (entry.meal_label ?? 'snack').toLowerCase()
    if (!knownLabels.has(label)) {
      const existing = groups.get(label) ?? []
      existing.push(entry)
      groups.set(label, existing)
    }
  }

  return groups
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function TodayLog({ userId, entries, onEdit, onUpdate }: TodayLogProps) {
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showSaveMeal, setShowSaveMeal] = useState(false)

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function getSelectedFoods(): FoodItem[] {
    return entries
      .filter((e) => selectedIds.has(e.id))
      .flatMap((e) => e.foods_json)
  }

  if (entries.length === 0) {
    return (
      <p className="text-[13px] italic" style={{ color: '#8a7a60' }}>
        Nothing logged yet &mdash; tap Log Food to start
      </p>
    )
  }

  const grouped = groupByMeal(entries)

  return (
    <div>
      {/* Select mode toggle */}
      <div className="flex items-center justify-end mb-3 gap-2">
        {selectMode && selectedIds.size > 0 && (
          <button
            type="button"
            onClick={() => setShowSaveMeal(true)}
            className="text-[11px] uppercase tracking-wider font-semibold"
            style={{ color: '#c9a03c' }}
          >
            Save as Meal ({selectedIds.size})
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setSelectMode((p) => !p)
            setSelectedIds(new Set())
          }}
          className="text-[11px] uppercase tracking-wider"
          style={{ color: '#8a7a60' }}
        >
          {selectMode ? 'Cancel' : 'Select'}
        </button>
      </div>

      <div className="space-y-5">
        {Array.from(grouped.entries()).map(([mealLabel, mealEntries]) => (
          <div key={mealLabel}>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2" style={{ color: '#7a6a52' }}>
              {capitalize(mealLabel)}
            </h3>

            <div className="space-y-2">
              {mealEntries.map((entry) => {
                const foodNames = entry.foods_json
                  .map((f) => f.name)
                  .join(', ')

                return (
                  <div key={entry.id} className="flex items-start gap-2">
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(entry.id)}
                        onChange={() => toggleSelect(entry.id)}
                        className="mt-1 shrink-0 accent-blue-500"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => selectMode ? toggleSelect(entry.id) : onEdit(entry)}
                      className="food-row-hover flex items-center justify-between gap-3 flex-1 text-left min-w-0 py-1.5 border-b last:border-0 rounded-md px-2 -mx-2 cursor-pointer transition-colors"
                      style={{ borderColor: 'rgba(180,160,120,0.12)' }}
                    >
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-[13px] font-medium truncate" style={{ color: '#3d3225' }}>{foodNames}</span>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: '#8a7a60' }}>
                          {capitalize(entry.meal_label || 'snack')} &middot; {formatTime(entry.logged_at)}
                        </span>
                      </div>
                      <span className="text-[14px] font-semibold shrink-0" style={{ color: '#a47c16' }}>
                        {entry.total_calories} cal
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {showSaveMeal && (
        <SaveMealModal
          userId={userId}
          foods={getSelectedFoods()}
          onSaved={() => {
            setShowSaveMeal(false)
            setSelectMode(false)
            setSelectedIds(new Set())
            onUpdate()
          }}
          onClose={() => setShowSaveMeal(false)}
        />
      )}
    </div>
  )
}
