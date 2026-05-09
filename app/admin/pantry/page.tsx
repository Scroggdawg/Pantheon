'use client'

// Op FASTRAK Brick Gamma E — bulk-add UI for products library.
//
// Flow:
//   1. Luke pastes food names (one per line) in the textarea
//   2. Click Search → POST /api/admin/pantry/search → per-name OFF +
//      USDA + dedup results
//   3. Per-row: pick OFF candidate / USDA candidate / "LLM-fill" /
//      "Skip"; rows where already_exists is set show a badge and
//      disable save
//   4. Click "Save all picked" → POST /api/admin/pantry/save → bulk
//      INSERT into products
//
// Auth via existing pantheon_session cookie (proxy.ts cookie check
// at line 63 covers this route).
//
// Row component extracted to components/admin/PantryRow.tsx per
// Phase 0 §A.7 (component grew past ~150 lines).

import { useState } from 'react'
import { useUser } from '@/hooks/useUser'
import {
  EMPTY_MACROS,
  PantryRowCard,
  type ManualMacros,
  type PantryRow,
  type SearchResult,
} from '@/components/admin/PantryRow'

interface SaveResult {
  input_name: string
  status: 'saved' | 'failed'
  product_id?: string
  error?: string
}

export default function PantryAdminPage() {
  const { userId, loading: userLoading } = useUser()
  const [pasted, setPasted] = useState('')
  const [rows, setRows] = useState<PantryRow[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [topError, setTopError] = useState('')

  function parseNames(text: string): string[] {
    return text
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }

  async function handleSearch() {
    setTopError('')
    const names = parseNames(pasted)
    if (names.length === 0) return

    // Append to existing rows (per Phase 0 §A.6 edge cases — don't overwrite
    // when Luke pastes a second batch while reviewing the first).
    const newPendingRows: PantryRow[] = names.map((name) => ({
      inputName: name,
      status: 'pending',
      pick: { source: null },
    }))
    setRows((prev) => [...prev, ...newPendingRows])
    setPasted('')
    setSearching(true)

    try {
      const res = await fetch('/api/admin/pantry/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setTopError(err.error || `Search failed (${res.status})`)
        setRows((prev) =>
          prev.map((r) =>
            r.status === 'pending' && names.includes(r.inputName)
              ? { ...r, status: 'failed', saveError: err.error || 'search failed' }
              : r,
          ),
        )
        return
      }
      const data = (await res.json()) as { results: SearchResult[] }
      setRows((prev) =>
        prev.map((r) => {
          if (r.status !== 'pending') return r
          const match = data.results.find((x) => x.input_name === r.inputName)
          if (!match) return r
          // If both OFF + USDA empty AND not already_exists, default
          // pick mode to 'llm' so the manual-macros sub-form auto-reveals.
          const noCandidates = match.off.length === 0 && match.usda.length === 0
          const autoLlmFill = noCandidates && !match.already_exists
          return {
            ...r,
            status: 'loaded',
            result: match,
            pick: autoLlmFill
              ? { source: 'llm', manual_macros: { ...EMPTY_MACROS } }
              : { source: null },
          }
        }),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error'
      setTopError(`Search failed: ${msg}`)
    } finally {
      setSearching(false)
    }
  }

  function pickOff(rowIdx: number, offIdx: number) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIdx
          ? { ...r, status: 'picked', pick: { source: 'off', off_index: offIdx } }
          : r,
      ),
    )
  }
  function pickUsda(rowIdx: number, usdaIdx: number) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIdx
          ? { ...r, status: 'picked', pick: { source: 'usda', usda_index: usdaIdx } }
          : r,
      ),
    )
  }
  function pickLlm(rowIdx: number) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIdx
          ? { ...r, status: 'picked', pick: { source: 'llm', manual_macros: { ...EMPTY_MACROS } } }
          : r,
      ),
    )
  }
  function pickSkip(rowIdx: number) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIdx ? { ...r, status: 'skipped', pick: { source: null } } : r,
      ),
    )
  }
  function updateMacros(rowIdx: number, field: keyof ManualMacros, value: string) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r
        const macros = r.pick.manual_macros ?? { ...EMPTY_MACROS }
        return { ...r, pick: { ...r.pick, manual_macros: { ...macros, [field]: value } } }
      }),
    )
  }

  function isRowReadyToSave(r: PantryRow): boolean {
    if (r.status !== 'picked') return false
    if (r.result?.already_exists) return false
    if (r.pick.source === 'off' && typeof r.pick.off_index === 'number') return true
    if (r.pick.source === 'usda' && typeof r.pick.usda_index === 'number') return true
    if (r.pick.source === 'llm') {
      const m = r.pick.manual_macros
      if (!m) return false
      return (
        Number(m.serving_size_g) > 0 &&
        Number(m.calories) >= 0 &&
        Number(m.protein_g) >= 0 &&
        Number(m.carbs_g) >= 0 &&
        Number(m.fat_g) >= 0
      )
    }
    return false
  }

  async function handleSaveAll() {
    if (!userId) {
      setTopError('User not loaded')
      return
    }
    setTopError('')
    const ready = rows.filter(isRowReadyToSave)
    if (ready.length === 0) {
      setTopError('No rows ready to save')
      return
    }
    setSaving(true)

    setRows((prev) =>
      prev.map((r) => (isRowReadyToSave(r) ? { ...r, status: 'saving' } : r)),
    )

    const payload = ready.map((r) => {
      if (r.pick.source === 'off') {
        return {
          source: 'off' as const,
          input_name: r.inputName,
          off_index: r.pick.off_index!,
        }
      }
      if (r.pick.source === 'usda') {
        const u = r.result!.usda[r.pick.usda_index!]
        return {
          source: 'usda' as const,
          input_name: r.inputName,
          fdc_id: u.fdc_id,
          description: u.description,
          brand: u.brand,
          per_serving: u.per_serving,
        }
      }
      const m = r.pick.manual_macros!
      return {
        source: 'llm' as const,
        input_name: r.inputName,
        brand: null,
        manual_macros: {
          serving_size_g: Number(m.serving_size_g),
          calories: Number(m.calories),
          protein_g: Number(m.protein_g),
          carbs_g: Number(m.carbs_g),
          fat_g: Number(m.fat_g),
        },
      }
    })

    try {
      const res = await fetch('/api/admin/pantry/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, rows: payload }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setTopError(err.error || `Save failed (${res.status})`)
        setRows((prev) =>
          prev.map((r) =>
            r.status === 'saving'
              ? { ...r, status: 'failed', saveError: err.error || 'save failed' }
              : r,
          ),
        )
        return
      }
      const data = (await res.json()) as { results: SaveResult[] }
      const byName = new Map<string, SaveResult>()
      for (const sr of data.results) byName.set(sr.input_name, sr)
      setRows((prev) =>
        prev.map((r) => {
          if (r.status !== 'saving') return r
          const sr = byName.get(r.inputName)
          if (!sr) return { ...r, status: 'failed', saveError: 'no result returned' }
          if (sr.status === 'saved') {
            return { ...r, status: 'saved', productId: sr.product_id }
          }
          return { ...r, status: 'failed', saveError: sr.error ?? 'save failed' }
        }),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error'
      setTopError(`Save failed: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  function clearAll() {
    setRows([])
    setPasted('')
    setTopError('')
  }

  if (userLoading) {
    return (
      <div className="min-h-screen p-6">
        <p className="text-sm" style={{ color: '#8a7a60' }}>Loading…</p>
      </div>
    )
  }

  const readyCount = rows.filter(isRowReadyToSave).length
  const savedCount = rows.filter((r) => r.status === 'saved').length

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto" style={{ background: '#fffaf0' }}>
      <h1 className="text-2xl font-bold mb-1" style={{ color: '#3d3225' }}>
        Pantry Admin
      </h1>
      <p className="text-sm mb-6" style={{ color: '#8a7a60' }}>
        Bulk-add products to your library. Paste food names (one per line),
        search OFF + USDA, pick the right candidate, save.
      </p>

      {/* Paste area */}
      <div className="mb-6">
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={`One food name per line, e.g.\nGreek Yogurt\nKettle Brand Salt and Vinegar Chips\nBrown Rice`}
          className="w-full rounded-lg p-3 text-sm border"
          style={{
            background: 'rgba(255,255,255,0.6)',
            borderColor: 'rgba(201,160,60,0.3)',
            color: '#3d3225',
            minHeight: '120px',
            fontFamily: 'monospace',
          }}
          rows={6}
          disabled={searching}
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching || pasted.trim().length === 0}
            className="rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: 'linear-gradient(145deg, #c9a03c, #a47c16)', color: '#fff' }}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs uppercase tracking-wider"
              style={{ color: '#8a7a60' }}
            >
              Clear all
            </button>
          )}
          <span className="ml-auto text-xs" style={{ color: '#8a7a60' }}>
            {rows.length > 0 && `${rows.length} rows · ${readyCount} ready · ${savedCount} saved`}
          </span>
        </div>
        {topError && (
          <p className="mt-2 text-sm" style={{ color: '#a43030' }}>{topError}</p>
        )}
      </div>

      {/* Save bar */}
      {rows.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || readyCount === 0}
            className="rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: 'linear-gradient(145deg, #c9a03c, #a47c16)', color: '#fff' }}
          >
            {saving ? 'Saving…' : `Save all picked (${readyCount})`}
          </button>
        </div>
      )}

      {/* Rows */}
      <div className="space-y-3">
        {rows.map((r, i) => (
          <PantryRowCard
            key={`${r.inputName}-${i}`}
            row={r}
            onPickOff={(offIdx) => pickOff(i, offIdx)}
            onPickUsda={(usdaIdx) => pickUsda(i, usdaIdx)}
            onPickLlm={() => pickLlm(i)}
            onSkip={() => pickSkip(i)}
            onUpdateMacros={(field, value) => updateMacros(i, field, value)}
            defaultCollapsed={i >= 5 && r.status !== 'pending'}
          />
        ))}
      </div>
    </div>
  )
}
