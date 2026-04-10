'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WorkoutSession } from '@/types/database'

export function useTodayWorkouts(userId: string | null) {
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const startOfDay = `${today}T00:00:00`
    const endOfDay = `${today}T23:59:59`

    const { data } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('trained_at', startOfDay)
      .lte('trained_at', endOfDay)
      .order('trained_at', { ascending: true })

    setWorkouts(data || [])
    setLoading(false)
  }, [userId, today, supabase])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { workouts, loading, refresh }
}
