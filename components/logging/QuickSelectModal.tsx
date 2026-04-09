'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SavedMealEditModal } from '@/components/logging/SavedMealEditModal'
import type { SavedMeal, DayType } from '@/types/database'

interface Props {
  userId: string
  dayType: DayType
  onComplete: () => void
  onClose: () => void
}

export function QuickSelectModal({ userId, dayType, onComplete, onClose }: Props) {
  const [meals, setMeals] = useState<SavedMeal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingMeal, setEditingMeal] = useState<SavedMeal | null>(null)
  const supabase = createClient()

  async function refreshMeals() {
    const { data } = await supabase
      .from('saved_meals')
      .select('*')
      .eq('user_id', userId)
      .order('is_staple', { ascending: false })
      .order('times_logged', { ascending: false })

    setMeals(data || [])
    setLoading(false)
  }

  useEffect(() => {
    async function fetchMeals() {
      const { data } = await supabase
        .from('saved_meals')
        .select('*')
        .eq('user_id', userId)
        .order('is_staple', { ascending: false })
        .order('times_logged', { ascending: false })

      setMeals(data || [])
      setLoading(false)
    }
    fetchMeals()
  }, [userId, supabase])

  async function logMeal(meal: SavedMeal) {
    setSaving(true)

    const { error } = await supabase.from('food_log_entries').insert({
      user_id: userId,
      meal_label: meal.tags?.[0] || 'snack',
      day_type: dayType,
      foods_json: meal.foods_json,
      total_calories: meal.total_calories,
      total_protein_g: meal.total_protein_g,
      total_carbs_g: meal.total_carbs_g,
      total_fat_g: meal.total_fat_g,
      log_method: 'quick',
    })

    if (!error) {
      // Bump times_logged
      await supabase
        .from('saved_meals')
        .update({
          times_logged: (meal.times_logged || 0) + 1,
          last_logged_at: new Date().toISOString(),
        })
        .eq('id', meal.id)

      onComplete()
    }

    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="w-full max-w-lg rounded-t-2xl bg-gray-900 p-6 sm:rounded-2xl max-h-[80vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Quick Log</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-400">Loading meals...</div>
        ) : meals.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            No saved meals yet. Log meals via voice to build your library.
          </div>
        ) : (
          <div className="space-y-2">
            {meals.map((meal) => (
              <div key={meal.id} className="flex items-center gap-2">
                <button
                  onClick={() => logMeal(meal)}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-gray-800 p-4 text-left hover:bg-gray-700 disabled:opacity-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{meal.name}</div>
                    <div className="text-sm text-gray-400">{meal.total_calories} cal</div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {meal.total_protein_g}P · {meal.total_carbs_g}C · {meal.total_fat_g}F
                    {meal.is_staple && (
                      <span className="ml-2 rounded bg-blue-900/50 px-1.5 py-0.5 text-blue-300">
                        staple
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingMeal(meal)
                  }}
                  className="shrink-0 rounded-lg p-2 text-gray-500 hover:text-white hover:bg-gray-800 transition"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingMeal && (
        <SavedMealEditModal
          meal={editingMeal}
          onClose={() => setEditingMeal(null)}
          onSaved={() => { setEditingMeal(null); refreshMeals() }}
          onDeleted={() => { setEditingMeal(null); refreshMeals() }}
        />
      )}
    </div>
  )
}
