'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import WorkoutEditModal from '@/components/dashboard/WorkoutEditModal'
import GlassPanel from '@/components/ui/GlassPanel'
import MarbleBackground from '@/components/ui/MarbleBackground'
import Link from 'next/link'
import type { WorkoutSession } from '@/types/database'
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

const GOLD = '#a47c16'
const GOLD_LIGHT = '#c9a03c'
const TEXT_DARK = '#3d3225'
const TEXT_MID = '#5a4a32'
const BAR_PPP = 48   // pixels per data point for bar charts
const LINE_PPP = 60  // pixels per data point for line charts

function SectionDivider() {
  return (
    <div className="flex items-center justify-center gap-3 py-1">
      <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${GOLD_LIGHT}44, transparent)` }} />
      <span style={{ color: `${GOLD_LIGHT}88`, fontSize: 10 }}>&#10022;</span>
      <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${GOLD_LIGHT}44, transparent)` }} />
    </div>
  )
}

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
  const [workoutData, setWorkoutData] = useState<WorkoutSession[]>([])
  const [bodyCompData, setBodyCompData] = useState<{ date: string; bodyFat?: number; muscle?: number; water?: number }[]>([])
  const [workoutFilter, setWorkoutFilter] = useState<string>('all')
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(null)
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
          .select('*')
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
        setWorkoutData(workouts.data as WorkoutSession[])
      }

      setLoading(false)
    }

    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, range])

  const refreshWorkouts = useCallback(async () => {
    if (!userId) return
    const since = range === 'all' ? '2020-01-01' : daysAgo(range === '7d' ? 7 : range === '30d' ? 30 : 90)
    const { data } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('trained_at', since)
      .order('trained_at', { ascending: true })
    if (data) setWorkoutData(data as WorkoutSession[])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, range])

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#eae5de' }}>
        <div style={{ color: 'rgba(70,48,12,0.5)' }}>Loading...</div>
      </div>
    )
  }

  if (!user) {
    router.push('/onboarding')
    return null
  }

  const tooltipStyle = {
    backgroundColor: 'rgba(255,252,245,0.95)',
    border: '1px solid rgba(164,124,22,0.25)',
    borderRadius: '0.5rem',
    color: 'rgba(70,48,12,0.88)',
    fontSize: 12,
  }

  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: '#eae5de' }}>
      <MarbleBackground />
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm hover:opacity-70 transition-opacity" style={{ color: GOLD }}>
              &larr; Dashboard
            </Link>
            <h1
              className="text-2xl font-bold mt-1 uppercase tracking-widest"
              style={{ color: '#be9424', WebkitTextStroke: '0.6px rgba(70,42,4,0.28)' }}
            >
              PROGRESS
            </h1>
          </div>
          {/* Time range selector */}
          <div className="flex gap-3">
            {(['7d', '30d', '90d', 'all'] as TimeRange[]).map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setRange(r)}
                className="px-1 pb-1 text-xs font-semibold transition-colors"
                style={{
                  color: range === r ? '#5a3e08' : 'rgba(70,48,12,0.5)',
                  borderBottom: range === r ? '3px solid rgba(165,128,32,0.72)' : '3px solid transparent',
                }}
              >
                {r === 'all' ? 'All' : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: 'rgba(164,124,22,0.2)', borderTopColor: GOLD }} />
        </div>
      ) : (
        <div className="space-y-4 px-4">
          {/* 1. Weight Trend */}
          <GlassPanel className="p-5">
            <h2 className="text-sm font-semibold mb-1 uppercase tracking-wider" style={{ color: GOLD }}>Weight Trend</h2>
            <p className="text-xs mb-4" style={{ color: 'rgba(70,48,12,0.58)' }}>
              {weightData.length > 0
                ? `${weightData[0].weight} → ${weightData[weightData.length - 1].weight} lbs`
                : 'No data yet'}
            </p>
            {weightData.length > 1 ? (
              <div className="h-48 overflow-x-auto">
                <div style={{ minWidth: '100%', width: weightData.length * LINE_PPP, height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(70,48,12,0.5)' }} tickLine={false} />
                      <YAxis
                        domain={['dataMin - 1', 'dataMax + 1']}
                        tick={{ fontSize: 10, fill: 'rgba(70,48,12,0.5)' }}
                        tickLine={false}
                        width={40}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="weight" stroke={GOLD_LIGHT} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <p className="text-center py-8 text-sm" style={{ color: 'rgba(70,48,12,0.4)' }}>Log weight to see your trend</p>
            )}
          </GlassPanel>

          <SectionDivider />

          {/* 2. Calories & Macros */}
          <GlassPanel className="p-5">
            <h2 className="text-sm font-semibold mb-1 uppercase tracking-wider" style={{ color: GOLD }}>Daily Calories & Macros</h2>
            <p className="text-xs mb-4" style={{ color: 'rgba(70,48,12,0.58)' }}>
              {calorieData.length > 0
                ? `Avg ${Math.round(calorieData.reduce((s, d) => s + d.calories, 0) / calorieData.length)} cal/day`
                : 'No data yet'}
            </p>
            {calorieData.length > 0 ? (
              <div className="h-56 overflow-x-auto">
                <div style={{ minWidth: '100%', width: calorieData.length * BAR_PPP, height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={calorieData} barSize={32}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(70,48,12,0.5)' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'rgba(70,48,12,0.5)' }} tickLine={false} width={45} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend
                        wrapperStyle={{ fontSize: 11, color: 'rgba(70,48,12,0.6)' }}
                      />
                      <Bar dataKey="protein" stackId="macros" fill="#7836a8" name="Protein" />
                      <Bar dataKey="carbs" stackId="macros" fill="#94680e" name="Carbs" />
                      <Bar dataKey="fat" stackId="macros" fill="#8e261e" name="Fat" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <p className="text-center py-8 text-sm" style={{ color: 'rgba(70,48,12,0.4)' }}>Log meals to see macro breakdown</p>
            )}
          </GlassPanel>

          <SectionDivider />

          {/* 3. Workout Section */}
          <GlassPanel className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: GOLD }}>Workouts</h2>
              <div className="flex gap-3">
                {['all', 'zone2', 'lift', 'bjj'].map((f) => (
                  <button
                    type="button"
                    key={f}
                    onClick={() => setWorkoutFilter(f)}
                    className="px-1 pb-1 text-xs font-semibold transition-colors"
                    style={{
                      color: workoutFilter === f ? '#5a3e08' : 'rgba(70,48,12,0.5)',
                      borderBottom: workoutFilter === f ? '3px solid rgba(165,128,32,0.72)' : '3px solid transparent',
                    }}
                  >
                    {f === 'all' ? 'All' : f === 'zone2' ? 'Zone 2' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const filtered = workoutFilter === 'all' ? workoutData : workoutData.filter((w) => w.session_type === workoutFilter)
              if (filtered.length === 0) {
                return <p className="text-center py-8 text-sm" style={{ color: 'rgba(70,48,12,0.4)' }}>No workout data{workoutFilter !== 'all' ? ` for ${workoutFilter}` : ''}</p>
              }

              const chartData = filtered.map((w) => ({
                date: formatDate(w.trained_at),
                volume: w.total_volume_lbs || 0,
                calBurned: w.estimated_cal_burned,
                distance: w.distance_miles ? Number(w.distance_miles) : null,
              }))

              const hasCalData = chartData.some((w) => w.calBurned != null)
              const hasDistData = chartData.some((w) => w.distance != null)

              return (
                <div className="space-y-6">
                  {/* Volume chart */}
                  <div>
                    <p className="text-xs mb-2" style={{ color: 'rgba(70,48,12,0.58)' }}>{filtered.length} sessions — Volume</p>
                    <div className="h-48 overflow-x-auto">
                      <div style={{ minWidth: '100%', width: chartData.length * BAR_PPP, height: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} barSize={32}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(70,48,12,0.5)' }} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: 'rgba(70,48,12,0.5)' }} tickLine={false} width={50} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="volume" fill="#a78bfa" name="Volume (lbs)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Calories burned chart */}
                  {hasCalData && (
                    <div>
                      <p className="text-xs mb-2" style={{ color: 'rgba(70,48,12,0.58)' }}>Calories Burned</p>
                      <div className="h-48 overflow-x-auto">
                        <div style={{ minWidth: '100%', width: chartData.filter((w) => w.calBurned != null).length * BAR_PPP, height: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.filter((w) => w.calBurned != null)} barSize={32}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(70,48,12,0.5)' }} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: 'rgba(70,48,12,0.5)' }} tickLine={false} width={45} />
                              <Tooltip contentStyle={tooltipStyle} />
                              <Bar dataKey="calBurned" fill="#f97316" name="Cal Burned" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Distance chart (only if data exists) */}
                  {hasDistData && (
                    <div>
                      <p className="text-xs mb-2" style={{ color: 'rgba(70,48,12,0.58)' }}>Distance (miles)</p>
                      <div className="h-48 overflow-x-auto">
                        <div style={{ minWidth: '100%', width: chartData.filter((w) => w.distance != null).length * LINE_PPP, height: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData.filter((w) => w.distance != null)}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(70,48,12,0.5)' }} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: 'rgba(70,48,12,0.5)' }} tickLine={false} width={40} />
                              <Tooltip contentStyle={tooltipStyle} />
                              <Line type="monotone" dataKey="distance" stroke="#34d399" strokeWidth={2} dot={{ r: 2 }} name="Miles" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Workout history table */}
                  <div>
                    <p className="text-xs mb-2" style={{ color: 'rgba(70,48,12,0.58)' }}>History — tap a row to edit</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ color: 'rgba(70,48,12,0.5)', borderBottom: '1px solid rgba(165,128,32,0.2)' }}>
                            <th className="text-left py-2 pr-2">Date</th>
                            <th className="text-left py-2 pr-2">Type</th>
                            <th className="text-right py-2 pr-2">Time</th>
                            <th className="text-right py-2 pr-2">Min</th>
                            <th className="text-right py-2 pr-2">Mi</th>
                            <th className="text-left py-2 pr-2">Notes</th>
                            <th className="text-right py-2 pr-2">Cal</th>
                            <th className="text-right py-2">Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((w) => {
                            const noteText = w.workout_notes || ''
                            const truncated = noteText.length > 20 ? noteText.slice(0, 20) + '…' : noteText
                            return (
                              <tr
                                key={w.id}
                                onClick={() => setEditingWorkout(w)}
                                className="cursor-pointer transition-colors hover:bg-amber-50/40"
                                style={{ borderBottom: '1px solid rgba(165,128,32,0.15)' }}
                              >
                                <td className="py-2 pr-2" style={{ color: TEXT_DARK }}>{formatDate(w.trained_at)}</td>
                                <td className="py-2 pr-2 capitalize" style={{ color: TEXT_MID }}>{w.session_type}</td>
                                <td className="py-2 pr-2 text-right" style={{ color: TEXT_MID }}>
                                  {new Date(w.trained_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </td>
                                <td className="py-2 pr-2 text-right" style={{ color: TEXT_MID }}>{w.duration_min ?? '—'}</td>
                                <td className="py-2 pr-2 text-right" style={{ color: TEXT_MID }}>{w.distance_miles ? Number(w.distance_miles).toFixed(1) : '—'}</td>
                                <td className="py-2 pr-2" style={{ color: 'rgba(70,48,12,0.5)' }}>{truncated || '—'}</td>
                                <td className="py-2 pr-2 text-right" style={{ color: TEXT_DARK }}>{w.estimated_cal_burned ?? '—'}</td>
                                <td className="py-2 text-right" style={{ color: 'rgba(70,48,12,0.5)' }}>
                                  {w.cal_estimate_method === 'user_override' ? 'Your Entry' : w.cal_estimate_method === 'apple_health' ? 'Apple Health' : w.estimated_cal_burned != null ? 'Estimated' : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            })()}
          </GlassPanel>

          <SectionDivider />

          {/* 4. Body Composition */}
          <GlassPanel className="p-5">
            <h2 className="text-sm font-semibold mb-1 uppercase tracking-wider" style={{ color: GOLD }}>Body Composition</h2>
            <p className="text-xs mb-4" style={{ color: 'rgba(70,48,12,0.58)' }}>
              {bodyCompData.length > 0 ? 'From scale readings' : 'No body comp data yet'}
            </p>
            {bodyCompData.length > 1 ? (
              <div className="h-48 overflow-x-auto">
                <div style={{ minWidth: '100%', width: bodyCompData.length * LINE_PPP, height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={bodyCompData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(70,48,12,0.5)' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'rgba(70,48,12,0.5)' }} tickLine={false} width={40} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(70,48,12,0.6)' }} />
                      <Area type="monotone" dataKey="bodyFat" stroke="#f87171" fill="#f87171" fillOpacity={0.15} name="Body Fat %" />
                      <Area type="monotone" dataKey="water" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} name="Water %" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <p className="text-center py-8 text-sm" style={{ color: 'rgba(70,48,12,0.4)' }}>
                Use a smart scale to track body composition
              </p>
            )}
          </GlassPanel>
        </div>
      )}

      {editingWorkout && (
        <WorkoutEditModal
          workout={editingWorkout}
          onSaved={() => { refreshWorkouts(); setEditingWorkout(null) }}
          onDeleted={() => { refreshWorkouts(); setEditingWorkout(null) }}
          onClose={() => setEditingWorkout(null)}
        />
      )}
    </div>
  )
}
