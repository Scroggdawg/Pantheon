'use client'

import { useState } from 'react'
import { SaveMealModal } from '@/components/logging/SaveMealModal'
import { isFavoriteFood, favoriteFoodKey, type Favorites, emptyFavorites } from '@/lib/favorites'
import type { FoodLogEntry, FoodItem } from '@/types/database'

interface TodayLogProps {
  userId: string
  entries: FoodLogEntry[]
  favorites?: Favorites
  onEdit: (entry: FoodLogEntry, focusFoodIndex?: number) => void
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

function selectKey(entryId: string, foodIndex: number): string {
  return `${entryId}:${foodIndex}`
}

export default function TodayLog({ userId, entries, favorites, onEdit, onUpdate }: TodayLogProps) {
  const favs = favorites ?? emptyFavorites()
  const [selectMode, setSelectMode] = useState(false)
  const [selectedFoodKeys, setSelectedFoodKeys] = useState<Set<string>>(new Set())
  const [showSaveMeal, setShowSaveMeal] = useState(false)
  // Optimistic heart-toggle overrides keyed by favoriteFoodKey(name, source_ref).
  // Cleared (implicitly) on next refetch via onUpdate; we don't bother
  // pruning entries that the server has caught up on.
  const [optimisticFavs, setOptimisticFavs] = useState<Map<string, boolean>>(new Map())
  // Per-food disabled-during-flight state to prevent double-tap stacks.
  const [pendingHearts, setPendingHearts] = useState<Set<string>>(new Set())

  function toggleSelect(key: string) {
    setSelectedFoodKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function getSelectedFoods(): FoodItem[] {
    const collected: FoodItem[] = []
    for (const entry of entries) {
      for (let i = 0; i < entry.foods_json.length; i++) {
        if (selectedFoodKeys.has(selectKey(entry.id, i))) {
          collected.push(entry.foods_json[i])
        }
      }
    }
    return collected
  }

  function isHearted(food: FoodItem): boolean {
    const key = favoriteFoodKey(food.name, food.source_ref)
    if (optimisticFavs.has(key)) return optimisticFavs.get(key)!
    return isFavoriteFood(food, favs)
  }

  async function handleHeartTap(entry: FoodLogEntry, foodIndex: number, food: FoodItem) {
    const key = favoriteFoodKey(food.name, food.source_ref)
    if (pendingHearts.has(key)) return
    const wasHearted = isHearted(food)
    setOptimisticFavs((prev) => new Map(prev).set(key, !wasHearted))
    setPendingHearts((prev) => new Set(prev).add(key))
    try {
      const res = await fetch('/api/saved_meals/heart', {
        method: wasHearted ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          food_log_entry_id: entry.id,
          food_index: foodIndex,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || `heart API failed (status ${res.status})`)
      }
      onUpdate()
    } catch (err) {
      // Revert optimistic
      setOptimisticFavs((prev) => {
        const next = new Map(prev)
        next.delete(key)
        return next
      })
      const msg = err instanceof Error ? err.message : 'unknown error'
      alert(`Failed to ${wasHearted ? 'unfavorite' : 'favorite'} ${food.name}: ${msg}`)
    } finally {
      setPendingHearts((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
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
        {selectMode && selectedFoodKeys.size > 0 && (
          <button
            type="button"
            onClick={() => setShowSaveMeal(true)}
            className="text-[11px] uppercase tracking-wider font-semibold"
            style={{ color: '#c9a03c' }}
          >
            Save as Meal ({selectedFoodKeys.size})
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setSelectMode((p) => !p)
            setSelectedFoodKeys(new Set())
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
            <h3
              className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2"
              style={{ color: '#7a6a52' }}
            >
              {capitalize(mealLabel)}
            </h3>
            <div className="space-y-1">
              {mealEntries.flatMap((entry) =>
                entry.foods_json.map((food, foodIndex) => {
                  const key = selectKey(entry.id, foodIndex)
                  const hearted = isHearted(food)
                  const heartKey = favoriteFoodKey(food.name, food.source_ref)
                  const heartPending = pendingHearts.has(heartKey)
                  return (
                    <div key={key} className="flex items-center gap-2">
                      {selectMode && (
                        <input
                          type="checkbox"
                          checked={selectedFoodKeys.has(key)}
                          onChange={() => toggleSelect(key)}
                          className="shrink-0 accent-blue-500"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          selectMode ? toggleSelect(key) : onEdit(entry, foodIndex)
                        }
                        className="food-row-hover flex items-center justify-between gap-3 flex-1 text-left min-w-0 py-1 border-b last:border-0 rounded-md px-2 -mx-2 cursor-pointer transition-colors"
                        style={{ borderColor: 'rgba(180,160,120,0.12)' }}
                      >
                        <div className="flex flex-col flex-1 min-w-0">
                          <span
                            className="text-[13px] font-medium truncate"
                            style={{ color: '#3d3225' }}
                          >
                            {food.name}
                          </span>
                          <span
                            className="text-[10px] tracking-wider"
                            style={{ color: '#8a7a60' }}
                          >
                            {Math.round(food.calories)}cal · {Math.round(food.protein_g)}P ·{' '}
                            {Math.round(food.carbs_g)}C · {Math.round(food.fat_g)}F
                          </span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHeartTap(entry, foodIndex, food)}
                        disabled={heartPending}
                        aria-label={`${hearted ? 'Unfavorite' : 'Favorite'} ${food.name}`}
                        className="shrink-0 px-2 py-1 hover:opacity-80 transition-opacity disabled:opacity-50"
                        style={{ color: hearted ? '#c9a03c' : '#b4a080' }}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill={hearted ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      </button>
                    </div>
                  )
                }),
              )}
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
            setSelectedFoodKeys(new Set())
            onUpdate()
          }}
          onClose={() => setShowSaveMeal(false)}
        />
      )}
    </div>
  )
}
