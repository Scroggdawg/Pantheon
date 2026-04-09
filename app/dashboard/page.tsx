'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/hooks/useUser'
import { useDailyLog } from '@/hooks/useDailyLog'
import { useWeightTrend } from '@/hooks/useWeightTrend'
import DayTypeToggle from '@/components/dashboard/DayTypeToggle'
import CaloriesRemainingCard from '@/components/dashboard/CaloriesRemainingCard'
import MacroBars from '@/components/dashboard/MacroBars'
import WeightCard from '@/components/dashboard/WeightCard'
import TodayLog from '@/components/dashboard/TodayLog'
import LogFAB from '@/components/dashboard/LogFAB'
import { VoiceLogger } from '@/components/logging/VoiceLogger'
import { ManualWeightModal } from '@/components/logging/ManualWeightModal'
import { QuickSelectModal } from '@/components/logging/QuickSelectModal'
import { TextLogModal } from '@/components/logging/TextLogModal'
import { WorkoutLogger } from '@/components/logging/WorkoutLogger'
import { DAY_TYPE_ADJUSTMENTS } from '@/types/database'
import type { DayType } from '@/types/database'

export default function DashboardPage() {
  const router = useRouter()
  const { user, userId, loading: userLoading } = useUser()
  const { entries, totals, loading: logLoading, refresh: refreshLog, deleteEntry } = useDailyLog(userId)
  const { latest, chartData, loading: weightLoading, refresh: refreshWeight } = useWeightTrend(userId)

  const [dayType, setDayType] = useState<DayType>('zone2')
  const [showVoice, setShowVoice] = useState(false)
  const [showManualWeight, setShowManualWeight] = useState(false)
  const [showQuickSelect, setShowQuickSelect] = useState(false)
  const [showTextLog, setShowTextLog] = useState(false)
  const [showWorkout, setShowWorkout] = useState(false)

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

  const adj = DAY_TYPE_ADJUSTMENTS[dayType]
  const calorieTarget = (user.base_calories_target || 2250) + adj.calories
  const proteinTarget = user.base_protein_g || 200
  const carbsTarget = (user.base_carbs_g || 160) + adj.carbs_g
  const fatTarget = user.base_fat_g || 90

  const remaining = calorieTarget - totals.calories

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">PANTHEON</h1>
            <p className="text-sm text-gray-400">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/progress" className="text-sm text-blue-400 hover:text-blue-300 font-medium">
              Progress
            </Link>
            <span className="text-sm text-gray-500">{user.name}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4">
        {/* Day Type Toggle */}
        <DayTypeToggle value={dayType} onChange={setDayType} />

        {/* Calories Remaining */}
        <CaloriesRemainingCard
          remaining={remaining}
          target={calorieTarget}
          consumed={totals.calories}
        />

        {/* Macro Bars */}
        <MacroBars
          protein={{ current: totals.protein, target: proteinTarget }}
          carbs={{ current: totals.carbs, target: carbsTarget }}
          fat={{ current: totals.fat, target: fatTarget }}
        />

        {/* Weight Card */}
        <WeightCard
          latestWeight={latest ? Number(latest.weight_lbs) : null}
          readings={chartData}
          lastSynced={latest?.measured_at || null}
          onSync={async () => {
            const res = await fetch('/api/wyze/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: userId }),
            })
            const data = await res.json()
            if (data.error) return { error: data.error }
            refreshWeight()
            return { success: true }
          }}
          onManualEntry={() => setShowManualWeight(true)}
        />

        {/* Log Workout Button */}
        <button
          onClick={() => setShowWorkout(true)}
          className="w-full rounded-2xl bg-gray-900 p-4 text-left hover:bg-gray-800/80 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Log Workout</p>
              <p className="text-sm text-gray-400">Describe your session and AI will parse it</p>
            </div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </button>

        {/* Today's Food Log */}
        <div className="rounded-2xl bg-gray-900 p-6">
          <h2 className="mb-4 text-lg font-semibold">Today&apos;s Log</h2>
          <TodayLog userId={userId!} entries={entries} onDelete={deleteEntry} onUpdate={refreshLog} />
        </div>
      </div>

      {/* Floating Action Button */}
      <LogFAB
        onVoice={() => setShowVoice(true)}
        onCamera={() => {/* Phase 2 */}}
        onType={() => setShowTextLog(true)}
        onQuickSelect={() => setShowQuickSelect(true)}
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
          onComplete={() => setShowWorkout(false)}
          onClose={() => setShowWorkout(false)}
        />
      )}
    </div>
  )
}
