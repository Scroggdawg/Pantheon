'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/hooks/useUser'
import { useDailyLog } from '@/hooks/useDailyLog'
import { useWeightTrend } from '@/hooks/useWeightTrend'
import { useTodayWorkouts } from '@/hooks/useTodayWorkouts'
import GlassPanel from '@/components/ui/GlassPanel'
import MarbleBackground from '@/components/ui/MarbleBackground'
import ScoreCard from '@/components/dashboard/ScoreCard'
import CoachPanel from '@/components/dashboard/CoachPanel'
import SundayCheckinCard from '@/components/dashboard/SundayCheckinCard'
import TodayLog from '@/components/dashboard/TodayLog'
import { VoiceLogger } from '@/components/logging/VoiceLogger'
import { ManualWeightModal } from '@/components/logging/ManualWeightModal'
import { QuickSelectModal } from '@/components/logging/QuickSelectModal'
import { TextLogModal } from '@/components/logging/TextLogModal'
import { WorkoutLogger } from '@/components/logging/WorkoutLogger'
import WorkoutEditModal from '@/components/dashboard/WorkoutEditModal'
import FoodEntryEditModal from '@/components/dashboard/FoodEntryEditModal'
import { DAY_TYPE_ADJUSTMENTS } from '@/types/database'
import type { DayType, WorkoutSession, FoodLogEntry } from '@/types/database'

function toRoman(num: number): string {
  const vals: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let result = ''
  for (const [value, numeral] of vals) {
    while (num >= value) {
      result += numeral
      num -= value
    }
  }
  return result
}

function getTodayLA(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}

function formatRomanDate(dateStr: string): string {
  // Parse YYYY-MM-DD as local date (noon to avoid timezone edge)
  const d = new Date(`${dateStr}T12:00:00`)
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d)
  const day = d.getDate()
  const year = d.getFullYear()
  return `${month} ${toRoman(day)} · ${toRoman(year)}`
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const DAY_OPTIONS: { key: DayType; label: string }[] = [
  { key: 'lift', label: 'Lift' },
  { key: 'zone2', label: 'Zone II' },
  { key: 'rest', label: 'Rest' },
]

const GOLD = '#a47c16'
const GOLD_LIGHT = '#c9a03c'
const GOLD_BRIGHT = '#e8c048'
const TEXT_DARK = '#3d3225'
const TEXT_MID = '#5a4a32'
const TEXT_LIGHT = '#7a6a52'
const TEXT_MUTED = '#8a7a60'
const TEXT_DIM = '#9a8a6a'

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${GOLD_LIGHT}, ${GOLD_BRIGHT}, ${GOLD_LIGHT}, transparent)` }} />
      <span className="text-[11px] uppercase tracking-[0.2em] font-medium" style={{ color: GOLD }}>{'\u2726'} {label} {'\u2726'}</span>
      <div className="flex-1 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${GOLD_LIGHT}, ${GOLD_BRIGHT}, ${GOLD_LIGHT}, transparent)` }} />
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, userId, loading: userLoading } = useUser()
  const [selectedDate, setSelectedDate] = useState(() => {
    const param = searchParams.get('date')
    if (param && /^\d{4}-\d{2}-\d{2}$/.test(param) && param <= getTodayLA()) return param
    return getTodayLA()
  })
  const isToday = selectedDate === getTodayLA()
  const datePickerRef = useRef<HTMLInputElement>(null)
  const { entries, totals, refresh: refreshLog } = useDailyLog(userId, selectedDate)
  const { readings, latest, refresh: refreshWeight } = useWeightTrend(userId)
  const { workouts, refresh: refreshWorkouts } = useTodayWorkouts(userId, selectedDate)

  const [dayType, setDayType] = useState<DayType>('zone2')
  const [showVoice, setShowVoice] = useState(false)
  const [showManualWeight, setShowManualWeight] = useState(false)
  const [showQuickSelect, setShowQuickSelect] = useState(false)
  const [showTextLog, setShowTextLog] = useState(false)
  const [showWorkout, setShowWorkout] = useState(false)
  const [showCoach, setShowCoach] = useState(false)
  const [showFoodMenu, setShowFoodMenu] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(null)
  const [editingEntry, setEditingEntry] = useState<FoodLogEntry | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [withingsConnected, setWithingsConnected] = useState(false)
  const [showWithingsBanner, setShowWithingsBanner] = useState(false)

  // Check Withings connection status on mount + auto-sync if stale
  useEffect(() => {
    fetch('/api/withings/status')
      .then(res => res.json())
      .then(data => {
        if (!data.connected) return
        setWithingsConnected(true)
        const staleMs = 6 * 60 * 60 * 1000
        const isStale = !latest?.measured_at || (Date.now() - new Date(latest.measured_at).getTime() > staleMs)
        if (isStale) {
          fetch('/api/withings/sync', { method: 'POST' })
            .then(r => r.json())
            .then(d => { if (!d.error) refreshWeight() })
            .catch(() => {})
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle ?withings=connected callback
  useEffect(() => {
    if (searchParams.get('withings') === 'connected') {
      setWithingsConnected(true)
      setShowWithingsBanner(true)
      router.replace('/dashboard')
      const t = setTimeout(() => setShowWithingsBanner(false), 3000)
      return () => clearTimeout(t)
    }
  }, [searchParams, router])

  const handleLogComplete = useCallback(() => {
    refreshLog()
    setShowVoice(false)
    setShowQuickSelect(false)
    setShowTextLog(false)
  }, [refreshLog])

  const handleWeightSaved = useCallback(() => {
    refreshWeight()
    setShowManualWeight(false)
  }, [refreshWeight])

  async function handleSync() {
    if (syncing) return
    if (!withingsConnected) {
      // Not connected — start OAuth flow
      window.location.href = '/api/auth/withings'
      return
    }
    setSyncing(true)
    try {
      const res = await fetch('/api/withings/sync', { method: 'POST' })
      const data = await res.json()
      if (!data.error) refreshWeight()
    } finally {
      setSyncing(false)
    }
  }

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#eae5de' }}>
        <div style={{ color: TEXT_LIGHT }}>Loading...</div>
      </div>
    )
  }

  if (!user) {
    router.push('/onboarding')
    return null
  }

  const adj = DAY_TYPE_ADJUSTMENTS[dayType]
  const calorieTarget = (user.base_calories_target || 2250) + adj.calories
  const proteinTarget = user.base_protein_g || 200
  const carbsTarget = (user.base_carbs_g || 160) + adj.carbs_g
  const fatTarget = user.base_fat_g || 90
  const latestWeight = latest ? Number(latest.weight_lbs) : null

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#eae5de' }}>
      <MarbleBackground />

      {/* Ambient light spots */}
      <div className="absolute top-20 left-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,252,245,0.5) 0%, transparent 70%)' }} />
      <div className="absolute top-80 right-5 w-40 h-40 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,250,240,0.4) 0%, transparent 70%)' }} />
      <div className="absolute top-[500px] left-[30px] w-32 h-32 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,248,235,0.35) 0%, transparent 70%)' }} />

      <div className="relative z-10 px-4 pt-12 pb-32">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-between mb-2">
            <Link
              href="/provisions"
              className="text-[11px] uppercase tracking-[0.15em] font-semibold"
              style={{ color: GOLD_LIGHT }}
            >
              Provisions &rarr;
            </Link>
            <Link
              href="/progress"
              className="text-[11px] uppercase tracking-[0.15em] font-semibold"
              style={{ color: GOLD_LIGHT }}
            >
              Progress &rarr;
            </Link>
          </div>
          <h1
            className="text-3xl font-bold tracking-[0.15em] relative inline-block"
            style={{
              color: '#be9424',
              WebkitTextStroke: '0.6px #5a4520',
              textShadow: '0 2px 4px rgba(85,60,20,0.2)',
            }}
          >
            <span className="relative">
              PANTHEON
              <span
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'repeating-linear-gradient(15deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0.17) 2px, rgba(255,255,255,0) 4px)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                }}
              />
            </span>
          </h1>
          <p className="text-[11px] uppercase tracking-[0.3em] mt-1" style={{ color: TEXT_LIGHT }}>
            Daily Record
          </p>
          <div className="flex items-center justify-center gap-4 mt-1">
            <button
              type="button"
              onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
              className="text-[11px] uppercase tracking-[0.15em] font-semibold hover:opacity-70 transition-opacity"
              style={{ color: GOLD_LIGHT }}
            >
              &larr; Previous
            </button>
            <button
              type="button"
              onClick={() => datePickerRef.current?.showPicker()}
              className="text-[12px] tracking-wider hover:opacity-70 transition-opacity"
              style={{ color: TEXT_DIM }}
            >
              {formatRomanDate(selectedDate)}
            </button>
            <input
              ref={datePickerRef}
              type="date"
              value={selectedDate}
              max={getTodayLA()}
              onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value) }}
              className="absolute w-0 h-0 opacity-0 pointer-events-none"
              tabIndex={-1}
            />
            <button
              type="button"
              onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
              disabled={isToday}
              className="text-[11px] uppercase tracking-[0.15em] font-semibold transition-opacity"
              style={{ color: GOLD_LIGHT, opacity: isToday ? 0.3 : 1 }}
            >
              Next &rarr;
            </button>
          </div>
          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(getTodayLA())}
              className="text-[11px] mt-1 uppercase tracking-wider font-semibold hover:opacity-70 transition-opacity"
              style={{ color: GOLD_LIGHT }}
            >
              Today &rarr;
            </button>
          )}
        </div>

        {/* Day Type Toggle */}
        <div
          className="relative rounded-[20px] p-1 mb-4 overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.04) 100%)',
            backdropFilter: 'blur(0.1px)',
            WebkitBackdropFilter: 'blur(0.1px)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.1)',
            border: '1px solid rgba(255,255,255,0.25)',
          }}
        >
          <div className="flex gap-1 relative z-10">
            {DAY_OPTIONS.map((day) => (
              <button
                key={day.key}
                type="button"
                onClick={() => setDayType(day.key)}
                className="flex-1 py-3 px-3 text-[12px] font-semibold uppercase tracking-wider rounded-lg transition-all"
                style={{
                  color: GOLD,
                  background: dayType === day.key
                    ? 'linear-gradient(135deg, rgba(232,192,72,0.25) 0%, rgba(201,160,60,0.35) 100%)'
                    : 'transparent',
                  boxShadow: dayType === day.key
                    ? '0 2px 8px rgba(201,160,60,0.25), inset 0 1px 0 rgba(255,248,200,0.5)'
                    : 'none',
                  border: dayType === day.key
                    ? '1px solid rgba(201,160,60,0.4)'
                    : '1px solid transparent',
                }}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sunday Check-in */}
        <SundayCheckinCard userId={userId!} />

        {/* Withings connected banner */}
        {showWithingsBanner && (
          <div className="text-center mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: GOLD_LIGHT }}>
              Withings connected ✓
            </span>
          </div>
        )}

        {/* Calories + Weight Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <GlassPanel className="p-4">
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: TEXT_LIGHT }}>Calories</p>
            <p className="text-2xl font-bold" style={{ color: GOLD, textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>
              {totals.calories.toLocaleString()}
            </p>
            <p className="text-[10px] mt-1" style={{ color: TEXT_MUTED }}>
              of {calorieTarget.toLocaleString()} kcal
            </p>
          </GlassPanel>
          <GlassPanel className="p-4">
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: TEXT_LIGHT }}>Weight</p>
            {latestWeight !== null ? (
              <>
                <p className="text-2xl font-bold" style={{ color: GOLD, textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>
                  {latestWeight.toFixed(1)}
                </p>
                <p className="text-[10px] mt-1" style={{ color: TEXT_MUTED }}>
                  lbs &middot;{' '}
                  <button type="button" onClick={handleSync} className="underline" style={{ color: TEXT_MUTED }}>
                    {syncing ? 'syncing\u2026' : withingsConnected ? 'sync' : 'connect scale'}
                  </button>
                  {' \u00b7 '}
                  <button type="button" onClick={() => setShowManualWeight(true)} className="underline" style={{ color: TEXT_MUTED }}>
                    manual
                  </button>
                </p>
              </>
            ) : (
              <>
                <p className="text-lg italic" style={{ color: TEXT_MUTED }}>&mdash;</p>
                <p className="text-[10px] mt-1" style={{ color: TEXT_MUTED }}>
                  <button type="button" onClick={handleSync} className="underline" style={{ color: TEXT_MUTED }}>
                    {syncing ? 'syncing\u2026' : withingsConnected ? 'sync' : 'connect scale'}
                  </button>
                  {' \u00b7 '}
                  <button type="button" onClick={() => setShowManualWeight(true)} className="underline" style={{ color: TEXT_MUTED }}>
                    enter
                  </button>
                </p>
              </>
            )}
          </GlassPanel>
        </div>

        {/* Macros */}
        <GlassPanel className="p-4 mb-4">
          <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: TEXT_LIGHT }}>Macros</p>
          <div className="grid grid-cols-3 gap-4">
            {([
              { label: 'Protein', current: Math.round(totals.protein), target: proteinTarget, stroke: '#9333ea' },
              { label: 'Carbs', current: Math.round(totals.carbs), target: carbsTarget, stroke: '#d97706' },
              { label: 'Fat', current: Math.round(totals.fat), target: fatTarget, stroke: '#b45454' },
            ]).map((macro) => {
              const pct = macro.target > 0 ? Math.min((macro.current / macro.target) * 100, 100) : 0
              return (
                <div key={macro.label} className="flex flex-col gap-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MID }}>{macro.label}</span>
                    <span className="text-[11px] font-semibold" style={{ color: GOLD }}>{macro.current}g</span>
                  </div>
                  <div
                    className="h-[7px] rounded-full relative overflow-hidden"
                    style={{ background: 'rgba(200,185,160,0.25)', boxShadow: `0 0 0 2.5px ${macro.stroke}` }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${GOLD_LIGHT}, ${GOLD_BRIGHT}, ${GOLD_LIGHT})` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </GlassPanel>

        {/* Greek God Bod Score */}
        <ScoreCard
          dayType={dayType}
          entries={entries}
          workouts={workouts}
          weightReadings={readings}
          calorieTarget={calorieTarget}
          proteinTarget={proteinTarget}
          carbsTarget={carbsTarget}
          fatTarget={fatTarget}
          totals={totals}
          userId={userId!}
          selectedDate={selectedDate}
        />

        {/* Meals Section */}
        <SectionDivider label="Meals" />
        <GlassPanel className="p-4 mb-4">
          <TodayLog userId={userId!} entries={entries} onEdit={setEditingEntry} onUpdate={refreshLog} />
        </GlassPanel>

        {/* Sessions Section */}
        <SectionDivider label="Sessions" />
        <GlassPanel className="p-4">
          {workouts.length === 0 ? (
            <p className="text-[13px] italic" style={{ color: TEXT_MUTED }}>No workouts logged yet</p>
          ) : (
            <div>
              {workouts.map((w) => {
                const details: string[] = []
                if (w.duration_min) details.push(`${w.duration_min} min`)
                if (w.estimated_cal_burned) details.push(`${w.estimated_cal_burned} cal`)
                if (w.distance_miles) details.push(`${w.distance_miles} mi`)
                if (w.session_type === 'lift' && w.total_volume_lbs) details.push(`${w.total_volume_lbs.toLocaleString()} lbs vol`)
                const timeStr = new Date(w.trained_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setEditingWorkout(w)}
                    className="w-full flex items-center justify-between py-2 text-left border-b last:border-0"
                    style={{ borderColor: 'rgba(180,160,120,0.12)' }}
                  >
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium capitalize" style={{ color: TEXT_DARK }}>{w.session_type}</span>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_MUTED }}>
                        {timeStr} &middot; {details.join(' \u00b7 ')}
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
        </GlassPanel>
      </div>

      {/* Fixed Bottom Bar (hidden when coach expanded) */}
      {!showCoach && (
        <div className="fixed bottom-0 left-0 right-0 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'url("/marble-bar.png")',
              backgroundSize: 'cover',
              backgroundPosition: 'center 20%',
            }}
          />
          <div className="absolute top-0 left-0 right-0 h-[1px] z-20" style={{ background: GOLD_LIGHT, boxShadow: '0 0 2px rgba(201,160,60,0.5)' }} />
          <div className="flex gap-3 px-4 py-3 relative z-10">
            <button
              type="button"
              onClick={() => setShowFoodMenu((p) => !p)}
              className="flex-1 py-3 rounded-[16px] text-[12px] font-bold uppercase tracking-wider relative overflow-hidden"
              style={{
                color: '#be9424',
                background: 'linear-gradient(145deg, rgba(201,160,60,0.08) 0%, rgba(255,255,255,0.02) 40%, rgba(201,160,60,0.05) 100%)',
                backdropFilter: 'blur(0.1px)',
                border: '1px solid rgba(201,160,60,0.2)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span className="relative z-30">Log Food</span>
            </button>
            <button
              type="button"
              onClick={() => setShowWorkout(true)}
              className="flex-1 py-3 rounded-[16px] text-[12px] font-bold uppercase tracking-wider relative overflow-hidden"
              style={{
                color: '#be9424',
                background: 'linear-gradient(145deg, rgba(201,160,60,0.08) 0%, rgba(255,255,255,0.02) 40%, rgba(201,160,60,0.05) 100%)',
                backdropFilter: 'blur(0.1px)',
                border: '1px solid rgba(201,160,60,0.2)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span className="relative z-30">Log Workout</span>
            </button>
          </div>

          {/* Food logging method popup */}
          {showFoodMenu && (
            <>
              <div className="fixed inset-0 z-0" onClick={() => setShowFoodMenu(false)} />
              <div className="absolute bottom-full left-0 right-0 px-4 pb-2 z-20">
                <div
                  className="rounded-[16px] overflow-hidden"
                  style={{ background: 'rgba(60,50,35,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(201,160,60,0.3)' }}
                >
                  <button
                    type="button"
                    onClick={() => { setShowVoice(true); setShowFoodMenu(false) }}
                    className="w-full px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider flex items-center gap-3"
                    style={{ color: GOLD_BRIGHT, borderBottom: '1px solid rgba(201,160,60,0.15)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="1" width="6" height="12" rx="3" />
                      <path d="M19 10v2a7 7 0 01-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                    </svg>
                    Voice
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowTextLog(true); setShowFoodMenu(false) }}
                    className="w-full px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider flex items-center gap-3"
                    style={{ color: GOLD_BRIGHT, borderBottom: '1px solid rgba(201,160,60,0.15)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M8 16h8" />
                    </svg>
                    Type
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowQuickSelect(true); setShowFoodMenu(false) }}
                    className="w-full px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider flex items-center gap-3"
                    style={{ color: GOLD_BRIGHT }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                    </svg>
                    Quick Select
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* AI Coach */}
      <CoachPanel
        dayType={dayType}
        setDayType={setDayType}
        expanded={showCoach}
        onToggle={() => setShowCoach((prev) => !prev)}
        refreshLog={refreshLog}
        refreshWorkouts={refreshWorkouts}
        refreshWeight={refreshWeight}
        userId={userId!}
        selectedDate={selectedDate}
      />

      {/* Modals */}
      {showVoice && (
        <VoiceLogger
          userId={userId!}
          dayType={dayType}
          onComplete={handleLogComplete}
          onClose={() => setShowVoice(false)}
        />
      )}

      {showManualWeight && (
        <ManualWeightModal
          userId={userId!}
          onSaved={handleWeightSaved}
          onClose={() => setShowManualWeight(false)}
        />
      )}

      {showQuickSelect && (
        <QuickSelectModal
          userId={userId!}
          dayType={dayType}
          onComplete={handleLogComplete}
          onClose={() => setShowQuickSelect(false)}
        />
      )}

      {showTextLog && (
        <TextLogModal
          userId={userId!}
          dayType={dayType}
          onComplete={handleLogComplete}
          onClose={() => setShowTextLog(false)}
        />
      )}

      {showWorkout && (
        <WorkoutLogger
          userId={userId!}
          onComplete={() => { refreshWorkouts(); setShowWorkout(false) }}
          onClose={() => setShowWorkout(false)}
        />
      )}

      {editingWorkout && (
        <WorkoutEditModal
          workout={editingWorkout}
          onSaved={() => { refreshWorkouts(); setEditingWorkout(null) }}
          onDeleted={() => { refreshWorkouts(); setEditingWorkout(null) }}
          onClose={() => setEditingWorkout(null)}
        />
      )}

      {editingEntry && (
        <FoodEntryEditModal
          entry={editingEntry}
          onSaved={() => { refreshLog(); setEditingEntry(null) }}
          onDeleted={() => { refreshLog(); setEditingEntry(null) }}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  )
}
