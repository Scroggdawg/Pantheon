'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FoodLogEntry, FoodItem } from '@/types/database'

interface FoodEntryEditModalProps {
  entry: FoodLogEntry
  onSaved: () => void
  onDeleted: () => void
  onClose: () => void
}

function toTimeInputValue(dateStr: string): string {
  const date = new Date(dateStr)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function FoodEntryEditModal({
  entry,
  onSaved,
  onDeleted,
  onClose,
}: FoodEntryEditModalProps) {
  const [editFoods, setEditFoods] = useState<FoodItem[]>(
    entry.foods_json.map((f) => ({ ...f }))
  )
  const [editTime, setEditTime] = useState(toTimeInputValue(entry.logged_at))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  function removeFood(index: number) {
    const remaining = editFoods.filter((_, i) => i !== index)
    if (remaining.length === 0) {
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

    const original = new Date(entry.logged_at)
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
      .eq('id', entry.id)

    setSaving(false)
    onSaved()
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('food_log_entries').delete().eq('id', entry.id)
    setDeleting(false)
    onDeleted()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl bg-gray-900 p-6 sm:rounded-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit Entry</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
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
                type="button"
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
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-red-900 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-900/30"
            >
              Delete
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-red-700 px-4 py-3 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Confirm delete'}
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-blue-600 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
