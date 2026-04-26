'use client'

import { useState } from 'react'
import type { RecipeIngredient } from '@/types/database'

interface ParsedRecipe {
  name: string
  servings: number
  cuisine: string | null
  protein_type: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  ingredients: RecipeIngredient[]
  notes: string | null
}

interface Props {
  onSaved: () => void
}

const GOLD = '#a47c16'
const GOLD_LIGHT = '#c9a03c'
const TEXT_DARK = '#3d3225'
const TEXT_MID = '#5a4a32'
const TEXT_MUTED = '#8a7a60'

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.5)',
  border: '1px solid rgba(201,160,60,0.25)',
  color: TEXT_DARK,
}

const goldButtonStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, #c9a03c, #a47c16)',
  color: '#fff',
}

const ghostButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(201,160,60,0.3)',
  color: TEXT_MID,
}

type Stage = 'input' | 'processing' | 'editing' | 'saving'

export function AddRecipePanel({ onSaved }: Props) {
  const [stage, setStage] = useState<Stage>('input')
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<ParsedRecipe | null>(null)
  const [error, setError] = useState('')

  function reset() {
    setStage('input')
    setText('')
    setDraft(null)
    setError('')
  }

  async function handleParse() {
    if (!text.trim()) return
    setStage('processing')
    setError('')

    try {
      const res = await fetch('/api/claude/parse-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'Parse failed')
      }

      const data: ParsedRecipe = await res.json()
      setDraft({
        name: data.name ?? '',
        servings: data.servings ?? 1,
        cuisine: data.cuisine ?? null,
        protein_type: data.protein_type ?? null,
        calories: data.calories ?? null,
        protein_g: data.protein_g ?? null,
        carbs_g: data.carbs_g ?? null,
        fat_g: data.fat_g ?? null,
        ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
        notes: data.notes ?? null,
      })
      setStage('editing')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Parse failed. Try again.'
      setError(msg)
      setStage('input')
    }
  }

  async function handleSave() {
    if (!draft) return
    if (!draft.name.trim()) {
      setError('Recipe name is required.')
      return
    }
    if (!(draft.servings >= 1)) {
      setError('Servings must be at least 1.')
      return
    }
    setError('')
    setStage('saving')

    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'Save failed')
      }

      // Success: reset state and notify parent to re-fetch.
      reset()
      onSaved()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed. Try again.'
      setError(msg)
      setStage('editing')
    }
  }

  function updateDraft<K extends keyof ParsedRecipe>(key: K, value: ParsedRecipe[K]) {
    setDraft(prev => (prev ? { ...prev, [key]: value } : prev))
  }

  function updateIngredient(idx: number, patch: Partial<RecipeIngredient>) {
    setDraft(prev => {
      if (!prev) return prev
      const next = [...prev.ingredients]
      next[idx] = { ...next[idx], ...patch }
      return { ...prev, ingredients: next }
    })
  }

  function removeIngredient(idx: number) {
    setDraft(prev => {
      if (!prev) return prev
      return { ...prev, ingredients: prev.ingredients.filter((_, i) => i !== idx) }
    })
  }

  function addIngredient() {
    setDraft(prev => {
      if (!prev) return prev
      return {
        ...prev,
        ingredients: [...prev.ingredients, { name: '', qty: 1, unit: 'ea', notes: null }],
      }
    })
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'rgba(255,253,249,0.55)',
        border: '1px solid rgba(201,160,60,0.2)',
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2
          className="text-[11px] uppercase tracking-[0.15em] font-semibold"
          style={{ color: TEXT_DARK }}
        >
          Add Recipe
        </h2>
        {stage === 'editing' && (
          <button
            type="button"
            onClick={reset}
            className="text-[11px] uppercase tracking-[0.1em] hover:opacity-70 transition-opacity"
            style={{ color: TEXT_MUTED }}
          >
            Cancel
          </button>
        )}
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg p-3 text-sm"
          style={{
            background: 'rgba(180,40,40,0.08)',
            border: '1px solid rgba(180,40,40,0.2)',
            color: '#7a2222',
          }}
        >
          {error}
        </div>
      )}

      {stage === 'input' && (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='e.g. "Chicken stir fry. Serves 4. 2 lbs chicken breast, 3 cups broccoli, 2 bell peppers, 4 cloves garlic, 3 tbsp soy sauce, 2 tbsp sesame oil…"'
            rows={5}
            className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 resize-none"
            style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
          />
          <button
            type="button"
            onClick={handleParse}
            disabled={!text.trim()}
            className="w-full rounded-lg py-3 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={goldButtonStyle}
          >
            Parse recipe
          </button>
        </div>
      )}

      {stage === 'processing' && (
        <div className="flex items-center justify-center py-10">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4"
            style={{ borderColor: 'rgba(201,160,60,0.2)', borderTopColor: GOLD_LIGHT }}
          />
        </div>
      )}

      {stage === 'editing' && draft && (
        <div className="space-y-4">
          {/* Name + servings */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: TEXT_MUTED }}>
                Name
              </label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => updateDraft('name', e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: TEXT_MUTED }}>
                Servings
              </label>
              <input
                type="number"
                min={1}
                step="0.5"
                value={draft.servings}
                onChange={(e) => updateDraft('servings', Number(e.target.value))}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Cuisine + protein type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: TEXT_MUTED }}>
                Cuisine
              </label>
              <input
                type="text"
                value={draft.cuisine ?? ''}
                onChange={(e) => updateDraft('cuisine', e.target.value || null)}
                placeholder="—"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: TEXT_MUTED }}>
                Protein type
              </label>
              <input
                type="text"
                value={draft.protein_type ?? ''}
                onChange={(e) => updateDraft('protein_type', e.target.value || null)}
                placeholder="—"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Macros (per serving) */}
          <div>
            <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: TEXT_MUTED }}>
              Per serving
            </p>
            <div className="grid grid-cols-4 gap-2">
              {(['calories', 'protein_g', 'carbs_g', 'fat_g'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-[9px] uppercase tracking-wider mb-1" style={{ color: TEXT_MUTED }}>
                    {field === 'calories' ? 'Cal' : field === 'protein_g' ? 'Protein' : field === 'carbs_g' ? 'Carbs' : 'Fat'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={draft[field] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      updateDraft(field, v === '' ? null : Number(v))
                    }}
                    className="w-full rounded-lg px-2 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Ingredients table */}
          <div>
            <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: TEXT_MUTED }}>
              Ingredients
            </p>
            <div className="space-y-2">
              {draft.ingredients.map((ing, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    value={ing.name}
                    onChange={(e) => updateIngredient(idx, { name: e.target.value })}
                    placeholder="name"
                    className="col-span-5 rounded-lg px-2 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={ing.qty}
                    onChange={(e) => updateIngredient(idx, { qty: Number(e.target.value) })}
                    className="col-span-2 rounded-lg px-2 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    value={ing.unit}
                    onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
                    placeholder="unit"
                    className="col-span-2 rounded-lg px-2 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    value={ing.notes ?? ''}
                    onChange={(e) => updateIngredient(idx, { notes: e.target.value || null })}
                    placeholder="notes"
                    className="col-span-2 rounded-lg px-2 py-2 text-sm focus:outline-none"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => removeIngredient(idx)}
                    aria-label="Remove ingredient"
                    className="col-span-1 flex items-center justify-center rounded-lg py-2 hover:opacity-70 transition-opacity"
                    style={{ color: TEXT_MUTED }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addIngredient}
              className="mt-2 rounded-lg px-3 py-2 text-xs font-medium hover:opacity-80 transition-opacity"
              style={ghostButtonStyle}
            >
              + Add ingredient
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: TEXT_MUTED }}>
              Notes
            </label>
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => updateDraft('notes', e.target.value || null)}
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
              style={inputStyle}
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-lg py-3 text-sm font-medium hover:opacity-90 transition-opacity"
            style={goldButtonStyle}
          >
            Save recipe
          </button>
        </div>
      )}

      {stage === 'saving' && (
        <div className="flex items-center justify-center py-10">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4"
            style={{ borderColor: 'rgba(201,160,60,0.2)', borderTopColor: GOLD_LIGHT }}
          />
        </div>
      )}
    </div>
  )
}
