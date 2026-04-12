'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WorkoutSession, SessionType, CalEstimateMethod } from '@/types/database'

interface WorkoutEditModalProps {
  workout: WorkoutSession
  onSaved: () => void
  onDeleted: () => void
  onClose: () => void
}

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'lift', label: 'Lift' },
  { value: 'zone2', label: 'Zone 2' },
  { value: 'bjj', label: 'BJJ' },
  { value: 'other', label: 'Other' },
]

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.5)',
  border: '1px solid rgba(201,160,60,0.25)',
  color: '#3d3225',
}

const labelStyle: React.CSSProperties = { color: 'rgba(70,48,12,0.58)' }

export default function WorkoutEditModal({
  workout,
  onSaved,
  onDeleted,
  onClose,
}: WorkoutEditModalProps) {
  const [sessionType, setSessionType] = useState<SessionType>(workout.session_type)
  const [durationMin, setDurationMin] = useState(workout.duration_min != null ? String(workout.duration_min) : '')
  const [editedTime, setEditedTime] = useState(() => {
    const d = new Date(workout.trained_at)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })
  const [distanceMiles, setDistanceMiles] = useState(workout.distance_miles != null ? String(workout.distance_miles) : '')
  const [calBurned, setCalBurned] = useState(workout.estimated_cal_burned != null ? String(workout.estimated_cal_burned) : '')
  const [volumeLbs, setVolumeLbs] = useState(workout.total_volume_lbs != null ? String(workout.total_volume_lbs) : '')
  const [notes, setNotes] = useState(workout.workout_notes || '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  async function handleSave() {
    setSaving(true)

    const calValue = calBurned ? parseInt(calBurned) : workout.estimated_cal_burned
    const calMethod: CalEstimateMethod =
      calBurned && parseInt(calBurned) !== workout.estimated_cal_burned
        ? 'user_override'
        : workout.cal_estimate_method

    // Build trained_at from editedTime
    const trainedAt = new Date(workout.trained_at)
    if (editedTime) {
      const [h, m] = editedTime.split(':').map(Number)
      trainedAt.setHours(h, m, 0, 0)
    }

    await supabase
      .from('workout_sessions')
      .update({
        session_type: sessionType,
        trained_at: trainedAt.toISOString(),
        duration_min: durationMin ? parseInt(durationMin) : null,
        distance_miles: distanceMiles ? parseFloat(distanceMiles) : null,
        total_volume_lbs: volumeLbs ? parseInt(volumeLbs) : null,
        estimated_cal_burned: calValue,
        cal_estimate_method: calMethod,
        workout_notes: notes || null,
      })
      .eq('id', workout.id)

    setSaving(false)
    onSaved()
  }

  async function handleDelete() {
    setDeleting(true)

    // Delete exercises first (foreign key)
    await supabase
      .from('workout_exercises')
      .delete()
      .eq('session_id', workout.id)

    // Delete the session
    await supabase
      .from('workout_sessions')
      .delete()
      .eq('id', workout.id)

    setDeleting(false)
    onDeleted()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center">
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl p-6 sm:rounded-2xl"
        style={{ background: 'rgba(255,253,249,0.95)', border: '1px solid rgba(201,160,60,0.2)' }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: '#3d3225' }}>Edit Workout</h2>
          <button type="button" onClick={onClose} className="hover:opacity-70 transition-opacity" style={{ color: '#a47c16' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Session type */}
          <div>
            <label className="text-xs mb-1 block" style={labelStyle}>Type</label>
            <div className="flex gap-2">
              {SESSION_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setSessionType(t.value)}
                  className="flex-1 rounded-lg py-2 text-sm font-medium transition-all"
                  style={
                    sessionType === t.value
                      ? { background: 'linear-gradient(145deg, #c9a03c, #a47c16)', color: '#fff' }
                      : { background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(201,160,60,0.2)', color: '#5a4a32' }
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div>
            <label className="text-xs mb-1 block" style={labelStyle}>Time</label>
            <input
              type="time"
              value={editedTime}
              onChange={(e) => setEditedTime(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
              style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
            />
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs mb-1 block" style={labelStyle}>Duration (min)</label>
            <input
              type="number"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              placeholder="45"
              min="0"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
              style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
            />
          </div>

          {/* Distance (show for zone2 and bjj) */}
          {(sessionType === 'zone2' || sessionType === 'bjj') && (
            <div>
              <label className="text-xs mb-1 block" style={labelStyle}>Distance (miles)</label>
              <input
                type="number"
                value={distanceMiles}
                onChange={(e) => setDistanceMiles(e.target.value)}
                placeholder="3.5"
                step="0.1"
                min="0"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
              />
            </div>
          )}

          {/* Total volume (show for lift) */}
          {sessionType === 'lift' && (
            <div>
              <label className="text-xs mb-1 block" style={labelStyle}>Total Volume (lbs)</label>
              <input
                type="number"
                value={volumeLbs}
                onChange={(e) => setVolumeLbs(e.target.value)}
                placeholder="12000"
                min="0"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
              />
            </div>
          )}

          {/* Calories burned */}
          <div>
            <label className="text-xs mb-1 block" style={labelStyle}>Calories Burned</label>
            <input
              type="number"
              value={calBurned}
              onChange={(e) => setCalBurned(e.target.value)}
              placeholder="350"
              min="0"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
              style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
            />
            {workout.cal_estimate_method === 'MET_estimate' && (
              <p className="text-xs mt-1" style={{ color: 'rgba(70,48,12,0.45)' }}>MET estimate — edit to override</p>
            )}
            {workout.cal_estimate_method === 'user_override' && (
              <p className="text-xs mt-1" style={{ color: 'rgba(70,48,12,0.45)' }}>Your entry</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs mb-1 block" style={labelStyle}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 resize-none"
              style={{ ...inputStyle, '--tw-ring-color': 'rgba(164,124,22,0.4)' } as React.CSSProperties}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-red-900 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-900/30"
              >
                Delete
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-700 px-4 py-3 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm delete'}
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg py-3 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(145deg, #c9a03c, #a47c16)', color: '#fff' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
