'use client'

import { useState, useEffect, useRef } from 'react'
import GlassPanel from '@/components/ui/GlassPanel'
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
const CACHE_TTL = 30 * 60 * 1000

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

const GOLD = '#a47c16'
const GOLD_LIGHT = '#c9a03c'
const TEXT_DARK = '#3d3225'
const TEXT_LIGHT = '#7a6a52'
const TEXT_MUTED = '#8a7a60'

function GoldDiamond({ size = 'small' }: { size?: 'small' | 'large' }) {
  const px = size === 'small' ? 6 : 10
  return (
    <span
      className="inline-block"
      style={{
        width: px,
        height: px,
        background: 'linear-gradient(135deg, #e8c048 0%, #c9a03c 50%, #a47c16 100%)',
        transform: 'rotate(45deg)',
      }}
    />
  )
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
  const autoFired = useRef(false)

  // Auto-calculate on mount (check cache first)
  useEffect(() => {
    const cached = getCached()
    if (cached) {
      setScore(cached)
      return
    }
    if (!autoFired.current) {
      autoFired.current = true
      fetchScore()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchScore(bypassCache = false) {
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
      <GlassPanel className="p-5 mb-4">
        {score ? (
          <div className="flex items-stretch gap-4">
            {/* Roman numeral */}
            <div className="flex items-center justify-center pr-4" style={{ borderRight: `1px solid rgba(201,160,60,0.2)` }}>
              <span
                className="text-6xl font-bold tracking-wider"
                style={{
                  fontFamily: 'var(--font-cinzel), serif',
                  background: 'linear-gradient(180deg, #6b5520 0%, #9a7a28 30%, #b8923a 50%, #9a7a28 70%, #6b5520 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(1px 2px 1px rgba(40,30,10,0.6)) drop-shadow(-1px -1px 0px rgba(200,180,120,0.25))',
                }}
              >
                {score.roman}
              </span>
            </div>

            {/* Details */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <GoldDiamond size="small" />
                <GoldDiamond size="large" />
                <GoldDiamond size="small" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.15em] font-semibold mb-1" style={{ color: TEXT_LIGHT }}>
                Greek God Bod Score
              </p>
              <p className="text-[14px] font-medium mb-2" style={{ color: TEXT_DARK }}>
                {score.score.toFixed(1)} / 10
              </p>
              <p className="text-[11px] leading-relaxed mb-3" style={{ color: TEXT_MUTED }}>
                {score.verdict}
              </p>

              {/* Remaining */}
              <p className="text-[10px] mb-3" style={{ color: TEXT_MUTED }}>
                Remaining: {remainingCal} cal / {remainingProtein}g P / {remainingCarbs}g C / {remainingFat}g F
              </p>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fetchScore(true)}
                  disabled={loading}
                  className="text-[11px] uppercase tracking-wider font-semibold disabled:opacity-50"
                  style={{ color: GOLD_LIGHT }}
                >
                  {loading ? 'Calculating\u2026' : 'Recalculate'}
                </button>
                <span style={{ color: 'rgba(201,160,60,0.3)' }}>&middot;</span>
                <button
                  type="button"
                  onClick={() => setShowPlan(true)}
                  className="text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1"
                  style={{ color: GOLD_LIGHT }}
                >
                  View Plan <span style={{ fontSize: '14px' }}>&rarr;</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            {error && (
              <p className="text-xs mb-2" style={{ color: '#b45454' }}>{error}</p>
            )}
            {loading ? (
              <div className="flex items-center justify-center gap-2" style={{ color: GOLD }}>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current" style={{ borderTopColor: 'transparent' }} />
                <span className="text-[12px] uppercase tracking-wider font-semibold">Calculating score&hellip;</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fetchScore()}
                className="text-[12px] uppercase tracking-wider font-semibold"
                style={{ color: GOLD }}
              >
                Calculate Score
              </button>
            )}
          </div>
        )}
      </GlassPanel>

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
