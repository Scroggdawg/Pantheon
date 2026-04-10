'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

type TimeRange = '7d' | '30d' | '90d' | 'all'

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ProgressPage() {
  const router = useRouter()
  const { user, userId, loading: userLoading } = useUser()
  const [range, setRange] = useState<TimeRange>('30d')

  const [weightData, setWeightData] = useState<{ date: string; weight: number; bodyFat?: number }[]>([])
  const [calorieData, setCalorieData] = useState<{ date: string; calories: number; protein: number; carbs: number; fat: number }[]>([])
  const [workoutData, setWorkoutData] = useState<{ date: string; volume: number; type: string; calBurned: number | null; duration: number | null; distance: number | null; calMethod: string | null }[]>([])
  const [bodyCompData, setBodyCompData] = useState<{ date: string; bodyFat?: number; muscle?: number; water?: number }[]>([])
  const [workoutFilter, setWorkoutFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    if (!userId) return
    setLoading(true)

    const since = range === 'all' ? '2020-01-01' : daysAgo(range === '7d' ? 7 : range === '30d' ? 30 : 90)

    async function fetchAll() {
      const [weights, foodLogs, workouts] = await Promise.all([
        supabase
          .from('weight_readings')
          .select('measured_at, weight_lbs, body_fat_pct, muscle_mass_lbs, water_pct')
          .eq('user_id', userId!)
          .gte('measured_at', since)
          .order('measured_at', { ascending: true }),
        supabase
          .from('food_log_entries')
          .select('logged_at, total_calories, total_protein_g, total_carbs_g, total_fat_g')
          .eq('user_id', userId!)
          .gte('logged_at', since)
          .order('logged_at', { ascending: true }),
        supabase
          .from('workout_sessions')
          .select('trained_at, total_volume_lbs, session_type, duration_min, distance_miles, estimated_cal_burned, cal_estimate_method')
          .eq('user_id', userId!)
          .gte('trained_at', since)
          .order('trained_at', { ascending: true }),
      ])

      // Weight trend
      if (weights.data) {
        const wData = weights.data as { measured_at: string; weight_lbs: number; body_fat_pct: number | null; muscle_mass_lbs: number | null; water_pct: number | null }[]
        setWeightData(
          wData.map((w) => ({
            date: formatDate(w.measured_at),
            weight: Number(w.weight_lbs),
            bodyFat: w.body_fat_pct ? Number(w.body_fat_pct) : undefined,
          }))
        )
        setBodyCompData(
          wData
            .filter((w) => w.body_fat_pct || w.muscle_mass_lbs || w.water_pct)
            .map((w) => ({
              date: formatDate(w.measured_at),
              bodyFat: w.body_fat_pct ? Number(w.body_fat_pct) : undefined,
              muscle: w.muscle_mass_lbs ? Number(w.muscle_mass_lbs) : undefined,
              water: w.water_pct ? Number(w.water_pct) : undefined,
            }))
        )
      }

      // Aggregate food logs by day
      if (foodLogs.data) {
        const fData = foodLogs.data as { logged_at: string; total_calories: number; total_protein_g: number; total_carbs_g: number; total_fat_g: number }[]
        const byDay: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {}
        for (const entry of fData) {
          const day = formatDate(entry.logged_at)
          if (!byDay[day]) byDay[day] = { calories: 0, protein: 0, carbs: 0, fat: 0 }
          byDay[day].calories += entry.total_calories
          byDay[day].protein += entry.total_protein_g
          byDay[day].carbs += entry.total_carbs_g
          byDay[day].fat += entry.total_fat_g
        }
        setCalorieData(
          Object.entries(byDay).map(([date, vals]) => ({
            date,
            calories: Math.round(vals.calories),
            protein: Math.round(vals.protein),
            carbs: Math.round(vals.carbs),
            fat: Math.round(vals.fat),
          }))
        )
      }

      // Workouts
      if (workouts.data) {
        const wkData = workouts.data as { trained_at: string; total_volume_lbs: number | null; session_type: string; duration_min: number | null; distance_miles: number | null; estimated_cal_burned: number | null; cal_estimate_method: string | null }[]
        setWorkoutData(
          wkData.map((w) => ({
            date: formatDate(w.trained_at),
            volume: w.total_volume_lbs || 0,
            type: w.session_type,
            calBurned: w.estimated_cal_burned,
            duration: w.duration_min,
            distance: w.distance_miles ? Number(w.distance_miles) : null,
            calMethod: w.cal_estimate_method,
          }))
        )
      }

      setLoading(false)
    }

    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, range])

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!user) {
    router.push('/onboarding')
    return null
  }

  const tooltipStyle = {
    backgroundColor: '#1f2937',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#f9fafb',
    fontSize: 12,
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-12">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">
              &larr; Dashboard
            </Link>
            <h1 className="text-2xl font-bold mt-1">Progress</h1>
          </div>
          {/* Time range selector */}
          <div className="flex gap-1 rounded-lg bg-gray-900 p-1">
            {(['7d', '30d', '90d', 'all'] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  range === r
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {r === 'all' ? 'All' : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
        </div>
      ) : (
        <div className="space-y-6 px-4">
          {/* 1. Weight Trend */}
          <div className="rounded-2xl bg-gray-900 p-5">
            <h2 className="text-base font-semibold mb-1">Weight Trend</h2>
            <p className="text-xs text-gray-500 mb-4">
              {weightData.length > 0
                ? `${weightData[0].weight} → ${weightData[weightData.length - 1].weight} lbs`
                : 'No data yet'}
            </p>
            {weightData.length > 1 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
                    <YAxis
                      domain={['dataMin - 1', 'dataMax + 1']}
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="weight" stroke="#60a5fa" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8 text-sm">Log weight to see your trend</p>
            )}
          </div>

          {/* 2. Calories & Macros */}
          <div className="rounded-2xl bg-gray-900 p-5">
            <h2 className="text-base font-semibold mb-1">Daily Calories & Macros</h2>
            <p className="text-xs text-gray-500 mb-4">
              {calorieData.length > 0
                ? `Avg ${Math.round(calorieData.reduce((s, d) => s + d.calories, 0) / calorieData.length)} cal/day`
                : 'No data yet'}
            </p>
            {calorieData.length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={calorieData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} width={45} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
                    />
                    <Bar dataKey="protein" stackId="macros" fill="#34d399" name="Protein" />
                    <Bar dataKey="carbs" stackId="macros" fill="#60a5fa" name="Carbs" />
                    <Bar dataKey="fat" stackId="macros" fill="#fbbf24" name="Fat" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8 text-sm">Log meals to see macro breakdown</p>
            )}
          </div>

          {/* 3. Workout Section */}
          <div className="rounded-2xl bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Workouts</h2>
              <div className="flex gap-1 rounded-lg bg-gray-800 p-1">
                {['all', 'zone2', 'lift', 'bjj'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setWorkoutFilter(f)}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                      workoutFilter === f ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'zone2' ? 'Zone 2' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const filtered = workoutFilter === 'all' ? workoutData : workoutData.filter((w) => w.type === workoutFilter)
              if (filtered.length === 0) {
                return <p className="text-center text-gray-500 py-8 text-sm">No workout data{workoutFilter !== 'all' ? ` for ${workoutFilter}` : ''}</p>
              }

              const hasCalData = filtered.some((w) => w.calBurned != null)
              const hasDistData = filtered.some((w) => w.distance != null)

              return (
                <div className="space-y-6">
                  {/* Volume chart */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">{filtered.length} sessions — Volume</p>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filtered}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} width={50} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="volume" fill="#a78bfa" name="Volume (lbs)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Calories burned chart */}
                  {hasCalData && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Calories Burned</p>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={filtered.filter((w) => w.calBurned != null)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} width={45} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="calBurned" fill="#f97316" name="Cal Burned" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Distance chart (only if data exists) */}
                  {hasDistData && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Distance (miles)</p>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={filtered.filter((w) => w.distance != null)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} width={40} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Line type="monotone" dataKey="distance" stroke="#34d399" strokeWidth={2} dot={{ r: 2 }} name="Miles" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Workout history table */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">History</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500 border-b border-gray-800">
                            <th className="text-left py-2 pr-2">Date</th>
                            <th className="text-left py-2 pr-2">Type</th>
                            <th className="text-right py-2 pr-2">Min</th>
                            <th className="text-right py-2 pr-2">Mi</th>
                            <th className="text-right py-2 pr-2">Cal</th>
                            <th className="text-right py-2">Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((w, i) => (
                            <tr key={i} className="border-b border-gray-800/50">
                              <td className="py-2 pr-2 text-gray-300">{w.date}</td>
                              <td className="py-2 pr-2 text-gray-400 capitalize">{w.type}</td>
                              <td className="py-2 pr-2 text-right text-gray-400">{w.duration ?? '—'}</td>
                              <td className="py-2 pr-2 text-right text-gray-400">{w.distance?.toFixed(1) ?? '—'}</td>
                              <td className="py-2 pr-2 text-right text-gray-300">{w.calBurned ?? '—'}</td>
                              <td className="py-2 text-right text-gray-500">
                                {w.calMethod === 'user_override' ? 'Your Entry' : w.calMethod === 'apple_health' ? 'Apple Health' : w.calBurned != null ? 'Estimated' : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* 4. Body Composition */}
          <div className="rounded-2xl bg-gray-900 p-5">
            <h2 className="text-base font-semibold mb-1">Body Composition</h2>
            <p className="text-xs text-gray-500 mb-4">
              {bodyCompData.length > 0 ? 'From scale readings' : 'No body comp data yet'}
            </p>
            {bodyCompData.length > 1 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={bodyCompData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} width={40} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                    <Area type="monotone" dataKey="bodyFat" stroke="#f87171" fill="#f87171" fillOpacity={0.15} name="Body Fat %" />
                    <Area type="monotone" dataKey="water" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} name="Water %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8 text-sm">
                Use a smart scale to track body composition
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
