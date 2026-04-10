'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SavedMeal } from '@/types/database'

interface Props {
  meal: SavedMeal
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export function SavedMealEditModal({ meal, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(meal.name)
  const [yieldServings, setYieldServings] = useState(String(meal.yield_servings || 1))
  const [tags, setTags] = useState(meal.tags?.join(', ') ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleSave() {
    if (!name.trim()) return
    setIsSaving(true)
    setError(null)

    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    try {
      const { error: updateErr } = await supabase
        .from('saved_meals')
        .update({ name: name.trim(), yield_servings: Math.max(1, parseInt(yieldServings) || 1), tags: tagList })
        .eq('id', meal.id)

      if (updateErr) {
        setError('Failed to save. Try again.')
        setIsSaving(false)
        return
      }

      onSaved()
    } catch {
      setError('Failed to save. Try again.')
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      const { error: deleteErr } = await supabase
        .from('saved_meals')
        .delete()
        .eq('id', meal.id)

      if (deleteErr) {
        setError('Failed to delete. Try again.')
        setIsDeleting(false)
        setDeleteConfirm(false)
        return
      }

      onDeleted()
    } catch {
      setError('Failed to delete. Try again.')
      setIsDeleting(false)
      setDeleteConfirm(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-gray-900 p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit Meal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Foods list (read-only) */}
          <div className="text-xs text-gray-500">
            {meal.foods_json.map((f) => f.name).join(', ')} — {meal.total_calories} cal total
            {(meal.yield_servings || 1) > 1 && (
              <span className="ml-1">
                ({Math.round(meal.total_calories / (meal.yield_servings || 1))} cal/serving)
              </span>
            )}
          </div>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Meal name"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            autoFocus
          />

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Servings this recipe makes</label>
            <input
              type="number"
              value={yieldServings}
              onChange={(e) => setYieldServings(e.target.value)}
              min="1"
              className="w-24 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
            />
            {parseInt(yieldServings) > 1 && (
              <span className="text-xs text-gray-500 ml-3">
                {Math.round(meal.total_calories / (parseInt(yieldServings) || 1))} cal/serving ·{' '}
                {Math.round(meal.total_protein_g / (parseInt(yieldServings) || 1))}P ·{' '}
                {Math.round(meal.total_carbs_g / (parseInt(yieldServings) || 1))}C ·{' '}
                {Math.round(meal.total_fat_g / (parseInt(yieldServings) || 1))}F
              </span>
            )}
          </div>

          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (optional, comma separated)"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />

          <div className="flex gap-3">
            {!deleteConfirm ? (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg border border-red-900 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-900/30 disabled:opacity-50"
              >
                Delete
              </button>
            ) : (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg bg-red-700 px-4 py-3 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm delete'}
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={!name.trim() || isSaving}
              className="flex-1 rounded-lg bg-blue-600 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
