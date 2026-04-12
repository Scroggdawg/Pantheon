'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
  onSaved: () => void
  onClose: () => void
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.5)',
  border: '1px solid rgba(201,160,60,0.25)',
  color: '#3d3225',
}

export function ManualWeightModal({ userId, onSaved, onClose }: Props) {
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleSave() {
    if (!weight) return
    setSaving(true)
    setError('')

    const { error: dbError } = await supabase.from('weight_readings').insert({
      user_id: userId,
      measured_at: new Date().toISOString(),
      weight_lbs: Number(weight),
      body_fat_pct: bodyFat ? Number(bodyFat) : null,
      source: 'manual',
    })

    if (dbError) {
      setError('Failed to save weight.')
      setSaving(false)
      return
    }

    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'rgba(255,253,249,0.95)', border: '1px solid rgba(201,160,60,0.2)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: '#3d3225' }}>Log Weight</h2>
          <button type="button" onClick={onClose} className="hover:opacity-70 transition-opacity" style={{ color: '#a47c16' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm" style={{ color: 'rgba(70,48,12,0.58)' }}>Weight (lbs)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="198.0"
              step="0.1"
              className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1"
              style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm" style={{ color: 'rgba(70,48,12,0.58)' }}>Body Fat % (optional)</label>
            <input
              type="number"
              value={bodyFat}
              onChange={(e) => setBodyFat(e.target.value)}
              placeholder="25.0"
              step="0.1"
              className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1"
              style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!weight || saving}
            className="w-full rounded-lg py-3 font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(145deg, #c9a03c, #a47c16)', color: '#fff' }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
