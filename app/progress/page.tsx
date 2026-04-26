'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import GlassPanel from '@/components/ui/GlassPanel'
import MarbleBackground from '@/components/ui/MarbleBackground'
import DayDetailPanel from '@/components/progress/DayDetailPanel'
import Link from 'next/link'

const GOLD = '#a47c16'
const GOLD_LIGHT = '#c9a03c'
const TEXT_DARK = '#3d3225'
const TEXT_MID = '#5a4a32'

const SLOT_WIDTH = 74
const VISIBLE_DAYS = 90

const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short' })

function getTodayLA(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}

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

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function toIsoDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Oldest first: index 0 = VISIBLE_DAYS-1 days ago, last index = today */
function generateDates(): string[] {
  const dates: string[] = []
  const today = getTodayLA()
  for (let i = VISIBLE_DAYS - 1; i >= 0; i--) {
    const d = new Date(`${today}T12:00:00`)
    d.setDate(d.getDate() - i)
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return dates
}

const WORKOUT_COLORS: Record<string, string> = {
  zone2: '#4a9e5e',
  lift: '#7e57c2',
  bjj: '#d4a017',
  other: GOLD_LIGHT,
}

function CalorieBars({ dates, calByDay, selectedDate }: { dates: string[]; calByDay: Record<string, number>; selectedDate: string }) {
  const window14 = dates.slice(-14)
  const values = window14.map(d => calByDay[d] || 0)
  const max = Math.max(...values, 1)
  const barW = 100 / 14
  const gap = 1

  return (
    <svg width={100} height={48} className="block">
      {window14.map((date, i) => {
        const val = values[i]
        const h = Math.max((val / max) * 44, val > 0 ? 2 : 0)
        const isSelected = date === selectedDate
        return (
          <rect
            key={date}
            x={i * barW + gap / 2}
            y={48 - h}
            width={barW - gap}
            height={h}
            rx={1}
            fill={GOLD_LIGHT}
            opacity={isSelected ? 1 : 0.3}
          />
        )
      })}
    </svg>
  )
}

function WorkoutBars({ dates, workoutByDay, selectedDate }: { dates: string[]; workoutByDay: Record<string, string[]>; selectedDate: string }) {
  const window14 = dates.slice(-14)
  const barW = 100 / 14
  const gap = 1

  return (
    <svg width={100} height={48} className="block">
      {window14.map((date, i) => {
        const sessions = workoutByDay[date] || []
        if (sessions.length === 0) return null
        const color = WORKOUT_COLORS[sessions[0]] || WORKOUT_COLORS.other
        const isSelected = date === selectedDate
        return (
          <rect
            key={date}
            x={i * barW + gap / 2}
            y={4}
            width={barW - gap}
            height={44}
            rx={1}
            fill={color}
            opacity={isSelected ? 1 : 0.3}
          />
        )
      })}
    </svg>
  )
}

function WeightLine({ data, selectedDate }: { data: { isoDate: string; weight: number }[]; selectedDate: string }) {
  if (data.length < 2) return null
  const weights = data.map(d => d.weight)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = max - min || 1
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100
    const y = 48 - ((d.weight - min) / range) * 44 - 2
    return { x, y, isoDate: d.isoDate }
  })

  const polyPoints = points.map(p => `${p.x},${p.y}`).join(' ')
  const highlight = points.find(p => p.isoDate === selectedDate)

  return (
    <svg width={100} height={48} className="block">
      <polyline
        points={polyPoints}
        fill="none"
        stroke={GOLD_LIGHT}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {highlight && (
        <circle cx={highlight.x} cy={highlight.y} r={3.5} fill={GOLD} stroke="white" strokeWidth={1.5} />
      )}
    </svg>
  )
}

export default function ProgressPage() {
  const router = useRouter()
  const { user, userId, loading: userLoading } = useUser()

  const [selectedDate, setSelectedDate] = useState(getTodayLA)
  const [sparkWeights, setSparkWeights] = useState<{ date: string; weight: number; isoDate: string }[]>([])
  const [calByDay, setCalByDay] = useState<Record<string, number>>({})
  const [workoutByDay, setWorkoutByDay] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  // Wheel drag state
  const [isDragging, setIsDragging] = useState(false)
  const [wheelDragOffset, setWheelDragOffset] = useState(0)
  const dragStartX = useRef(0)
  const dragStartIndex = useRef(0)
  const wheelDragOffsetRef = useRef(0)
  const hasDragged = useRef(false)
  const wheelRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()
  const dates = useRef(generateDates()).current

  const selectedIndex = dates.indexOf(selectedDate)
  const effectiveIndex = selectedIndex >= 0 ? selectedIndex : dates.length - 1

  // Visual center during drag (float)
  const visualCenter = isDragging
    ? dragStartIndex.current - wheelDragOffset / SLOT_WIDTH
    : effectiveIndex

  // Fetch 90-day data for sparklines + weight trend
  useEffect(() => {
    if (!userId) return
    setLoading(true)

    const since = daysAgo(VISIBLE_DAYS)

    async function fetchAll() {
      const [weights, foodLogs, workouts] = await Promise.all([
        supabase
          .from('weight_readings')
          .select('measured_at, weight_lbs')
          .eq('user_id', userId!)
          .gte('measured_at', since)
          .order('measured_at', { ascending: true }),
        supabase
          .from('food_log_entries')
          .select('logged_at, total_calories')
          .eq('user_id', userId!)
          .gte('logged_at', since)
          .order('logged_at', { ascending: true }),
        supabase
          .from('workout_sessions')
          .select('trained_at, session_type')
          .eq('user_id', userId!)
          .gte('trained_at', since)
          .order('trained_at', { ascending: true }),
      ])

      if (weights.data) {
        const wData = weights.data as { measured_at: string; weight_lbs: number }[]
        setSparkWeights(wData.map(w => ({
          date: formatDate(w.measured_at),
          weight: Number(w.weight_lbs),
          isoDate: toIsoDate(w.measured_at),
        })))
      }

      if (foodLogs.data) {
        const fData = foodLogs.data as { logged_at: string; total_calories: number }[]
        const byDay: Record<string, number> = {}
        for (const entry of fData) {
          const day = toIsoDate(entry.logged_at)
          byDay[day] = (byDay[day] || 0) + entry.total_calories
        }
        setCalByDay(byDay)
      }

      if (workouts.data) {
        const wData = workouts.data as { trained_at: string; session_type: string }[]
        const byDay: Record<string, string[]> = {}
        for (const w of wData) {
          const day = toIsoDate(w.trained_at)
          if (!byDay[day]) byDay[day] = []
          byDay[day].push(w.session_type)
        }
        setWorkoutByDay(byDay)
      }

      setLoading(false)
    }

    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Wheel drag: document-level listeners while dragging
  useEffect(() => {
    if (!isDragging) return

    function onMove(e: PointerEvent) {
      const delta = e.clientX - dragStartX.current
      if (Math.abs(delta) > 5) hasDragged.current = true
      wheelDragOffsetRef.current = delta
      setWheelDragOffset(delta)
    }

    function onUp(e: PointerEvent) {
      if (!hasDragged.current) {
        // Tap: calculate which date was tapped from pointer position
        const rect = wheelRef.current?.getBoundingClientRect()
        if (rect) {
          const centerX = rect.left + rect.width / 2
          const slotsFromCenter = Math.round((e.clientX - centerX) / SLOT_WIDTH)
          const tappedIndex = Math.max(0, Math.min(dates.length - 1, dragStartIndex.current + slotsFromCenter))
          setSelectedDate(dates[tappedIndex])
        }
      } else {
        // Drag: snap to nearest (Amendment 7)
        const delta = wheelDragOffsetRef.current
        const newIndex = Math.max(0, Math.min(dates.length - 1,
          dragStartIndex.current - Math.round(delta / SLOT_WIDTH)
        ))
        setSelectedDate(dates[newIndex])
      }

      wheelDragOffsetRef.current = 0
      setWheelDragOffset(0)
      setIsDragging(false)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging])

  function handleWheelPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    dragStartX.current = e.clientX
    dragStartIndex.current = effectiveIndex
    hasDragged.current = false
    wheelDragOffsetRef.current = 0
    setWheelDragOffset(0)
    setIsDragging(true)
  }

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

  // Wheel transform: center selected slot using left:50% + translateX
  const wheelTranslateX = -(effectiveIndex * SLOT_WIDTH + SLOT_WIDTH / 2) + wheelDragOffset

  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: '#eae5de' }}>
      <MarbleBackground />

      {/* Sticky Nav */}
      <div
        className="sticky top-0 z-50 flex justify-between items-center px-4 py-3"
        style={{ backgroundColor: 'rgba(234,229,222,0.95)' }}
      >
        <span
          className="text-[11px] uppercase tracking-[0.15em] font-semibold opacity-100"
          style={{ color: TEXT_DARK }}
        >
          PROGRESS
        </span>
        <Link
          href="/dashboard"
          className="text-[11px] uppercase tracking-[0.15em] font-semibold opacity-100 hover:opacity-70 transition-opacity"
          style={{ color: GOLD_LIGHT }}
        >
          &larr; PANTHEON
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: 'rgba(164,124,22,0.2)', borderTopColor: GOLD }} />
        </div>
      ) : (
        <div className="space-y-4 px-4">
          {/* Overview Strip */}
          <GlassPanel className="p-4">
            <div className="grid grid-cols-3 relative">
              <div className="text-center px-2">
                <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: TEXT_MID }}>Calories</p>
                <div className="flex justify-center mb-2">
                  <CalorieBars dates={dates} calByDay={calByDay} selectedDate={selectedDate} />
                </div>
                <p className="text-sm font-bold" style={{ color: GOLD }}>
                  {calByDay[selectedDate] ? Math.round(calByDay[selectedDate]).toLocaleString() : '\u2014'}
                </p>
              </div>
              <div className="absolute top-0 bottom-0 left-1/3 w-px" style={{ backgroundColor: 'rgba(164,124,22,0.15)' }} />
              <div className="text-center px-2">
                <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: TEXT_MID }}>Workouts</p>
                <div className="flex justify-center mb-2">
                  <WorkoutBars dates={dates} workoutByDay={workoutByDay} selectedDate={selectedDate} />
                </div>
                <p className="text-sm font-bold" style={{ color: GOLD }}>
                  {Object.values(workoutByDay).reduce((sum, arr) => sum + arr.length, 0)}
                </p>
              </div>
              <div className="absolute top-0 bottom-0 left-2/3 w-px" style={{ backgroundColor: 'rgba(164,124,22,0.15)' }} />
              <div className="text-center px-2">
                <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: TEXT_MID }}>Weight</p>
                <div className="flex justify-center mb-2">
                  <WeightLine data={sparkWeights} selectedDate={selectedDate} />
                </div>
                <p className="text-sm font-bold" style={{ color: GOLD }}>
                  {sparkWeights.length > 0 ? sparkWeights[sparkWeights.length - 1].weight.toFixed(1) : '\u2014'}
                </p>
              </div>
            </div>
          </GlassPanel>

          {/* Roman Wheel */}
          <GlassPanel className="py-3">
            <div
              ref={wheelRef}
              className="relative h-[72px] touch-none select-none cursor-grab active:cursor-grabbing overflow-hidden"
              onPointerDown={handleWheelPointerDown}
            >
              <div
                className="absolute top-0 h-full flex items-center"
                style={{
                  left: '50%',
                  transform: `translateX(${wheelTranslateX}px)`,
                  transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.25,0.8,0.25,1)',
                }}
              >
                {dates.map((date, i) => {
                  const dist = Math.abs(i - visualCenter)
                  const fontSize = dist < 0.5 ? 20 : dist < 1.5 ? 14 : 12
                  const opacity = dist < 0.5 ? 1 : dist < 1.5 ? 0.7 : dist < 2.5 ? 0.4 : 0.25
                  const isCenter = dist < 0.5
                  const d = new Date(`${date}T12:00:00`)
                  const dayNum = d.getDate()
                  const month = monthFmt.format(d)

                  return (
                    <div
                      key={date}
                      className="flex flex-col items-center justify-center shrink-0"
                      style={{
                        width: SLOT_WIDTH,
                        opacity,
                        transition: isDragging ? 'none' : 'opacity 0.22s ease',
                      }}
                    >
                      <span
                        className="font-bold tracking-wide"
                        style={{
                          fontSize,
                          color: isCenter ? GOLD : TEXT_DARK,
                          transition: isDragging ? 'none' : 'font-size 0.22s ease, color 0.22s ease',
                          fontFamily: 'var(--font-cinzel), serif',
                        }}
                      >
                        {toRoman(dayNum)}
                      </span>
                      <span
                        className="text-[10px] uppercase tracking-wider mt-0.5"
                        style={{ color: TEXT_MID, opacity: isCenter ? 1 : 0.6 }}
                      >
                        {month}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Center indicator line */}
              <div
                className="absolute top-0 bottom-0 left-1/2 w-[2px] -translate-x-1/2 pointer-events-none"
                style={{ background: `linear-gradient(to bottom, transparent, ${GOLD_LIGHT}, transparent)` }}
              />
            </div>
          </GlassPanel>

          {/* Day Detail Panels */}
          <DayDetailPanel
            selectedDate={selectedDate}
            userId={userId!}
            weightTrendData={sparkWeights}
          />
        </div>
      )}
    </div>
  )
}
