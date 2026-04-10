'use client'

import { useState, useRef } from 'react'
import { SaveMealModal } from '@/components/logging/SaveMealModal'
import type { DayType, FoodLogEntry, FoodItem, WorkoutSession } from '@/types/database'

interface PlanMeal {
  name: string
  description: string
  portions: string
  macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  prep_minutes: number
  cuisine: string
  from_saved: boolean
  saveable: boolean
  foods_json: FoodItem[]
}

interface PlanResponse {
  meals: PlanMeal[]
  projected_score_if_followed: string | null
  low_cal_message: string | null
}

interface DailyPlanPanelProps {
  dayType: DayType
  entries: FoodLogEntry[]
  workouts: WorkoutSession[]
  userId: string
  calorieTarget: number
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
  totals: { calories: number; protein: number; carbs: number; fat: number }
  onClose: () => void
}

export default function DailyPlanPanel({
  dayType,
  entries,
  workouts,
  userId,
  calorieTarget,
  proteinTarget,
  carbsTarget,
  fatTarget,
  totals,
  onClose,
}: DailyPlanPanelProps) {
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingMealIdx, setSavingMealIdx] = useState<number | null>(null)
  const [rerollDisabled, setRerollDisabled] = useState(false)
  const [showPrevious, setShowPrevious] = useState(false)
  const previousPlanRef = useRef<PlanResponse | null>(null)

  async function fetchPlan() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/claude/daily-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_type: dayType,
          current_time_iso: new Date().toISOString(),
          entries,
          workouts,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Plan generation failed')
      }

      const data: PlanResponse = await res.json()
      setPlan(data)
    } catch (err) {
      // Restore previous plan on failure
      if (previousPlanRef.current) {
        setPlan(previousPlanRef.current)
        setError('Could not generate new plan — showing previous plan.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to generate plan')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleReroll() {
    if (rerollDisabled) return
    // Store current plan before re-rolling
    if (plan) {
      previousPlanRef.current = plan
      setShowPrevious(true)
      setTimeout(() => setShowPrevious(false), 60000)
    }
    setPlan(null)
    setRerollDisabled(true)
    setTimeout(() => setRerollDisabled(false), 2000)
    fetchPlan()
  }

  // Auto-fetch on mount
  useState(() => { fetchPlan() })

  const remainingCal = calorieTarget - totals.calories
  const remainingProtein = Math.round(proteinTarget - totals.protein)
  const remainingCarbs = Math.round(carbsTarget - totals.carbs)
  const remainingFat = Math.round(fatTarget - totals.fat)

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl bg-gray-900 p-6 sm:rounded-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Daily Plan</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Remaining macros */}
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 mb-4">
          <p className="text-xs text-gray-500">
            Remaining today: {remainingCal} cal / {remainingProtein}g P / {remainingCarbs}g C / {remainingFat}g F
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{error}</div>
        )}

        {loading && !plan && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-amber-500" />
            <p className="text-xs text-gray-500">Generating your plan...</p>
          </div>
        )}

        {plan && (
          <div className="space-y-4">
            {/* Low calorie message */}
            {plan.low_cal_message && (
              <div className="rounded-lg bg-amber-900/30 p-3 text-sm text-amber-300">
                {plan.low_cal_message}
              </div>
            )}

            {/* Meals */}
            {plan.meals.map((meal, idx) => (
              <div key={idx} className="rounded-lg bg-gray-800 p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{meal.name}</p>
                    <p className="text-xs text-gray-400">{meal.description}</p>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0 ml-2">{meal.prep_minutes} min</span>
                </div>

                <p className="text-xs text-gray-300">{meal.portions}</p>

                <div className="flex gap-3 text-xs text-gray-500">
                  <span>{meal.macros.calories} cal</span>
                  <span>{meal.macros.protein_g}g P</span>
                  <span>{meal.macros.carbs_g}g C</span>
                  <span>{meal.macros.fat_g}g F</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">
                    {meal.from_saved ? 'From saved meals' : meal.cuisine}
                  </span>
                  {meal.saveable && (
                    <button
                      onClick={() => setSavingMealIdx(idx)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Save Meal
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Projected score */}
            {plan.projected_score_if_followed && (
              <p className="text-sm text-amber-400 text-center font-medium">
                {plan.projected_score_if_followed}
              </p>
            )}

            {/* Previous plan (muted, shown after re-roll) */}
            {showPrevious && previousPlanRef.current && (
              <div className="opacity-40 space-y-2 border-t border-gray-800 pt-3">
                <p className="text-xs text-gray-500">Previous plan:</p>
                {previousPlanRef.current.meals.map((meal, idx) => (
                  <p key={idx} className="text-xs text-gray-600">
                    {meal.name} — {meal.macros.calories} cal
                  </p>
                ))}
              </div>
            )}

            {/* Re-roll button */}
            <button
              onClick={handleReroll}
              disabled={loading || rerollDisabled}
              className="w-full rounded-lg border border-gray-700 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Re-roll Plan'}
            </button>
          </div>
        )}
      </div>

      {/* Save Meal Modal */}
      {savingMealIdx !== null && plan && plan.meals[savingMealIdx] && (
        <SaveMealModal
          userId={userId}
          foods={plan.meals[savingMealIdx].foods_json}
          defaultName={plan.meals[savingMealIdx].name}
          onSaved={() => setSavingMealIdx(null)}
          onClose={() => setSavingMealIdx(null)}
        />
      )}
    </div>
  )
}
