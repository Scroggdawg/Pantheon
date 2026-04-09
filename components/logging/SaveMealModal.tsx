'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FoodItem } from '@/types/database'

interface Props {
  userId: string
  foods: FoodItem[]
  defaultName?: string
  onSaved: () => void
  onClose: () => void
}

export function SaveMealModal({ userId, foods, defaultName, onSaved, onClose }: Props) {
  const [name, setName] = useState(defaultName || '')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const supabase = createClient()

  const totals = foods.reduce(
    (acc, f) => ({
      calories: acc.calories + f.calories,
      protein: acc.protein + f.protein_g,
      carbs: acc.carbs + f.carbs_g,
      fat: acc.fat + f.fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  async function performInsert() {
    setSaving(true)
    setSaveError(null)

    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    try {
      const { error } = await supabase.from('saved_meals').insert({
        user_id: userId,
        name: name.trim(),
        foods_json: foods,
        total_calories: totals.calories,
        total_protein_g: totals.protein,
        total_carbs_g: totals.carbs,
        total_fat_g: totals.fat,
        tags: tagList,
        is_staple: false,
      })

      if (error) {
        setSaveError('Failed to save meal. Please try again.')
        setSaving(false)
        return
      }

      onSaved()
    } catch {
      setSaveError('Failed to save meal. Please try again.')
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) return
    setDuplicateWarning(null)
    setSaveError(null)

    // Check for duplicate name (fail open — if check fails, proceed with insert)
    try {
      const { data: existing } = await supabase
        .from('saved_meals')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', name.trim())

      if (existing && existing.length > 0) {
        setDuplicateWarning(`A meal named "${name.trim()}" already exists. Save anyway?`)
        return
      }
    } catch {
      console.warn('Duplicate check failed, proceeding with insert')
    }

    await performInsert()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-gray-900 p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Save as Meal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="text-xs text-gray-500">
            {foods.map((f) => f.name).join(', ')} — {totals.calories} cal
          </div>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Meal name (e.g. Post-Gym Shake)"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            autoFocus
          />

          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (optional, comma separated)"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />

          {duplicateWarning ? (
            <div className="space-y-3">
              <p className="text-sm text-amber-300">{duplicateWarning}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDuplicateWarning(null)}
                  className="flex-1 rounded-lg border border-gray-700 py-3 text-sm font-medium hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setDuplicateWarning(null)
                    performInsert()
                  }}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-blue-600 py-3 font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Anyway'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="w-full rounded-lg bg-blue-600 py-3 font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Meal'}
            </button>
          )}

          {saveError && (
            <p className="text-xs text-red-400 text-center">{saveError}</p>
          )}
        </div>
      </div>
    </div>
  )
}
