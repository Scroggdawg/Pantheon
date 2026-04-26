'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import GlassPanel from '@/components/ui/GlassPanel'
import FoodEntryEditModal from '@/components/dashboard/FoodEntryEditModal'
import WorkoutEditModal from '@/components/dashboard/WorkoutEditModal'
import type { FoodLogEntry, WorkoutSession } from '@/types/database'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

interface DayDetailPanelProps {
  selectedDate: string
  userId: string
  weightTrendData: { date: string; weight: number }[]
}

const GOLD = '#a47c16'
const GOLD_LIGHT = '#c9a03c'
const TEXT_DARK = '#3d3225'
const TEXT_MID = '#5a4a32'
const TEXT_MUTED = '#8a7a60'
const LINE_PPP = 60

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack']

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function groupByMeal(entries: FoodLogEntry[]): Map<string, FoodLogEntry[]> {
  const groups = new Map<string, FoodLogEntry[]>()
  for (const label of MEAL_ORDER) {
    const matching = entries.filter(e => (e.meal_label ?? 'snack').toLowerCase() === label)
    if (matching.length > 0) groups.set(label, matching)
  }
  const knownLabels = new Set(MEAL_ORDER)
  for (const entry of entries) {
    const label = (entry.meal_label ?? 'snack').toLowerCase()
    if (!knownLabels.has(label)) {
      const existing = groups.get(label) ?? []
      existing.push(entry)
      groups.set(label, existing)
    }
  }
  return groups
}

function getTodayLA(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={GOLD_LIGHT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className="transition-transform duration-200 shrink-0"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

const tooltipStyle = {
  backgroundColor: 'rgba(255,252,245,0.95)',
  border: '1px solid rgba(164,124,22,0.25)',
  borderRadius: '0.5rem',
  color: 'rgba(70,48,12,0.88)',
  fontSize: 12,
}

export default function DayDetailPanel({ selectedDate, userId, weightTrendData }: DayDetailPanelProps) {
  const [openPanels, setOpenPanels] = useState<Set<string>>(new Set(['calories', 'workouts', 'weight']))
  const [foodEntries, setFoodEntries] = useState<FoodLogEntry[]>([])
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([])
  const [weightReadings, setWeightReadings] = useState<{ weight_lbs: number; body_fat_pct: number | null; measured_at: string }[]>([])
  const [dayLoading, setDayLoading] = useState(true)
  const [editingEntry, setEditingEntry] = useState<FoodLogEntry | null>(null)
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(null)

  const supabase = createClient()
  const isToday = selectedDate === getTodayLA()

  async function fetchDay() {
    setDayLoading(true)
    const dayStart = `${selectedDate}T00:00:00`
    const dayEnd = `${selectedDate}T23:59:59`

    const [foods, sessions, weights] = await Promise.all([
      supabase
        .from('food_log_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', dayStart)
        .lte('logged_at', dayEnd)
        .order('logged_at', { ascending: true }),
      supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', userId)
        .gte('trained_at', dayStart)
        .lte('trained_at', dayEnd)
        .order('trained_at', { ascending: true }),
      supabase
        .from('weight_readings')
        .select('measured_at, weight_lbs, body_fat_pct')
        .eq('user_id', userId)
        .gte('measured_at', dayStart)
        .lte('measured_at', dayEnd)
        .order('measured_at', { ascending: true }),
    ])

    setFoodEntries((foods.data as FoodLogEntry[]) || [])
    setWorkouts((sessions.data as WorkoutSession[]) || [])
    setWeightReadings(
      (weights.data as { weight_lbs: number; body_fat_pct: number | null; measured_at: string }[]) || []
    )
    setDayLoading(false)
  }

  useEffect(() => {
    fetchDay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, selectedDate])

  function togglePanel(panel: string) {
    setOpenPanels(prev => {
      const next = new Set(prev)
      if (next.has(panel)) next.delete(panel)
      else next.add(panel)
      return next
    })
  }

  const dayTotals = foodEntries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.total_calories,
      protein: acc.protein + e.total_protein_g,
      carbs: acc.carbs + e.total_carbs_g,
      fat: acc.fat + e.total_fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const grouped = groupByMeal(foodEntries)

  return (
    <div className="space-y-3">
      {dayLoading && (
        <div className="h-[2px] w-full rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(164,124,22,0.1)' }}>
          <div className="h-full animate-pulse rounded-full" style={{ backgroundColor: GOLD_LIGHT, width: '40%' }} />
        </div>
      )}

      {/* Panel A — Calories & Macros */}
      <GlassPanel>
        <button
          type="button"
          onClick={() => togglePanel('calories')}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-2">
            <Chevron open={openPanels.has('calories')} />
            <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
              Calories & Macros
            </span>
          </div>
          <span className="text-sm font-semibold" style={{ color: TEXT_DARK }}>
            {dayTotals.calories.toLocaleString()} cal
          </span>
        </button>

        {openPanels.has('calories') && (
          <div className="px-4 pb-4">
            <div className="flex gap-4 mb-3 text-xs" style={{ color: TEXT_MID }}>
              <span>{Math.round(dayTotals.protein)}g P</span>
              <span>{Math.round(dayTotals.carbs)}g C</span>
              <span>{Math.round(dayTotals.fat)}g F</span>
            </div>

            {foodEntries.length === 0 ? (
              <p className="text-[13px] italic py-2" style={{ color: TEXT_MUTED }}>No meals logged</p>
            ) : (
              <div className="space-y-4">
                {Array.from(grouped.entries()).map(([mealLabel, mealEntries]) => (
                  <div key={mealLabel}>
                    <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1.5" style={{ color: '#7a6a52' }}>
                      {capitalize(mealLabel)}
                    </h4>
                    <div className="space-y-1">
                      {mealEntries.map(entry => {
                        const foodNames = entry.foods_json.map(f => f.name).join(', ')
                        return (
                          <div key={entry.id} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingEntry(entry)}
                              className="food-row-hover flex items-center justify-between gap-3 flex-1 text-left min-w-0 py-1.5 border-b last:border-0 rounded-md px-2 -mx-2 cursor-pointer transition-colors"
                              style={{ borderColor: 'rgba(180,160,120,0.12)' }}
                            >
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-[13px] font-medium truncate" style={{ color: TEXT_DARK }}>{foodNames}</span>
                                <span className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTED }}>
                                  {formatTime(entry.logged_at)}
                                </span>
                              </div>
                              <span className="text-[14px] font-semibold shrink-0" style={{ color: GOLD }}>
                                {entry.total_calories} cal
                              </span>
                            </button>
                            {!isToday && (
                              <button
                                type="button"
                                onClick={async () => {
                                  // May fail silently due to RLS (carried from Session 2)
                                  await supabase.from('food_log_entries').insert({
                                    user_id: userId,
                                    logged_at: new Date().toISOString(),
                                    meal_label: entry.meal_label,
                                    day_type: entry.day_type,
                                    foods_json: entry.foods_json,
                                    total_calories: entry.total_calories,
                                    total_protein_g: entry.total_protein_g,
                                    total_carbs_g: entry.total_carbs_g,
                                    total_fat_g: entry.total_fat_g,
                                    log_method: 'manual',
                                  })
                                }}
                                className="shrink-0 text-[10px] uppercase tracking-wider font-semibold hover:opacity-70 transition-opacity"
                                style={{ color: GOLD_LIGHT }}
                                title="Log this meal to today"
                              >
                                +Today
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </GlassPanel>

      {/* Panel B — Workouts */}
      <GlassPanel>
        <button
          type="button"
          onClick={() => togglePanel('workouts')}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-2">
            <Chevron open={openPanels.has('workouts')} />
            <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
              Workouts
            </span>
          </div>
          <span className="text-sm font-semibold" style={{ color: TEXT_DARK }}>
            {workouts.length} session{workouts.length !== 1 ? 's' : ''}
          </span>
        </button>

        {openPanels.has('workouts') && (
          <div className="px-4 pb-4">
            {workouts.length === 0 ? (
              <p className="text-[13px] italic py-2" style={{ color: TEXT_MUTED }}>No workouts logged</p>
            ) : (
              <div className="space-y-1">
                {workouts.map(w => {
                  const details: string[] = []
                  if (w.duration_min) details.push(`${w.duration_min} min`)
                  if (w.estimated_cal_burned) details.push(`${w.estimated_cal_burned} cal`)
                  if (w.distance_miles) details.push(`${Number(w.distance_miles).toFixed(1)} mi`)
                  if (w.session_type === 'lift' && w.total_volume_lbs) details.push(`${w.total_volume_lbs.toLocaleString()} lbs vol`)
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setEditingWorkout(w)}
                      className="food-row-hover w-full flex items-center justify-between py-2 text-left border-b last:border-0 rounded-md px-2 -mx-2 cursor-pointer transition-colors"
                      style={{ borderColor: 'rgba(180,160,120,0.12)' }}
                    >
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium capitalize" style={{ color: TEXT_DARK }}>{w.session_type}</span>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTED }}>
                          {formatTime(w.trained_at)}{details.length > 0 ? ` \u00b7 ${details.join(' \u00b7 ')}` : ''}
                        </span>
                      </div>
                      <span className="text-[14px] font-semibold" style={{ color: GOLD }}>
                        {w.duration_min ? `${w.duration_min} min` : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </GlassPanel>

      {/* Panel C — Weight */}
      <GlassPanel>
        <button
          type="button"
          onClick={() => togglePanel('weight')}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-2">
            <Chevron open={openPanels.has('weight')} />
            <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
              Weight
            </span>
          </div>
          <span className="text-sm font-semibold" style={{ color: TEXT_DARK }}>
            {weightReadings.length > 0
              ? `${Number(weightReadings[weightReadings.length - 1].weight_lbs).toFixed(1)} lbs`
              : 'No reading'}
          </span>
        </button>

        {openPanels.has('weight') && (
          <div className="px-4 pb-4">
            {/* 90-day weight trend chart */}
            {weightTrendData.length > 1 && (
              <div className="h-40 overflow-x-auto mb-3">
                <div style={{ minWidth: '100%', width: weightTrendData.length * LINE_PPP, height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightTrendData}>
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
            )}

            {/* Day readings */}
            {weightReadings.length > 0 ? (
              <div className="space-y-1">
                {weightReadings.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 border-b last:border-0"
                    style={{ borderColor: 'rgba(180,160,120,0.12)' }}
                  >
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium" style={{ color: TEXT_DARK }}>
                        {Number(r.weight_lbs).toFixed(1)} lbs
                      </span>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTED }}>
                        {formatTime(r.measured_at)}
                        {r.body_fat_pct ? ` \u00b7 ${Number(r.body_fat_pct).toFixed(1)}% BF` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] italic py-2" style={{ color: TEXT_MUTED }}>No weight reading</p>
            )}
          </div>
        )}
      </GlassPanel>

      {/* Modals via createPortal (GlassPanel backdropFilter traps fixed children) */}
      {editingEntry && createPortal(
        <FoodEntryEditModal
          entry={editingEntry}
          onSaved={() => { fetchDay(); setEditingEntry(null) }}
          onDeleted={() => { fetchDay(); setEditingEntry(null) }}
          onClose={() => setEditingEntry(null)}
        />,
        document.body
      )}

      {editingWorkout && createPortal(
        <WorkoutEditModal
          workout={editingWorkout}
          onSaved={() => { fetchDay(); setEditingWorkout(null) }}
          onDeleted={() => { fetchDay(); setEditingWorkout(null) }}
          onClose={() => setEditingWorkout(null)}
        />,
        document.body
      )}
    </div>
  )
}
