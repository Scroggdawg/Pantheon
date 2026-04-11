'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [yieldServings, setYieldServings] = useState('1')
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
        yield_servings: Math.max(1, parseInt(yieldServings) || 1),
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

  if (typeof document === 'undefined') return null

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.5)',
    border: '1px solid rgba(201,160,60,0.25)',
    color: '#3d3225',
  }

  const modal = (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center">
      <div
        className="w-full max-w-md rounded-t-2xl p-6 sm:rounded-2xl"
        style={{ background: 'rgba(255,253,249,0.95)', border: '1px solid rgba(201,160,60,0.2)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: '#3d3225' }}>Save as Meal</h2>
          <button type="button" onClick={onClose} className="hover:opacity-70 transition-opacity" style={{ color: '#a47c16' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="text-xs" style={{ color: 'rgba(70,48,12,0.58)' }}>
            {foods.map((f) => f.name).join(', ')} — {totals.calories} cal
          </div>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Meal name (e.g. Post-Gym Shake)"
            className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1"
            style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
            autoFocus
          />

          <div>
            <label className="text-xs mb-1 block" style={{ color: 'rgba(70,48,12,0.58)' }}>Servings this recipe makes</label>
            <input
              type="number"
              value={yieldServings}
              onChange={(e) => setYieldServings(e.target.value)}
              min="1"
              className="w-24 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
              style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
            />
            {parseInt(yieldServings) > 1 && (
              <span className="text-xs ml-3" style={{ color: 'rgba(70,48,12,0.5)' }}>
                {Math.round(totals.calories / (parseInt(yieldServings) || 1))} cal/serving
              </span>
            )}
          </div>

          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (optional, comma separated)"
            className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1"
            style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
          />

          {duplicateWarning ? (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: '#a47c16' }}>{duplicateWarning}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="flex-1 rounded-lg py-3 text-sm font-medium hover:opacity-80 transition-opacity"
                  style={{ border: '1px solid rgba(201,160,60,0.3)', color: '#5a4a32' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDuplicateWarning(null)
                    performInsert()
                  }}
                  disabled={saving}
                  className="flex-1 rounded-lg py-3 font-medium disabled:opacity-50 hover:opacity-80 transition-opacity"
                  style={{ background: 'linear-gradient(145deg, #c9a03c, #a47c16)', color: '#fff' }}
                >
                  {saving ? 'Saving...' : 'Save Anyway'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="w-full rounded-lg py-3 font-medium disabled:opacity-50 hover:opacity-80 transition-opacity"
              style={{ background: 'linear-gradient(145deg, #c9a03c, #a47c16)', color: '#fff' }}
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

  return createPortal(modal, document.body)
}
