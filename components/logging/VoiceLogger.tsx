'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVoiceCorrections } from '@/hooks/useVoiceCorrections'
import { SaveMealModal } from './SaveMealModal'
import type { ParsedMealResponse, FoodItem, DayType } from '@/types/database'

interface Props {
  userId: string
  dayType: DayType
  onComplete: () => void
  onClose: () => void
}

type Stage = 'listening' | 'editing' | 'processing' | 'confirming' | 'saving' | 'done'

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.5)',
  border: '1px solid rgba(201,160,60,0.25)',
  color: '#3d3225',
}

export function VoiceLogger({ userId, dayType, onComplete, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('listening')
  const [transcript, setTranscript] = useState('')
  const [editedTranscript, setEditedTranscript] = useState('')
  const [parsed, setParsed] = useState<ParsedMealResponse | null>(null)
  const [editedFoods, setEditedFoods] = useState<FoodItem[]>([])
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [showSaveMeal, setShowSaveMeal] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const transcriptRef = useRef('')
  const supabase = createClient()
  const { processTranscript } = useVoiceCorrections(userId)

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
  }, [])

  const goToEditing = useCallback(() => {
    stopListening()
    setEditedTranscript(transcriptRef.current)
    setStage('editing')
  }, [stopListening])

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        } else {
          interimTranscript += event.results[i][0].transcript
        }
      }

      const combined = finalTranscript + interimTranscript
      transcriptRef.current = combined
      setTranscript(combined)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech') {
        setError(`Speech error: ${event.error}`)
      }
    }

    recognition.onend = () => {
      // Browser may stop recognition on its own — restart if still in listening stage
      // Only go to editing if user explicitly clicked "Done speaking" (which calls goToEditing)
      if (recognitionRef.current === recognition) {
        try { recognition.start() } catch { /* already stopped by user */ }
      }
    }

    recognition.start()

    return () => {
      recognitionRef.current = null
      recognition.stop()
    }
  }, [])

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleParseMeal() {
    const text = editedTranscript.trim()
    if (!text) return
    setStage('processing')
    setError('')

    try {
      // Process corrections
      const { cleanedTranscript, newCorrections, appliedCorrections } = await processTranscript(text)

      // Show toast for learned corrections
      const messages: string[] = []
      if (newCorrections.length > 0) {
        messages.push(`Learned: ${newCorrections.map((c) => `"${c.heard}" → "${c.corrected}"`).join(', ')}`)
      }
      if (appliedCorrections.length > 0) {
        messages.push(`Auto-corrected: ${appliedCorrections.map((c) => `"${c.heard}" → "${c.corrected}"`).join(', ')}`)
      }
      if (messages.length > 0) showToast(messages.join(' | '))

      // Send cleaned transcript to Claude
      const res = await fetch('/api/claude/parse-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: cleanedTranscript }),
      })

      if (!res.ok) throw new Error('Parse failed')

      const data: ParsedMealResponse = await res.json()
      setParsed(data)
      setEditedFoods(data.foods)
      setStage('confirming')
    } catch {
      setError('Failed to parse meal. Try again.')
      setStage('editing')
    }
  }

  async function handleConfirm() {
    if (!parsed) return
    setStage('saving')

    const totals = editedFoods.reduce(
      (acc, f) => ({
        calories: acc.calories + f.calories,
        protein: acc.protein + f.protein_g,
        carbs: acc.carbs + f.carbs_g,
        fat: acc.fat + f.fat_g,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )

    const { error } = await supabase.from('food_log_entries').insert({
      user_id: userId,
      meal_label: parsed.meal_label,
      day_type: dayType,
      foods_json: editedFoods,
      total_calories: totals.calories,
      total_protein_g: totals.protein,
      total_carbs_g: totals.carbs,
      total_fat_g: totals.fat,
      log_method: 'voice',
      raw_input_text: transcript,
      claude_parse_json: parsed,
    })

    if (error) {
      setError('Failed to save. Try again.')
      setStage('confirming')
      return
    }

    setStage('done')
  }

  function updateFoodQty(index: number, newQty: number) {
    setEditedFoods((prev) =>
      prev.map((food, i) => {
        if (i !== index) return food
        const ratio = newQty / food.qty
        return {
          ...food,
          qty: newQty,
          calories: Math.round(food.calories * ratio),
          protein_g: Math.round(food.protein_g * ratio * 10) / 10,
          carbs_g: Math.round(food.carbs_g * ratio * 10) / 10,
          fat_g: Math.round(food.fat_g * ratio * 10) / 10,
        }
      })
    )
  }

  function removeFood(index: number) {
    setEditedFoods((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div
        className="w-full max-w-lg rounded-t-2xl p-6 sm:rounded-2xl"
        style={{ background: 'rgba(255,253,249,0.95)', border: '1px solid rgba(201,160,60,0.2)' }}
      >
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] max-w-sm rounded-lg bg-green-800 px-4 py-2 text-sm text-green-100 shadow-lg">
            {toast}
          </div>
        )}

        {/* Close button */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: '#3d3225' }}>
            {stage === 'listening' && 'Listening...'}
            {stage === 'editing' && 'Edit transcript'}
            {stage === 'processing' && 'Parsing meal...'}
            {stage === 'confirming' && 'Confirm meal'}
            {stage === 'saving' && 'Saving...'}
            {stage === 'done' && 'Saved!'}
          </h2>
          <button type="button" onClick={onClose} className="hover:opacity-70 transition-opacity" style={{ color: '#a47c16' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Listening stage */}
        {stage === 'listening' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="h-16 w-16 animate-pulse rounded-full bg-red-500/30 flex items-center justify-center">
                <div className="h-8 w-8 rounded-full bg-red-500" />
              </div>
            </div>
            <p className="text-center text-sm" style={{ color: 'rgba(70,48,12,0.5)' }}>
              Describe what you ate...
            </p>
            {transcript && (
              <div className="rounded-lg p-4 text-sm" style={{ background: 'rgba(255,255,255,0.35)', color: '#3d3225' }}>
                {transcript}
              </div>
            )}
            {transcript && (
              <button
                type="button"
                onClick={goToEditing}
                className="w-full rounded-lg py-3 font-medium hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(145deg, #c9a03c, #a47c16)', color: '#fff' }}
              >
                Done speaking
              </button>
            )}
          </div>
        )}

        {/* Editing stage */}
        {stage === 'editing' && (
          <div className="space-y-4">
            <textarea
              value={editedTranscript}
              onChange={(e) => setEditedTranscript(e.target.value)}
              rows={3}
              className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 resize-none"
              style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
              autoFocus
            />
            <p className="text-xs" style={{ color: 'rgba(70,48,12,0.45)' }}>
              Fix mistakes or add corrections like: bus-mati (basmati)
            </p>
            <button
              type="button"
              onClick={handleParseMeal}
              disabled={!editedTranscript.trim()}
              className="w-full rounded-lg py-3 font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(145deg, #c9a03c, #a47c16)', color: '#fff' }}
            >
              Parse meal
            </button>
          </div>
        )}

        {/* Processing stage */}
        {stage === 'processing' && (
          <div className="flex items-center justify-center py-8">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4"
              style={{ borderColor: 'rgba(201,160,60,0.2)', borderTopColor: '#c9a03c' }}
            />
          </div>
        )}

        {/* Confirming stage */}
        {stage === 'confirming' && parsed && (
          <div className="space-y-4">
            {parsed.clarification_needed && (
              <div className="rounded-lg bg-amber-900/30 p-3 text-sm text-amber-300">
                {parsed.clarification_needed}
              </div>
            )}

            <div className="text-sm font-medium uppercase tracking-wider" style={{ color: 'rgba(70,48,12,0.5)' }}>
              {parsed.meal_label}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {editedFoods.map((food, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.35)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: '#3d3225' }}>{food.name}</div>
                    <div className="text-xs" style={{ color: 'rgba(70,48,12,0.5)' }}>
                      {food.calories} cal · {food.protein_g}P · {food.carbs_g}C · {food.fat_g}F
                    </div>
                  </div>
                  <input
                    type="number"
                    value={food.qty}
                    onChange={(e) => updateFoodQty(i, Number(e.target.value))}
                    className="w-16 rounded px-2 py-1 text-center text-sm focus:outline-none focus:ring-1"
                    style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
                    min={0}
                    step={0.5}
                  />
                  <span className="text-xs" style={{ color: 'rgba(70,48,12,0.5)' }}>{food.unit}</span>
                  <button
                    type="button"
                    onClick={() => removeFood(i)}
                    className="hover:opacity-70 transition-opacity"
                    style={{ color: 'rgba(70,48,12,0.35)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="rounded-lg p-3 flex justify-between text-sm" style={{ background: 'rgba(201,160,60,0.08)' }}>
              <span className="font-medium" style={{ color: '#3d3225' }}>
                {editedFoods.reduce((s, f) => s + f.calories, 0)} cal
              </span>
              <span style={{ color: 'rgba(70,48,12,0.5)' }}>
                {editedFoods.reduce((s, f) => s + f.protein_g, 0).toFixed(0)}P ·{' '}
                {editedFoods.reduce((s, f) => s + f.carbs_g, 0).toFixed(0)}C ·{' '}
                {editedFoods.reduce((s, f) => s + f.fat_g, 0).toFixed(0)}F
              </span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStage('editing')
                  setParsed(null)
                }}
                className="flex-1 rounded-lg py-3 text-sm font-medium hover:opacity-80 transition-opacity"
                style={{ border: '1px solid rgba(201,160,60,0.3)', color: '#5a4a32' }}
              >
                Edit text
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 rounded-lg py-3 text-sm font-medium hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(145deg, #c9a03c, #a47c16)', color: '#fff' }}
              >
                Looks right
              </button>
            </div>
          </div>
        )}

        {/* Saving stage */}
        {stage === 'saving' && (
          <div className="flex items-center justify-center py-8">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4"
              style={{ borderColor: 'rgba(201,160,60,0.2)', borderTopColor: '#c9a03c' }}
            />
          </div>
        )}

        {/* Done stage — offer to save as meal */}
        {stage === 'done' && (
          <div className="space-y-4 text-center py-4">
            <div className="text-sm" style={{ color: '#a47c16' }}>Meal logged successfully.</div>
            <button
              type="button"
              onClick={() => setShowSaveMeal(true)}
              className="text-sm hover:opacity-70 transition-opacity"
              style={{ color: '#a47c16' }}
            >
              Save as meal?
            </button>
            <button
              type="button"
              onClick={onComplete}
              className="w-full rounded-lg py-3 text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ border: '1px solid rgba(201,160,60,0.3)', color: '#5a4a32' }}
            >
              Done
            </button>
          </div>
        )}

        {showSaveMeal && (
          <SaveMealModal
            userId={userId}
            foods={editedFoods}
            defaultName={parsed?.meal_label || ''}
            onSaved={() => { setShowSaveMeal(false); onComplete() }}
            onClose={() => setShowSaveMeal(false)}
          />
        )}
      </div>
    </div>
  )
}
