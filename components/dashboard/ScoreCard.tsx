'use client'

import { useState, useEffect } from 'react'
import type { DayType, FoodLogEntry, WorkoutSession, WeightReading } from '@/types/database'
import DailyPlanPanel from './DailyPlanPanel'

interface ScoreResponse {
  score: number
  roman: string
  verdict: string
  recommendation: string
  is_projected: boolean
  components: {
    protein_score: number
    calorie_score: number
    workout_score: number
    trend_score: number | null
    macro_score: number
  }
}

interface ScoreCardProps {
  dayType: DayType
  entries: FoodLogEntry[]
  workouts: WorkoutSession[]
  weightReadings: WeightReading[]
  calorieTarget: number
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
  totals: { calories: number; protein: number; carbs: number; fat: number }
  userId: string
}

const CACHE_KEY = 'pantheon_score_cache'
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function getCached(): (ScoreResponse & { timestamp: number }) | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() - parsed.timestamp < CACHE_TTL) return parsed
    return null
  } catch {
    return null
  }
}

function setCache(data: ScoreResponse) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }))
}

export default function ScoreCard({
  dayType,
  entries,
  workouts,
  weightReadings,
  calorieTarget,
  proteinTarget,
  carbsTarget,
  fatTarget,
  totals,
  userId,
}: ScoreCardProps) {
  const [score, setScore] = useState<ScoreResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPlan, setShowPlan] = useState(false)

  // Check cache on mount
  useEffect(() => {
    const cached = getCached()
    if (cached) setScore(cached)
  }, [])

  async function calculateScore(bypassCache = false) {
    if (!bypassCache) {
      const cached = getCached()
      if (cached) {
        setScore(cached)
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/claude/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_type: dayType,
          current_time_iso: new Date().toISOString(),
          entries,
          workouts,
          weight_readings: weightReadings,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Score calculation failed')
      }

      const data: ScoreResponse = await res.json()
      setScore(data)
      setCache(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate score')
    } finally {
      setLoading(false)
    }
  }

  const remainingCal = calorieTarget - totals.calories
  const remainingProtein = Math.round(proteinTarget - totals.protein)
  const remainingCarbs = Math.round(carbsTarget - totals.carbs)
  const remainingFat = Math.round(fatTarget - totals.fat)

  return (
    <>
      <div className="rounded-2xl bg-gray-900 p-5">
        <h2 className="text-base font-semibold mb-3">Greek God Bod Score</h2>

        {score ? (
          <div className="space-y-3">
            {/* Roman numeral display */}
            <div className="text-center">
              <p className="text-5xl font-bold tracking-wider text-amber-400" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {score.roman}
              </p>
              <p className="text-xs text-gray-500 mt-1">{score.score.toFixed(1)} / 10</p>
            </div>

            {/* Verdict */}
            <p className="text-sm text-gray-200">{score.verdict}</p>

            {/* Recommendation */}
            {score.recommendation && (
              <p className="text-sm text-gray-400">{score.recommendation}</p>
            )}

            {/* Remaining macros summary */}
            <div className="rounded-lg bg-gray-800/50 px-3 py-2">
              <p className="text-xs text-gray-500">
                Remaining: {remainingCal} cal / {remainingProtein}g protein / {remainingCarbs}g carbs / {remainingFat}g fat
              </p>
            </div>

            {/* Component breakdown */}
            <div className="grid grid-cols-5 gap-1 text-center">
              {[
                { label: 'Protein', value: score.components.protein_score },
                { label: 'Calories', value: score.components.calorie_score },
                { label: 'Workout', value: score.components.workout_score },
                { label: 'Trend', value: score.components.trend_score },
                { label: 'Macros', value: score.components.macro_score },
              ].map((c) => (
                <div key={c.label}>
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className="text-sm font-medium text-gray-300">
                    {c.value != null ? c.value.toFixed(1) : '—'}
                  </p>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => calculateScore(true)}
                disabled={loading}
                className="flex-1 rounded-lg border border-gray-700 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? 'Calculating...' : 'Recalculate'}
              </button>
              <button
                onClick={() => setShowPlan(true)}
                className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-medium hover:bg-amber-700"
              >
                See Plan
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400 text-center">
              Calculate your daily score based on nutrition, workouts, and weight trend.
            </p>
            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}
            <button
              onClick={() => calculateScore()}
              disabled={loading}
              className="w-full rounded-lg bg-amber-600 py-3 font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                  Calculating...
                </span>
              ) : (
                'Calculate Score'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Daily Plan Panel */}
      {showPlan && (
        <DailyPlanPanel
          dayType={dayType}
          entries={entries}
          workouts={workouts}
          userId={userId}
          calorieTarget={calorieTarget}
          proteinTarget={proteinTarget}
          carbsTarget={carbsTarget}
          fatTarget={fatTarget}
          totals={totals}
          onClose={() => setShowPlan(false)}
        />
      )}
    </>
  )
}
