'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildFavorites, emptyFavorites, type Favorites } from '@/lib/favorites'
import type { FoodItem, FoodLogEntry } from '@/types/database'

export function useDailyLog(userId: string | null, dateStr?: string) {
  const [entries, setEntries] = useState<FoodLogEntry[]>([])
  const [favorites, setFavorites] = useState<Favorites>(emptyFavorites())
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const today = dateStr || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const startOfDay = `${today}T00:00:00`
    const endOfDay = `${today}T23:59:59`

    // Op FASTRAK Alpha.6 Sub-fix F — fetch entries + favorites in parallel.
    // Favorites Set drives per-food heart state in TodayLog (rendered cards).
    const [entriesRes, favsRes] = await Promise.all([
      supabase
        .from('food_log_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', startOfDay)
        .lte('logged_at', endOfDay)
        .order('logged_at', { ascending: true }),
      supabase
        .from('saved_meals')
        .select('id, name, foods_json')
        .eq('user_id', userId)
        .eq('is_favorite', true),
    ])

    setEntries(entriesRes.data || [])
    setFavorites(
      buildFavorites(
        (favsRes.data ?? []) as Array<{ id: string; name: string | null; foods_json: FoodItem[] | null }>,
      ),
    )
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

  return { entries, totals, favorites, loading, refresh, deleteEntry }
}
