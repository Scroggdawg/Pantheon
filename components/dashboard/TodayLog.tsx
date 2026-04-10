'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SaveMealModal } from '@/components/logging/SaveMealModal'
import type { FoodLogEntry, FoodItem } from '@/types/database'

interface TodayLogProps {
  userId: string
  entries: FoodLogEntry[]
  onDelete: (id: string) => void
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

function toTimeInputValue(dateStr: string): string {
  const date = new Date(dateStr)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function TodayLog({ userId, entries, onDelete, onUpdate }: TodayLogProps) {
  const [editingEntry, setEditingEntry] = useState<FoodLogEntry | null>(null)
  const [editFoods, setEditFoods] = useState<FoodItem[]>([])
  const [editTime, setEditTime] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showSaveMeal, setShowSaveMeal] = useState(false)
  const supabase = createClient()

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

  function openEdit(entry: FoodLogEntry) {
    setEditingEntry(entry)
    setEditFoods(entry.foods_json.map((f) => ({ ...f })))
    setEditTime(toTimeInputValue(entry.logged_at))
    setConfirmDelete(false)
  }

  function removeFood(index: number) {
    const remaining = editFoods.filter((_, i) => i !== index)
    if (remaining.length === 0) {
      // Last item — trigger delete confirmation instead of empty array
      setConfirmDelete(true)
      return
    }
    setEditFoods(remaining)
  }

  function updateQty(index: number, newQty: number) {
    setEditFoods((prev) =>
      prev.map((food, i) => {
        if (i !== index) return food
        const ratio = food.qty > 0 ? newQty / food.qty : 1
        return {
          ...food,
          qty: newQty,
          calories: Math.round(food.calories * ratio),
          protein_g: Math.round(food.protein_g * ratio * 10) / 10,
          carbs_g: Math.round(food.carbs_g * ratio * 10) / 10,
          fat_g: Math.round(food.fat_g * ratio * 10) / 10,
        }
      })
    )
  }

  async function handleSave() {
    if (!editingEntry) return
    setSaving(true)

    const totals = editFoods.reduce(
      (acc, f) => ({
        calories: acc.calories + f.calories,
        protein: acc.protein + f.protein_g,
        carbs: acc.carbs + f.carbs_g,
        fat: acc.fat + f.fat_g,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )

    // Build new logged_at from the edited time
    const original = new Date(editingEntry.logged_at)
    const [hours, minutes] = editTime.split(':').map(Number)
    original.setHours(hours, minutes)

    await supabase
      .from('food_log_entries')
      .update({
        foods_json: editFoods,
        total_calories: totals.calories,
        total_protein_g: totals.protein,
        total_carbs_g: totals.carbs,
        total_fat_g: totals.fat,
        logged_at: original.toISOString(),
      })
      .eq('id', editingEntry.id)

    setSaving(false)
    setEditingEntry(null)
    onUpdate()
  }

  async function handleDelete() {
    if (!editingEntry) return
    onDelete(editingEntry.id)
    setEditingEntry(null)
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
            onClick={() => setShowSaveMeal(true)}
            className="text-[11px] uppercase tracking-wider font-semibold"
            style={{ color: '#c9a03c' }}
          >
            Save as Meal ({selectedIds.size})
          </button>
        )}
        <button
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
                      onClick={() => selectMode ? toggleSelect(entry.id) : openEdit(entry)}
                      className="flex items-center justify-between gap-3 flex-1 text-left min-w-0 py-1.5 border-b last:border-0"
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

      {/* Edit Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
          <div className="w-full max-w-lg rounded-t-2xl bg-gray-900 p-6 sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit entry</h2>
              <button onClick={() => setEditingEntry(null)} className="text-gray-400 hover:text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Time picker */}
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">Time</label>
              <input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Foods */}
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {editFoods.map((food, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-gray-800 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{food.name}</div>
                    <div className="text-xs text-gray-400">
                      {food.calories} cal · {food.protein_g}P · {food.carbs_g}C · {food.fat_g}F
                    </div>
                  </div>
                  <input
                    type="number"
                    value={food.qty}
                    onChange={(e) => updateQty(i, Number(e.target.value))}
                    className="w-16 rounded bg-gray-700 px-2 py-1 text-center text-sm"
                    min={0}
                    step={0.5}
                  />
                  <span className="text-xs text-gray-400">{food.unit}</span>
                  <button
                    onClick={() => removeFood(i)}
                    className="text-gray-600 hover:text-red-400 shrink-0 ml-1"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="rounded-lg bg-gray-800/50 p-3 flex justify-between text-sm mb-4">
              <span className="font-medium">
                {editFoods.reduce((s, f) => s + f.calories, 0)} cal
              </span>
              <span className="text-gray-400">
                {editFoods.reduce((s, f) => s + f.protein_g, 0).toFixed(0)}P ·{' '}
                {editFoods.reduce((s, f) => s + f.carbs_g, 0).toFixed(0)}C ·{' '}
                {editFoods.reduce((s, f) => s + f.fat_g, 0).toFixed(0)}F
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-lg border border-red-900 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-900/30"
                >
                  Delete
                </button>
              ) : (
                <button
                  onClick={handleDelete}
                  className="rounded-lg bg-red-700 px-4 py-3 text-sm font-medium text-white hover:bg-red-600"
                >
                  Confirm delete
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-blue-600 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveMeal && (
        <SaveMealModal
          userId={userId}
          foods={getSelectedFoods()}
          onSaved={() => {
            setShowSaveMeal(false)
            setSelectMode(false)
            setSelectedIds(new Set())
          }}
          onClose={() => setShowSaveMeal(false)}
        />
      )}
    </div>
  )
}
