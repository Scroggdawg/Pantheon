'use client'

import { useState } from 'react'
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

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.5)',
  border: '1px solid rgba(201,160,60,0.25)',
  color: '#3d3225',
}

export function TextLogModal({ userId, dayType, onComplete, onClose }: Props) {
  const [text, setText] = useState('')
  const [stage, setStage] = useState<'input' | 'processing' | 'confirming' | 'saving' | 'done'>('input')
  const [showSaveMeal, setShowSaveMeal] = useState(false)
  const [parsed, setParsed] = useState<ParsedMealResponse | null>(null)
  const [editedFoods, setEditedFoods] = useState<FoodItem[]>([])
  const [error, setError] = useState('')
  const supabase = createClient()
  const { processTranscript } = useVoiceCorrections(userId)

  async function handleParse() {
    if (!text.trim()) return
    setStage('processing')
    setError('')

    try {
      const { cleanedTranscript } = await processTranscript(text)

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
      setError('Failed to parse. Try again.')
      setStage('input')
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

    const { error: dbError } = await supabase.from('food_log_entries').insert({
      user_id: userId,
      meal_label: parsed.meal_label,
      day_type: dayType,
      foods_json: editedFoods,
      total_calories: totals.calories,
      total_protein_g: totals.protein,
      total_carbs_g: totals.carbs,
      total_fat_g: totals.fat,
      log_method: 'manual',
      raw_input_text: text,
      claude_parse_json: parsed,
    })

    if (dbError) {
      setError('Failed to save.')
      setStage('confirming')
      return
    }

    setStage('done')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div
        className="w-full max-w-lg rounded-t-2xl p-6 sm:rounded-2xl"
        style={{ background: 'rgba(255,253,249,0.95)', border: '1px solid rgba(201,160,60,0.2)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: '#3d3225' }}>
            {stage === 'input' && 'Type your meal'}
            {stage === 'processing' && 'Parsing...'}
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
          <div className="mb-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{error}</div>
        )}

        {stage === 'input' && (
          <div className="space-y-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. 3 eggs, 2 strips of bacon, and a protein shake"
              rows={3}
              className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 resize-none"
              style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
              autoFocus
            />
            <button
              type="button"
              onClick={handleParse}
              disabled={!text.trim()}
              className="w-full rounded-lg py-3 font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(145deg, #c9a03c, #a47c16)', color: '#fff' }}
            >
              Parse meal
            </button>
          </div>
        )}

        {stage === 'processing' && (
          <div className="flex items-center justify-center py-8">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4"
              style={{ borderColor: 'rgba(201,160,60,0.2)', borderTopColor: '#c9a03c' }}
            />
          </div>
        )}

        {stage === 'confirming' && parsed && (
          <div className="space-y-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {editedFoods.map((food, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.35)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: '#3d3225' }}>{food.name}</div>
                    <div className="text-xs" style={{ color: 'rgba(70,48,12,0.5)' }}>
                      {food.calories} cal · {food.protein_g}P · {food.carbs_g}C · {food.fat_g}F
                    </div>
                  </div>
                  <span className="text-sm" style={{ color: 'rgba(70,48,12,0.5)' }}>
                    {food.qty} {food.unit}
                  </span>
                </div>
              ))}
            </div>

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
                onClick={() => { setStage('input'); setParsed(null) }}
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

        {stage === 'saving' && (
          <div className="flex items-center justify-center py-8">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4"
              style={{ borderColor: 'rgba(201,160,60,0.2)', borderTopColor: '#c9a03c' }}
            />
          </div>
        )}

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
