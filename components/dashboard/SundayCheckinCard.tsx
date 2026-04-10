'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SundayCheckinCardProps {
  userId: string
}

export default function SundayCheckinCard({ userId }: SundayCheckinCardProps) {
  const [visible, setVisible] = useState(false)
  const [tdeeMessage, setTdeeMessage] = useState<string | null>(null)
  const [dismissing, setDismissing] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      // Check if today is Sunday in LA timezone
      const isSunday =
        new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          timeZone: 'America/Los_Angeles',
        }).format(new Date()) === 'Sunday'

      if (!isSunday) return

      // Get this week's Monday
      const now = new Date()
      const dayOfWeek = now.getDay() // 0=Sunday
      const monday = new Date(now)
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      const weekOf = monday.toISOString().split('T')[0]

      // Check if already dismissed this week
      const { data: existing } = await supabase
        .from('weekly_checkins')
        .select('id')
        .eq('user_id', userId)
        .eq('week_of', weekOf)
        .limit(1)

      if (existing && existing.length > 0) return

      // Check TDEE readiness: 14 weight readings + 10 distinct food log days
      const [{ count: weightCount }, { data: foodData }] = await Promise.all([
        supabase
          .from('weight_readings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('food_log_entries')
          .select('logged_at')
          .eq('user_id', userId),
      ])

      const distinctDates = new Set(
        (foodData || []).map((e: { logged_at: string }) =>
          new Date(e.logged_at).toLocaleDateString('en-US', {
            timeZone: 'America/Los_Angeles',
          })
        )
      )

      const tdeeReady = (weightCount || 0) >= 14 && distinctDates.size >= 10

      if (tdeeReady) {
        // Fetch data for TDEE computation
        const [{ data: weights }, { data: entries }] = await Promise.all([
          supabase
            .from('weight_readings')
            .select('*')
            .eq('user_id', userId)
            .order('measured_at', { ascending: false })
            .limit(14),
          supabase
            .from('food_log_entries')
            .select('total_calories, logged_at')
            .eq('user_id', userId),
        ])

        if (weights && weights.length >= 3 && entries) {
          const dates = new Set(
            entries.map((e: { logged_at: string }) =>
              new Date(e.logged_at).toLocaleDateString('en-US', {
                timeZone: 'America/Los_Angeles',
              })
            )
          )
          const totalCal = entries.reduce(
            (s: number, e: { total_calories: number }) => s + (e.total_calories || 0),
            0
          )
          const avgCal = Math.round(totalCal / dates.size)

          const sorted = [...weights].sort(
            (a, b) =>
              new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime()
          )
          const oldest = sorted[0]
          const newest = sorted[sorted.length - 1]
          const daysBetween =
            (new Date(newest.measured_at).getTime() -
              new Date(oldest.measured_at).getTime()) /
            (1000 * 60 * 60 * 24)
          const weeksBetween = daysBetween / 7
          const lbsPerWeek =
            daysBetween > 0
              ? (Number(oldest.weight_lbs) - Number(newest.weight_lbs)) / weeksBetween
              : 0
          const tdee = Math.round(avgCal + lbsPerWeek * 500)

          setTdeeMessage(
            `Estimated TDEE: ${tdee} cal/day (avg intake: ${avgCal} cal, loss rate: ${lbsPerWeek.toFixed(1)} lbs/week). ${
              lbsPerWeek >= 1.0 && lbsPerWeek <= 1.5
                ? 'On track — keep current targets.'
                : lbsPerWeek < 1.0
                  ? 'Losing slower than target. Consider reducing calories by 100.'
                  : 'Losing faster than target. Consider adding 100 calories to protect muscle.'
            }`
          )
        }
      } else {
        setTdeeMessage(
          'Keep logging daily — TDEE estimate available after 14 weight readings and 10 days of food logging.'
        )
      }

      setVisible(true)
    }

    check()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function handleDismiss() {
    setDismissing(true)

    const now = new Date()
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    const weekOf = monday.toISOString().split('T')[0]

    await supabase.from('weekly_checkins').upsert(
      {
        user_id: userId,
        week_of: weekOf,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,week_of' }
    )

    setVisible(false)
    setDismissing(false)
  }

  if (!visible) return null

  return (
    <div className="rounded-2xl bg-amber-900/20 border border-amber-800/40 p-5">
      <h3 className="text-sm font-semibold text-amber-400 mb-2">Weekly Check-in</h3>
      {tdeeMessage && (
        <p className="text-sm text-gray-300 mb-3">{tdeeMessage}</p>
      )}
      <button
        type="button"
        onClick={handleDismiss}
        disabled={dismissing}
        className="w-full rounded-lg bg-amber-600 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
      >
        {dismissing ? 'Saving...' : 'Got it — dismiss'}
      </button>
    </div>
  )
}
