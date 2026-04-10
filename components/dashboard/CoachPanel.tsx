'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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
}

export default function CoachPanel({
  dayType,
  setDayType,
  expanded,
  onToggle,
  refreshLog,
  refreshWorkouts,
  userId,
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

  async function executeAction(action: CoachAction) {
    try {
      if (action.type === 'log_workout') {
        const params = action.params as {
          session_type: string
          duration_min: number
          notes: string
        }
        await supabase.from('workout_sessions').insert({
          user_id: userId,
          trained_at: new Date().toISOString(),
          session_type: params.session_type,
          duration_min: params.duration_min,
          notes: params.notes || null,
        })
        refreshWorkouts()
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Logged ${params.session_type} workout (${params.duration_min} min).` },
        ])
      } else if (action.type === 'log_food') {
        const params = action.params as { description: string }
        // Parse food via Claude
        const parseRes = await fetch('/api/claude/parse-meal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: params.description }),
        })
        if (!parseRes.ok) throw new Error('Failed to parse food')
        const parsed = await parseRes.json()

        // Insert into food log
        await supabase.from('food_log_entries').insert({
          user_id: userId,
          logged_at: new Date().toISOString(),
          meal_label: parsed.meal_label,
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
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Logged: ${params.description} (${parsed.total_calories} cal, ${parsed.total_protein_g}g protein).` },
        ])
      } else if (action.type === 'update_day_type') {
        const params = action.params as { day_type: DayType }
        setDayType(params.day_type)
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Day type updated to ${params.day_type}.` },
        ])
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Action failed'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Action failed: ${errMsg}` },
      ])
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
          current_time_iso: new Date().toISOString(),
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
        className="fixed bottom-6 left-6 z-40 rounded-full bg-amber-600 px-4 py-2 text-sm font-medium shadow-lg hover:bg-amber-700"
      >
        Coach
      </button>
    )
  }

  // Expanded: panel covering bottom 60%
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-gray-900 border-t border-gray-800 rounded-t-2xl shadow-2xl" style={{ height: '60vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <h3 className="text-sm font-semibold">AI Coach</h3>
        <button type="button" onClick={onToggle} className="text-gray-400 hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500 text-center mt-8">
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
              className={`inline-block max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-amber-600/20 text-gray-200'
                  : 'bg-gray-800 text-gray-300'
              }`}
            >
              {msg.content}
            </span>
          </div>
        ))}
        {loading && (
          <div className="text-left">
            <span className="inline-block rounded-lg bg-gray-800 px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-gray-500">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-amber-500" />
                Thinking...
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-800 px-4 py-3">
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
            className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-amber-600"
            disabled={loading}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
