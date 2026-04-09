'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FoodLogEntry } from '@/types/database'

export function useDailyLog(userId: string | null) {
  const [entries, setEntries] = useState<FoodLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const today = new Date().toISOString().split('T')[0]

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const startOfDay = `${today}T00:00:00`
    const endOfDay = `${today}T23:59:59`

    const { data } = await supabase
      .from('food_log_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', startOfDay)
      .lte('logged_at', endOfDay)
      .order('logged_at', { ascending: true })

    setEntries(data || [])
    setLoading(false)
  }, [userId, today, supabase])

  useEffect(() => {
    refresh()
  }, [refresh])

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.total_calories || 0),
      protein: acc.protein + (e.total_protein_g || 0),
      carbs: acc.carbs + (e.total_carbs_g || 0),
      fat: acc.fat + (e.total_fat_g || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  async function deleteEntry(id: string) {
    await supabase.from('food_log_entries').delete().eq('id', id)
    await refresh()
  }

  return { entries, totals, loading, refresh, deleteEntry }
}
