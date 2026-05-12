'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hourToMealLabel } from '@/lib/utils/meal-label'
import type { DayType } from '@/types/database'

interface CoachMessage {
  role: 'user' | 'assistant'
  content: string
}

interface CoachAction {
  type: string
  params: Record<string, unknown>
}

interface CoachPanelProps {
  dayType: DayType
  setDayType: (dt: DayType) => void
  expanded: boolean
  onToggle: () => void
  refreshLog: () => void
  refreshWorkouts: () => void
  refreshWeight: () => void
  userId: string
  selectedDate: string
}

function selectedDateNoon(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00-07:00`).toISOString()
}

export default function CoachPanel({
  dayType,
  setDayType,
  expanded,
  onToggle,
  refreshLog,
  refreshWorkouts,
  refreshWeight,
  userId,
  selectedDate,
}: CoachPanelProps) {
  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input when expanded
  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [expanded])

  function addMsg(content: string) {
    setMessages((prev) => [...prev, { role: 'assistant' as const, content }])
  }

  async function executeAction(action: CoachAction) {
    try {
      if (action.type === 'log_workout') {
        const params = action.params as { session_type: string; duration_min: number; notes: string }
        await supabase.from('workout_sessions').insert({
          user_id: userId,
          trained_at: selectedDateNoon(selectedDate),
          session_type: params.session_type,
          duration_min: params.duration_min,
          notes: params.notes || null,
        })
        refreshWorkouts()
        addMsg(`Logged ${params.session_type} workout (${params.duration_min} min).`)

      } else if (action.type === 'log_food') {
        const params = action.params as { description: string }
        const parseRes = await fetch('/api/claude/parse-meal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: params.description }),
        })
        if (!parseRes.ok) throw new Error('Failed to parse food')
        const parsed = await parseRes.json()
        await supabase.from('food_log_entries').insert({
          user_id: userId,
          logged_at: selectedDateNoon(selectedDate),
          meal_label: hourToMealLabel(new Date().getHours()),
          day_type: dayType,
          foods_json: parsed.foods,
          total_calories: parsed.total_calories,
          total_protein_g: parsed.total_protein_g,
          total_carbs_g: parsed.total_carbs_g,
          total_fat_g: parsed.total_fat_g,
          log_method: 'manual',
          raw_input_text: params.description,
        })
        refreshLog()
        addMsg(`Logged: ${params.description} (${parsed.total_calories} cal, ${parsed.total_protein_g}g protein).`)

      } else if (action.type === 'update_day_type') {
        const params = action.params as { day_type: DayType }
        setDayType(params.day_type)
        addMsg(`Day type updated to ${params.day_type}.`)

      } else if (action.type === 'edit_food_entry') {
        const params = action.params as { entry_id: string; mode: string; description?: string; scale_factor?: number }

        if (params.mode === 'reparse') {
          // Full re-parse: user changed what the food is
          const parseRes = await fetch('/api/claude/parse-meal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript: params.description }),
          })
          if (!parseRes.ok) throw new Error('Failed to parse food')
          const parsed = await parseRes.json()
          await supabase.from('food_log_entries').update({
            foods_json: parsed.foods,
            total_calories: parsed.total_calories,
            total_protein_g: parsed.total_protein_g,
            total_carbs_g: parsed.total_carbs_g,
            total_fat_g: parsed.total_fat_g,
            raw_input_text: params.description,
          }).eq('id', params.entry_id).eq('user_id', userId)
          refreshLog()
          addMsg(`Updated entry to: ${params.description} (${parsed.total_calories} cal).`)

        } else if (params.mode === 'scale') {
          // Portion scaling: multiply all macros by scale_factor
          const factor = params.scale_factor || 1
          const { data: entry } = await supabase
            .from('food_log_entries')
            .select('*')
            .eq('id', params.entry_id)
            .eq('user_id', userId)
            .single()
          if (!entry) throw new Error('Entry not found')

          const scaledFoods = (entry.foods_json as { name: string; qty: number; unit: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }[]).map((f) => ({
            ...f,
            qty: Math.round(f.qty * factor * 10) / 10,
            calories: Math.round(f.calories * factor),
            protein_g: Math.round(f.protein_g * factor * 10) / 10,
            carbs_g: Math.round(f.carbs_g * factor * 10) / 10,
            fat_g: Math.round(f.fat_g * factor * 10) / 10,
          }))
          const newCal = Math.round(entry.total_calories * factor)
          const newP = Math.round(entry.total_protein_g * factor * 10) / 10
          const newC = Math.round(entry.total_carbs_g * factor * 10) / 10
          const newF = Math.round(entry.total_fat_g * factor * 10) / 10

          await supabase.from('food_log_entries').update({
            foods_json: scaledFoods,
            total_calories: newCal,
            total_protein_g: newP,
            total_carbs_g: newC,
            total_fat_g: newF,
          }).eq('id', params.entry_id).eq('user_id', userId)
          refreshLog()
          addMsg(`Scaled entry by ${factor}x (now ${newCal} cal).`)
        }

      } else if (action.type === 'delete_food_entry') {
        const params = action.params as { entry_id: string }
        await supabase.from('food_log_entries').delete().eq('id', params.entry_id).eq('user_id', userId)
        refreshLog()
        addMsg('Food entry deleted.')

      } else if (action.type === 'edit_workout') {
        const params = action.params as { session_id: string; session_type?: string; duration_min?: number; notes?: string }
        const updates: Record<string, unknown> = {}
        if (params.session_type) updates.session_type = params.session_type
        if (params.duration_min != null) updates.duration_min = params.duration_min
        if (params.notes != null) updates.workout_notes = params.notes
        if (Object.keys(updates).length > 0) {
          await supabase.from('workout_sessions').update(updates).eq('id', params.session_id).eq('user_id', userId)
          refreshWorkouts()
          addMsg('Workout updated.')
        }

      } else if (action.type === 'delete_workout') {
        const params = action.params as { session_id: string }
        const { data: session } = await supabase
          .from('workout_sessions')
          .select('id')
          .eq('id', params.session_id)
          .eq('user_id', userId)
          .maybeSingle()
        if (!session) throw new Error('Workout not found')
        await supabase.from('workout_exercises').delete().eq('session_id', params.session_id)
        await supabase.from('workout_sessions').delete().eq('id', params.session_id).eq('user_id', userId)
        refreshWorkouts()
        addMsg('Workout deleted.')

      } else if (action.type === 'log_weight') {
        const params = action.params as { weight_lbs: number }
        await supabase.from('weight_readings').insert({
          user_id: userId,
          measured_at: selectedDateNoon(selectedDate),
          weight_lbs: params.weight_lbs,
          source: 'manual',
        })
        refreshWeight()
        addMsg(`Logged weight: ${params.weight_lbs} lbs.`)

      } else if (action.type === 'delete_weight') {
        const params = action.params as { reading_id: string }
        await supabase.from('weight_readings').delete().eq('id', params.reading_id).eq('user_id', userId)
        refreshWeight()
        addMsg('Weight reading deleted.')

      } else if (action.type === 'log_saved_meal') {
        const params = action.params as { meal_name: string; servings: number }
        const { data: meal } = await supabase
          .from('saved_meals')
          .select('*')
          .eq('user_id', userId)
          .ilike('name', params.meal_name)
          .limit(1)
          .single()
        if (!meal) throw new Error(`Saved meal "${params.meal_name}" not found`)

        const yieldSrv = meal.yield_servings || 1
        const ratio = (params.servings || 1) / yieldSrv
        const scaledFoods = (meal.foods_json as { name: string; qty: number; unit: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }[]).map((f) => ({
          ...f,
          qty: Math.round(f.qty * ratio * 10) / 10,
          calories: Math.round(f.calories * ratio),
          protein_g: Math.round(f.protein_g * ratio * 10) / 10,
          carbs_g: Math.round(f.carbs_g * ratio * 10) / 10,
          fat_g: Math.round(f.fat_g * ratio * 10) / 10,
        }))
        const portionCal = Math.round(meal.total_calories * ratio)

        await supabase.from('food_log_entries').insert({
          user_id: userId,
          logged_at: selectedDateNoon(selectedDate),
          meal_label: meal.tags?.[0] || 'snack',
          day_type: dayType,
          foods_json: scaledFoods,
          total_calories: portionCal,
          total_protein_g: Math.round(meal.total_protein_g * ratio * 10) / 10,
          total_carbs_g: Math.round(meal.total_carbs_g * ratio * 10) / 10,
          total_fat_g: Math.round(meal.total_fat_g * ratio * 10) / 10,
          log_method: 'quick',
        })

        await supabase.from('saved_meals').update({
          times_logged: (meal.times_logged || 0) + 1,
          last_logged_at: selectedDateNoon(selectedDate),
        }).eq('id', meal.id).eq('user_id', userId)

        refreshLog()
        addMsg(`Logged ${params.servings} serving(s) of "${meal.name}" (${portionCal} cal).`)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Action failed'
      addMsg(`Action failed: ${errMsg}`)
    }
  }

  async function sendMessage() {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
    setLoading(true)

    try {
      const res = await fetch('/api/claude/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          conversation_history: messages,
          day_type: dayType,
          current_time_iso: selectedDateNoon(selectedDate),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Coach request failed')
      }

      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }])

      // Execute action if present
      if (data.action) {
        await executeAction(data.action)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to get response'
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${errMsg}` }])
    } finally {
      setLoading(false)
    }
  }

  // Collapsed: small tab at bottom-left
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="fixed bottom-20 left-4 z-40 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider shadow-lg"
        style={{
          color: '#be9424',
          background: 'linear-gradient(145deg, rgba(201,160,60,0.12) 0%, rgba(255,255,255,0.04) 100%)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(201,160,60,0.3)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.3)',
        }}
      >
        Coach
      </button>
    )
  }

  // Expanded: panel covering bottom 60%
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl shadow-2xl"
      style={{
        height: '60vh',
        background: 'rgba(255,253,249,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(201,160,60,0.3)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(201,160,60,0.2)' }}>
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#a47c16' }}>AI Coach</h3>
        <button type="button" onClick={onToggle} className="hover:opacity-70 transition-opacity" style={{ color: '#a47c16' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-center mt-8" style={{ color: 'rgba(70,48,12,0.4)' }}>
            Ask anything about your nutrition, workouts, or progress.
          </p>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`text-sm ${
              msg.role === 'user'
                ? 'text-right'
                : 'text-left'
            }`}
          >
            <span
              className="inline-block max-w-[85%] rounded-lg px-3 py-2"
              style={msg.role === 'user'
                ? { background: 'rgba(201,160,60,0.12)', border: '1px solid rgba(201,160,60,0.25)', color: '#3d3225' }
                : { background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.3)', color: '#5a4a32' }
              }
            >
              {msg.content}
            </span>
          </div>
        ))}
        {loading && (
          <div className="text-left">
            <span className="inline-block rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.3)' }}>
              <span className="flex items-center gap-2 text-sm" style={{ color: 'rgba(70,48,12,0.5)' }}>
                <span className="h-3 w-3 animate-spin rounded-full border-2" style={{ borderColor: 'rgba(164,124,22,0.2)', borderTopColor: '#a47c16' }} />
                Thinking...
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid rgba(201,160,60,0.2)' }}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Ask your coach..."
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1"
            style={{
              background: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(201,160,60,0.2)',
              color: '#3d3225',
              '--tw-ring-color': 'rgba(164,124,22,0.4)',
            } as React.CSSProperties}
            disabled={loading}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:opacity-80 transition-opacity"
            style={{
              background: 'linear-gradient(145deg, #c9a03c, #a47c16)',
              color: '#fff',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
