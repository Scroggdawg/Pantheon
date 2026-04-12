'use client'

import { useState, useRef } from 'react'
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

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.5)',
  border: '1px solid rgba(201,160,60,0.25)',
  color: '#3d3225',
}

const labelStyle: React.CSSProperties = { color: 'rgba(70,48,12,0.58)' }

const SCALE_PRESETS = [
  { label: '¼', value: 25 },
  { label: '½', value: 50 },
  { label: '¾', value: 75 },
  { label: 'Full', value: 100 },
]

export default function FoodEntryEditModal({
  entry,
  onSaved,
  onDeleted,
  onClose,
}: FoodEntryEditModalProps) {
  const originalFoods = useRef<FoodItem[]>(entry.foods_json.map((f) => ({ ...f })))
  const [editFoods, setEditFoods] = useState<FoodItem[]>(
    entry.foods_json.map((f) => ({ ...f }))
  )
  const [editTime, setEditTime] = useState(toTimeInputValue(entry.logged_at))
  const [scalePercent, setScalePercent] = useState('100')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  function applyScale(pct: number) {
    const ratio = pct / 100
    setEditFoods(
      originalFoods.current.map((food) => ({
        ...food,
        qty: Math.round(food.qty * ratio * 10) / 10,
        calories: Math.round(food.calories * ratio),
        protein_g: Math.round(food.protein_g * ratio * 10) / 10,
        carbs_g: Math.round(food.carbs_g * ratio * 10) / 10,
        fat_g: Math.round(food.fat_g * ratio * 10) / 10,
      }))
    )
  }

  function handleScaleChange(value: string) {
    setScalePercent(value)
    const pct = parseInt(value)
    if (pct > 0) applyScale(pct)
  }

  function handlePreset(pct: number) {
    setScalePercent(String(pct))
    applyScale(pct)
  }

  function removeFood(index: number) {
    const remaining = editFoods.filter((_, i) => i !== index)
    if (remaining.length === 0) {
      setConfirmDelete(true)
      return
    }
    setEditFoods(remaining)
    originalFoods.current = originalFoods.current.filter((_, i) => i !== index)
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

  const currentPct = parseInt(scalePercent) || 0

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center">
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl p-6 sm:rounded-2xl"
        style={{ background: 'rgba(255,253,249,0.95)', border: '1px solid rgba(201,160,60,0.2)' }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: '#3d3225' }}>Edit Entry</h2>
          <button type="button" onClick={onClose} className="hover:opacity-70 transition-opacity" style={{ color: '#a47c16' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Time picker */}
        <div className="mb-4">
          <label className="text-xs mb-1 block" style={labelStyle}>Time</label>
          <input
            type="time"
            value={editTime}
            onChange={(e) => setEditTime(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
            style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
          />
        </div>

        {/* Scale entire entry */}
        <div className="mb-4 rounded-lg p-3" style={{ background: 'rgba(201,160,60,0.08)', border: '1px solid rgba(201,160,60,0.15)' }}>
          <label className="text-xs mb-2 block font-medium" style={{ color: '#a47c16' }}>Scale entire entry</label>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={scalePercent}
                onChange={(e) => handleScaleChange(e.target.value)}
                min={1}
                max={100}
                className="w-16 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-1"
                style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
              />
              <span className="text-sm" style={{ color: 'rgba(70,48,12,0.5)' }}>%</span>
            </div>
            <div className="flex gap-1.5">
              {SCALE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handlePreset(p.value)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
                  style={
                    currentPct === p.value
                      ? { background: 'linear-gradient(145deg, #c9a03c, #a47c16)', color: '#fff' }
                      : { border: '1px solid rgba(201,160,60,0.3)', color: '#5a4a32' }
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Foods */}
        <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
          {editFoods.map((food, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.35)' }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: '#3d3225' }}>{food.name}</div>
                <div className="text-xs" style={{ color: 'rgba(70,48,12,0.5)' }}>
                  {food.calories} cal · {food.protein_g}P · {food.carbs_g}C · {food.fat_g}F
                </div>
              </div>
              <input
                type="number"
                value={food.qty}
                onChange={(e) => updateQty(i, Number(e.target.value))}
                className="w-16 rounded px-2 py-1 text-center text-sm focus:outline-none focus:ring-1"
                style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
                min={0}
                step={0.5}
              />
              <span className="text-xs" style={{ color: 'rgba(70,48,12,0.5)' }}>{food.unit}</span>
              <button
                type="button"
                onClick={() => removeFood(i)}
                className="shrink-0 ml-1 hover:opacity-70 transition-opacity"
                style={{ color: 'rgba(70,48,12,0.35)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="rounded-lg p-3 flex justify-between text-sm mb-4" style={{ background: 'rgba(201,160,60,0.08)' }}>
          <span className="font-medium" style={{ color: '#3d3225' }}>
            {editFoods.reduce((s, f) => s + f.calories, 0)} cal
          </span>
          <span style={{ color: 'rgba(70,48,12,0.5)' }}>
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
            className="flex-1 rounded-lg py-3 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(145deg, #c9a03c, #a47c16)', color: '#fff' }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
