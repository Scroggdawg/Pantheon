'use client'

// Op FASTRAK Brick Gamma E — pantry-admin row component.
//
// Extracted from app/admin/pantry/page.tsx per Phase 0 §A.7 (extract
// when component grows past ~150 lines). Owns the per-row UI state +
// candidate display + LLM-fill manual-macros sub-form + collapse toggle.
//
// Types exported for the parent page to use in its rows[] state.

import { useState } from 'react'
import type { OffProduct } from '@/lib/off/types'

// ---------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------

export interface UsdaCandidate {
  fdc_id: number
  description: string
  data_type: string
  brand: string | null
  per_serving: {
    kcal: number | null
    protein_g: number | null
    carbs_g: number | null
    fat_g: number | null
  }
}

export interface SearchResult {
  input_name: string
  already_exists?: { product_id: string; existing_name: string }
  off: OffProduct[]
  usda: UsdaCandidate[]
  off_error?: string
  usda_error?: string
  dedup_error?: string
}

export type RowStatus = 'pending' | 'loaded' | 'picked' | 'skipped' | 'saving' | 'saved' | 'failed'

export interface ManualMacros {
  serving_size_g: string
  calories: string
  protein_g: string
  carbs_g: string
  fat_g: string
}

export interface PickedSelection {
  source: 'off' | 'usda' | 'llm' | null
  off_index?: number
  usda_index?: number
  manual_macros?: ManualMacros
}

export interface PantryRow {
  inputName: string
  status: RowStatus
  result?: SearchResult
  pick: PickedSelection
  saveError?: string
  productId?: string
}

export const EMPTY_MACROS: ManualMacros = {
  serving_size_g: '',
  calories: '',
  protein_g: '',
  carbs_g: '',
  fat_g: '',
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function statusBadge(status: RowStatus): { text: string; color: string } {
  switch (status) {
    case 'pending': return { text: 'searching…', color: '#8a7a60' }
    case 'loaded':  return { text: 'pick one', color: '#a47c16' }
    case 'picked':  return { text: 'ready', color: '#3d8c40' }
    case 'skipped': return { text: 'skipped', color: '#8a7a60' }
    case 'saving':  return { text: 'saving…', color: '#a47c16' }
    case 'saved':   return { text: 'saved ✓', color: '#3d8c40' }
    case 'failed':  return { text: 'failed', color: '#a43030' }
  }
}

function confidenceColor(c: 'high' | 'medium' | 'low' | undefined): string {
  if (c === 'high') return '#3d8c40'
  if (c === 'medium') return '#a47c16'
  return '#8a7a60'
}

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------

interface PantryRowCardProps {
  row: PantryRow
  onPickOff: (idx: number) => void
  onPickUsda: (idx: number) => void
  onPickLlm: () => void
  onSkip: () => void
  onUpdateMacros: (field: keyof ManualMacros, value: string) => void
  defaultCollapsed: boolean
}

export function PantryRowCard({
  row,
  onPickOff,
  onPickUsda,
  onPickLlm,
  onSkip,
  onUpdateMacros,
  defaultCollapsed,
}: PantryRowCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const sb = statusBadge(row.status)
  const exists = row.result?.already_exists
  const showLlmForm = row.pick.source === 'llm'

  return (
    <div
      className="rounded-lg p-4 border"
      style={{
        background: row.status === 'saved' ? 'rgba(61,140,64,0.06)' : 'rgba(255,255,255,0.5)',
        borderColor:
          row.status === 'saved' ? 'rgba(61,140,64,0.3)' :
          row.status === 'failed' ? 'rgba(164,48,48,0.4)' :
          'rgba(201,160,60,0.2)',
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <span className="font-medium" style={{ color: '#3d3225' }}>{row.inputName}</span>
          {exists && (
            <span
              className="ml-2 text-xs px-2 py-0.5 rounded"
              style={{ background: 'rgba(164,48,48,0.12)', color: '#a43030' }}
            >
              already in library
            </span>
          )}
        </div>
        <span className="text-xs uppercase tracking-wider" style={{ color: sb.color }}>
          {sb.text}
        </span>
        {(row.status === 'loaded' || row.status === 'picked' || row.status === 'skipped') && (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs"
            style={{ color: '#8a7a60' }}
          >
            {collapsed ? '▸' : '▾'}
          </button>
        )}
      </div>

      {row.status === 'failed' && row.saveError && (
        <p className="text-xs mb-2" style={{ color: '#a43030' }}>
          {row.saveError}
        </p>
      )}

      {!collapsed && row.result && (
        <>
          {/* OFF candidates */}
          {row.result.off.length > 0 && (
            <div className="mb-3">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#7a6a52' }}>
                OFF candidates
              </p>
              <div className="space-y-1">
                {row.result.off.slice(0, 3).map((p, idx) => {
                  const picked = row.pick.source === 'off' && row.pick.off_index === idx
                  const ns = p.nutriscore_grade
                  const confidence: 'high' | 'medium' | 'low' = ns && ns !== 'unknown' ? 'high' : 'medium'
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => !exists && onPickOff(idx)}
                      disabled={!!exists || row.status === 'saved' || row.status === 'saving'}
                      className="w-full text-left p-2 rounded text-xs disabled:opacity-50"
                      style={{
                        background: picked ? 'rgba(201,160,60,0.18)' : 'rgba(255,255,255,0.4)',
                        border: picked
                          ? '1.5px solid rgba(201,160,60,0.6)'
                          : '1px solid rgba(201,160,60,0.15)',
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span style={{ color: '#3d3225' }}>
                          <span className="font-medium">{p.product_name ?? '(unnamed)'}</span>
                          {p.brands && <span style={{ color: '#8a7a60' }}> · {p.brands.split(',')[0]}</span>}
                        </span>
                        <span style={{ color: confidenceColor(confidence) }}>{confidence}</span>
                      </div>
                      <div style={{ color: '#8a7a60' }}>
                        {p.serving_size ? `${p.serving_size} · ` : ''}
                        {p.nutriments?.['energy-kcal_serving'] ?? p.nutriments?.['energy-kcal_100g'] ?? '?'}cal ·{' '}
                        {p.nutriments?.['proteins_serving'] ?? p.nutriments?.['proteins_100g'] ?? '?'}P ·{' '}
                        {p.nutriments?.['carbohydrates_serving'] ?? p.nutriments?.['carbohydrates_100g'] ?? '?'}C ·{' '}
                        {p.nutriments?.['fat_serving'] ?? p.nutriments?.['fat_100g'] ?? '?'}F
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* USDA candidates */}
          {row.result.usda.length > 0 && (
            <div className="mb-3">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#7a6a52' }}>
                USDA candidates
              </p>
              <div className="space-y-1">
                {row.result.usda.slice(0, 3).map((u, idx) => {
                  const picked = row.pick.source === 'usda' && row.pick.usda_index === idx
                  const tier = u.data_type === 'Foundation' || u.data_type === 'Survey (FNDDS)' ? 'high' : 'medium'
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => !exists && onPickUsda(idx)}
                      disabled={!!exists || row.status === 'saved' || row.status === 'saving'}
                      className="w-full text-left p-2 rounded text-xs disabled:opacity-50"
                      style={{
                        background: picked ? 'rgba(201,160,60,0.18)' : 'rgba(255,255,255,0.4)',
                        border: picked
                          ? '1.5px solid rgba(201,160,60,0.6)'
                          : '1px solid rgba(201,160,60,0.15)',
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span style={{ color: '#3d3225' }}>
                          <span className="font-medium">{u.description}</span>
                          {u.brand && <span style={{ color: '#8a7a60' }}> · {u.brand}</span>}
                          <span style={{ color: '#8a7a60' }}> · {u.data_type}</span>
                        </span>
                        <span style={{ color: confidenceColor(tier) }}>{tier}</span>
                      </div>
                      <div style={{ color: '#8a7a60' }}>
                        {u.per_serving.kcal ?? '?'}cal ·{' '}
                        {u.per_serving.protein_g ?? '?'}P ·{' '}
                        {u.per_serving.carbs_g ?? '?'}C ·{' '}
                        {u.per_serving.fat_g ?? '?'}F
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* LLM-fill manual macros sub-form */}
          {showLlmForm && (
            <div className="mb-3 p-3 rounded" style={{ background: 'rgba(201,160,60,0.06)' }}>
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#a47c16' }}>
                LLM-fill — enter macros manually
              </p>
              <div className="grid grid-cols-5 gap-2">
                {(['serving_size_g', 'calories', 'protein_g', 'carbs_g', 'fat_g'] as const).map((field) => (
                  <div key={field} className="flex flex-col">
                    <label className="text-xs mb-0.5" style={{ color: '#7a6a52' }}>
                      {field === 'serving_size_g' ? 'Serv g' :
                       field === 'calories' ? 'Cal' :
                       field === 'protein_g' ? 'P' :
                       field === 'carbs_g' ? 'C' : 'F'}
                    </label>
                    <input
                      type="number"
                      value={row.pick.manual_macros?.[field] ?? ''}
                      onChange={(e) => onUpdateMacros(field, e.target.value)}
                      disabled={!!exists || row.status === 'saved' || row.status === 'saving'}
                      step="any"
                      min="0"
                      className="rounded p-1 text-xs"
                      style={{
                        background: 'rgba(255,255,255,0.7)',
                        border: '1px solid rgba(201,160,60,0.3)',
                        color: '#3d3225',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action affordances */}
          {!exists && (row.status === 'loaded' || row.status === 'picked' || row.status === 'skipped') && (
            <div className="flex items-center gap-2">
              {row.pick.source !== 'llm' && (
                <button
                  type="button"
                  onClick={onPickLlm}
                  className="text-xs px-3 py-1.5 rounded"
                  style={{
                    border: '1px solid rgba(201,160,60,0.4)',
                    color: '#a47c16',
                  }}
                >
                  LLM-fill instead
                </button>
              )}
              {row.status !== 'skipped' && (
                <button
                  type="button"
                  onClick={onSkip}
                  className="text-xs px-3 py-1.5 rounded"
                  style={{ color: '#8a7a60' }}
                >
                  Skip this row
                </button>
              )}
            </div>
          )}

          {(row.result.off_error || row.result.usda_error) && (
            <p className="text-xs mt-2" style={{ color: '#a43030' }}>
              {row.result.off_error && `OFF: ${row.result.off_error}`}
              {row.result.off_error && row.result.usda_error && ' · '}
              {row.result.usda_error && `USDA: ${row.result.usda_error}`}
            </p>
          )}
        </>
      )}
    </div>
  )
}
