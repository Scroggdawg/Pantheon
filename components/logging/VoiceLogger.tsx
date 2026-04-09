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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="w-full max-w-lg rounded-t-2xl bg-gray-900 p-6 sm:rounded-2xl">
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] max-w-sm rounded-lg bg-green-800 px-4 py-2 text-sm text-green-100 shadow-lg">
            {toast}
          </div>
        )}

        {/* Close button */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {stage === 'listening' && 'Listening...'}
            {stage === 'editing' && 'Edit transcript'}
            {stage === 'processing' && 'Parsing meal...'}
            {stage === 'confirming' && 'Confirm meal'}
            {stage === 'saving' && 'Saving...'}
            {stage === 'done' && 'Saved!'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
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
            <p className="text-center text-gray-400 text-sm">
              Describe what you ate...
            </p>
            {transcript && (
              <div className="rounded-lg bg-gray-800 p-4 text-sm">
                {transcript}
              </div>
            )}
            {transcript && (
              <button
                onClick={goToEditing}
                className="w-full rounded-lg bg-blue-600 py-3 font-medium hover:bg-blue-700"
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
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
              autoFocus
            />
            <p className="text-xs text-gray-500">
              Fix mistakes or add corrections like: bus-mati (basmati)
            </p>
            <button
              onClick={handleParseMeal}
              disabled={!editedTranscript.trim()}
              className="w-full rounded-lg bg-blue-600 py-3 font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Parse meal
            </button>
          </div>
        )}

        {/* Processing stage */}
        {stage === 'processing' && (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
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

            <div className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              {parsed.meal_label}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {editedFoods.map((food, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-gray-800 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{food.name}</div>
                    <div className="text-xs text-gray-400">
                      {food.calories} cal · {food.protein_g}P · {food.carbs_g}C · {food.fat_g}F
                    </div>
                  </div>
                  <input
                    type="number"
                    value={food.qty}
                    onChange={(e) => updateFoodQty(i, Number(e.target.value))}
                    className="w-16 rounded bg-gray-700 px-2 py-1 text-center text-sm"
                    min={0}
                    step={0.5}
                  />
                  <span className="text-xs text-gray-400">{food.unit}</span>
                  <button
                    onClick={() => removeFood(i)}
                    className="text-gray-500 hover:text-red-400"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="rounded-lg bg-gray-800/50 p-3 flex justify-between text-sm">
              <span className="font-medium">
                {editedFoods.reduce((s, f) => s + f.calories, 0)} cal
              </span>
              <span className="text-gray-400">
                {editedFoods.reduce((s, f) => s + f.protein_g, 0).toFixed(0)}P ·{' '}
                {editedFoods.reduce((s, f) => s + f.carbs_g, 0).toFixed(0)}C ·{' '}
                {editedFoods.reduce((s, f) => s + f.fat_g, 0).toFixed(0)}F
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStage('editing')
                  setParsed(null)
                }}
                className="flex-1 rounded-lg border border-gray-700 py-3 text-sm font-medium hover:bg-gray-800"
              >
                Edit text
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 rounded-lg bg-blue-600 py-3 text-sm font-medium hover:bg-blue-700"
              >
                Looks right
              </button>
            </div>
          </div>
        )}

        {/* Saving stage */}
        {stage === 'saving' && (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-green-500" />
          </div>
        )}

        {/* Done stage — offer to save as meal */}
        {stage === 'done' && (
          <div className="space-y-4 text-center py-4">
            <div className="text-green-400 text-sm">Meal logged successfully.</div>
            <button
              onClick={() => setShowSaveMeal(true)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Save as meal?
            </button>
            <button
              onClick={onComplete}
              className="w-full rounded-lg bg-gray-800 py-3 text-sm font-medium hover:bg-gray-700"
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
