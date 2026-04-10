'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SavedMealEditModal } from '@/components/logging/SavedMealEditModal'
import type { SavedMeal, DayType, FoodItem } from '@/types/database'

interface Props {
  userId: string
  dayType: DayType
  onComplete: () => void
  onClose: () => void
}

function scaleFoods(foods: FoodItem[], ratio: number): FoodItem[] {
  return foods.map((f) => ({
    ...f,
    qty: Math.round(f.qty * ratio * 10) / 10,
    calories: Math.round(f.calories * ratio),
    protein_g: Math.round(f.protein_g * ratio * 10) / 10,
    carbs_g: Math.round(f.carbs_g * ratio * 10) / 10,
    fat_g: Math.round(f.fat_g * ratio * 10) / 10,
  }))
}

export function QuickSelectModal({ userId, dayType, onComplete, onClose }: Props) {
  const [meals, setMeals] = useState<SavedMeal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingMeal, setEditingMeal] = useState<SavedMeal | null>(null)
  const [selectedMeal, setSelectedMeal] = useState<SavedMeal | null>(null)
  const [servings, setServings] = useState('1')
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

  function selectMeal(meal: SavedMeal) {
    setSelectedMeal(meal)
    setServings('1')
  }

  async function logMeal() {
    if (!selectedMeal) return
    setSaving(true)

    const yieldSrv = selectedMeal.yield_servings || 1
    const numServings = parseFloat(servings) || 1
    const ratio = numServings / yieldSrv
    const portionFoods = scaleFoods(selectedMeal.foods_json, ratio)

    const { error } = await supabase.from('food_log_entries').insert({
      user_id: userId,
      meal_label: selectedMeal.tags?.[0] || 'snack',
      day_type: dayType,
      foods_json: portionFoods,
      total_calories: Math.round(selectedMeal.total_calories * ratio),
      total_protein_g: Math.round(selectedMeal.total_protein_g * ratio * 10) / 10,
      total_carbs_g: Math.round(selectedMeal.total_carbs_g * ratio * 10) / 10,
      total_fat_g: Math.round(selectedMeal.total_fat_g * ratio * 10) / 10,
      log_method: 'quick',
    })

    if (!error) {
      await supabase
        .from('saved_meals')
        .update({
          times_logged: (selectedMeal.times_logged || 0) + 1,
          last_logged_at: new Date().toISOString(),
        })
        .eq('id', selectedMeal.id)

      onComplete()
    }

    setSaving(false)
  }

  // Serving confirmation view
  if (selectedMeal) {
    const yieldSrv = selectedMeal.yield_servings || 1
    const numServings = parseFloat(servings) || 1
    const ratio = numServings / yieldSrv
    const portionCal = Math.round(selectedMeal.total_calories * ratio)
    const portionP = Math.round(selectedMeal.total_protein_g * ratio)
    const portionC = Math.round(selectedMeal.total_carbs_g * ratio)
    const portionF = Math.round(selectedMeal.total_fat_g * ratio)

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
        <div className="w-full max-w-lg rounded-t-2xl bg-gray-900 p-6 sm:rounded-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{selectedMeal.name}</h2>
            <button type="button" onClick={() => setSelectedMeal(null)} className="text-gray-400 hover:text-white">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="text-xs text-gray-500 mb-4">
            {selectedMeal.foods_json.map((f) => f.name).join(', ')}
            {yieldSrv > 1 && <span> — recipe makes {yieldSrv} servings</span>}
          </div>

          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">How many servings?</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                min="0.25"
                step="0.25"
                className="w-24 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
              />
              <span className="text-sm text-gray-400">
                {portionCal} cal · {portionP}P · {portionC}C · {portionF}F
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setSelectedMeal(null)}
              className="rounded-lg border border-gray-700 px-4 py-3 text-sm font-medium text-gray-400 hover:bg-gray-800"
            >
              Back
            </button>
            <button
              type="button"
              onClick={logMeal}
              disabled={saving || !parseFloat(servings)}
              className="flex-1 rounded-lg bg-blue-600 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Logging...' : 'Log'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="w-full max-w-lg rounded-t-2xl bg-gray-900 p-6 sm:rounded-2xl max-h-[80vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Quick Log</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
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
            {meals.map((meal) => {
              const yieldSrv = meal.yield_servings || 1
              const perServingCal = yieldSrv > 1 ? Math.round(meal.total_calories / yieldSrv) : meal.total_calories
              const perServingP = yieldSrv > 1 ? Math.round(meal.total_protein_g / yieldSrv) : meal.total_protein_g
              const perServingC = yieldSrv > 1 ? Math.round(meal.total_carbs_g / yieldSrv) : meal.total_carbs_g
              const perServingF = yieldSrv > 1 ? Math.round(meal.total_fat_g / yieldSrv) : meal.total_fat_g

              return (
                <div key={meal.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectMeal(meal)}
                    disabled={saving}
                    className="flex-1 rounded-xl bg-gray-800 p-4 text-left hover:bg-gray-700 disabled:opacity-50 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{meal.name}</div>
                      <div className="text-sm text-gray-400">
                        {perServingCal} cal{yieldSrv > 1 && '/srv'}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {perServingP}P · {perServingC}C · {perServingF}F
                      {yieldSrv > 1 && <span className="ml-1">per serving ({yieldSrv} srv)</span>}
                      {meal.is_staple && (
                        <span className="ml-2 rounded bg-blue-900/50 px-1.5 py-0.5 text-blue-300">
                          staple
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
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
              )
            })}
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
