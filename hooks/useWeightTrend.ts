'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WeightReading } from '@/types/database'

export function useWeightTrend(userId: string | null) {
  const [readings, setReadings] = useState<WeightReading[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data } = await supabase
      .from('weight_readings')
      .select('*')
      .eq('user_id', userId)
      .gte('measured_at', sevenDaysAgo.toISOString())
      .order('measured_at', { ascending: true })

    setReadings(data || [])
    setLoading(false)
  }, [userId, supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  const latest = readings.length > 0 ? readings[readings.length - 1] : null

  const chartData = readings.map((r) => ({
    date: new Date(r.measured_at).toLocaleDateString('en-US', { weekday: 'short' }),
    weight: Number(r.weight_lbs),
  }))

  return { readings, latest, chartData, loading, refresh }
}
