'use client'

import { useState, useRef } from 'react'
// heic2any is dynamically imported in handleImageSelect to avoid SSR window crash
import { createClient } from '@/lib/supabase/client'
import type { ParsedWorkoutResponse, ParsedExercise } from '@/lib/claude/workout'

interface Props {
  userId: string
  onComplete: () => void
  onClose: () => void
}

type Stage = 'input' | 'processing' | 'confirming' | 'saving'

export function WorkoutLogger({ userId, onComplete, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('input')
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedWorkoutResponse | null>(null)
  const [editedExercises, setEditedExercises] = useState<ParsedExercise[]>([])
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageDataRef = useRef<{ base64: string; mediaType: string } | null>(null)
  const supabase = createClient()

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Detect HEIC/HEIF and convert to JPEG before FileReader
    let fileToRead: Blob = file
    const isHeic =
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      file.name.toLowerCase().endsWith('.heic') ||
      file.name.toLowerCase().endsWith('.heif')

    if (isHeic) {
      try {
        const { default: heic2any } = await import('heic2any')
        const converted = await heic2any({ blob: file, toType: 'image/jpeg' })
        fileToRead = Array.isArray(converted) ? converted[0] : converted
      } catch {
        setError('HEIC conversion failed. Try saving the image as JPEG first.')
        return
      }
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setImagePreview(dataUrl)
      // Extract base64 and media type
      const [header, base64] = dataUrl.split(',')
      const mediaType = header.match(/data:(.*?);/)?.[1] || 'image/jpeg'
      imageDataRef.current = { base64, mediaType }
    }
    reader.readAsDataURL(fileToRead)
  }

  function clearImage() {
    setImagePreview(null)
    imageDataRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit() {
    const hasText = text.trim().length > 0
    const hasImage = !!imageDataRef.current
    if (!hasText && !hasImage) return

    setStage('processing')
    setError('')

    try {
      const url = hasImage ? '/api/claude/parse-workout-image' : '/api/claude/parse-workout'
      const body = hasImage
        ? { image: imageDataRef.current!.base64, mediaType: imageDataRef.current!.mediaType }
        : { transcript: text }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Parse failed')
      }

      const data: ParsedWorkoutResponse = await res.json()

      setParsed(data)
      setEditedExercises(data.exercises)
      setStage('confirming')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse workout')
      setStage('input')
    }
  }

  async function handleConfirm() {
    if (!parsed) return
    setStage('saving')
    setSaveError(null)

    try {
      const totalVolume = editedExercises.reduce((s, e) => s + e.total_volume_lbs, 0)

      const { data: session, error: sessionErr } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: userId,
          trained_at: new Date().toISOString(),
          session_type: parsed.session_type,
          duration_min: parsed.duration_min,
          notes: parsed.notes,
          raw_input_text: text || null,
          image_url: parsed.imageUrl || null,
          total_volume_lbs: totalVolume,
        })
        .select('id')
        .single()

      if (sessionErr || !session) throw new Error('Failed to save workout session.')

      const exerciseRows = editedExercises.map((ex) => ({
        session_id: session.id,
        exercise_name: ex.exercise_name,
        muscle_groups: ex.muscle_groups,
        sets_json: ex.sets,
        total_volume_lbs: ex.total_volume_lbs,
        is_pr: false,
      }))

      const { error: exErr } = await supabase
        .from('workout_exercises')
        .insert(exerciseRows)

      if (exErr) throw new Error('Session saved but exercises failed to save.')

      setSaveError(null)
      setRetryCount(0)
      onComplete()
    } catch (err) {
      const next = retryCount + 1
      setRetryCount(next)
      if (next >= 3) {
        setSaveError('__FALLBACK__')
      } else {
        setSaveError(
          err instanceof Error ? err.message : 'Failed to save workout. Your data is not lost — tap Save again to retry.'
        )
      }
      setStage('confirming')
    }
  }

  function updateExerciseName(exIdx: number, name: string) {
    setEditedExercises((prev) =>
      prev.map((ex, i) => (i === exIdx ? { ...ex, exercise_name: name } : ex))
    )
  }

  function updateSetWeight(exIdx: number, setIdx: number, weight: number) {
    setEditedExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex
        const newSets = ex.sets.map((s, j) =>
          j === setIdx ? { ...s, weight_lbs: weight } : s
        )
        return {
          ...ex,
          sets: newSets,
          total_volume_lbs: newSets.reduce((s, set) => s + set.reps * (set.weight_lbs || 0), 0),
        }
      })
    )
  }

  function updateSetReps(exIdx: number, setIdx: number, reps: number) {
    setEditedExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex
        const newSets = ex.sets.map((s, j) =>
          j === setIdx ? { ...s, reps } : s
        )
        return {
          ...ex,
          sets: newSets,
          total_volume_lbs: newSets.reduce((s, set) => s + set.reps * (set.weight_lbs || 0), 0),
        }
      })
    )
  }

  function removeExercise(idx: number) {
    setEditedExercises((prev) => prev.filter((_, i) => i !== idx))
  }

  function addExercise() {
    setEditedExercises((prev) => [
      ...prev,
      {
        exercise_name: 'New Exercise',
        muscle_groups: [],
        sets: [{ reps: 10, weight_lbs: 0 }],
        total_volume_lbs: 0,
        notes: null,
      },
    ])
  }

  function addSet(exIdx: number) {
    setEditedExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex
        const lastSet = ex.sets[ex.sets.length - 1]
        return {
          ...ex,
          sets: [...ex.sets, { reps: lastSet?.reps || 10, weight_lbs: lastSet?.weight_lbs || 0 }],
        }
      })
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl bg-gray-900 p-6 sm:rounded-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {stage === 'input' && 'Log Workout'}
            {stage === 'processing' && 'Parsing workout...'}
            {stage === 'confirming' && 'Confirm Workout'}
            {stage === 'saving' && 'Saving...'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{error}</div>
        )}

        {/* Input stage */}
        {stage === 'input' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Describe your workout or upload a photo of your notes.
            </p>

            {/* Image upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={handleImageSelect}
              className="hidden"
            />

            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Workout notes"
                  className="w-full rounded-lg max-h-48 object-cover"
                />
                <button
                  onClick={clearImage}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-gray-600 py-4 text-sm text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors"
              >
                Upload workout photo
              </button>
            )}

            {!imagePreview && (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Bench press 4x8 at 185, incline DB press 3x10 at 60..."
                rows={4}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
                autoFocus
              />
            )}

            <button
              onClick={handleSubmit}
              disabled={!text.trim() && !imagePreview}
              className="w-full rounded-lg bg-blue-600 py-3 font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Parse Workout
            </button>
          </div>
        )}

        {/* Processing stage */}
        {stage === 'processing' && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" />
            {imagePreview && (
              <p className="text-xs text-gray-500">Reading handwriting...</p>
            )}
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

            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-full bg-blue-900/50 px-3 py-1 text-blue-300 capitalize">
                {parsed.session_type}
              </span>
              {parsed.duration_min && (
                <span className="text-gray-400">{parsed.duration_min} min</span>
              )}
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {editedExercises.map((ex, exIdx) => (
                <div key={exIdx} className="rounded-lg bg-gray-800 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <input
                      type="text"
                      value={ex.exercise_name}
                      onChange={(e) => updateExerciseName(exIdx, e.target.value)}
                      className="font-medium text-sm bg-transparent border-b border-transparent focus:border-gray-600 focus:outline-none w-full mr-2"
                    />
                    <button
                      onClick={() => removeExercise(exIdx)}
                      className="text-gray-500 hover:text-red-400 shrink-0"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    {ex.muscle_groups.join(', ')}
                  </div>
                  <div className="space-y-1">
                    {ex.sets.map((set, setIdx) => (
                      <div key={setIdx} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500 w-6">S{setIdx + 1}</span>
                        <input
                          type="number"
                          value={set.reps}
                          onChange={(e) => updateSetReps(exIdx, setIdx, Number(e.target.value))}
                          className="w-14 rounded bg-gray-700 px-2 py-1 text-center text-sm"
                          min={1}
                        />
                        <span className="text-gray-500 text-xs">reps</span>
                        <span className="text-gray-600">@</span>
                        <input
                          type="number"
                          value={set.weight_lbs ?? ''}
                          onChange={(e) => updateSetWeight(exIdx, setIdx, Number(e.target.value))}
                          className="w-16 rounded bg-gray-700 px-2 py-1 text-center text-sm"
                          min={0}
                          placeholder="BW"
                        />
                        <span className="text-gray-500 text-xs">lbs</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => addSet(exIdx)}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                  >
                    + Add set
                  </button>
                  <div className="mt-2 text-xs text-gray-400">
                    Volume: {ex.total_volume_lbs.toLocaleString()} lbs
                  </div>
                </div>
              ))}
            </div>

            {/* Add exercise */}
            <button
              onClick={addExercise}
              className="w-full rounded-lg border border-dashed border-gray-600 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-gray-300"
            >
              + Add exercise
            </button>

            {/* Total volume */}
            <div className="rounded-lg bg-gray-800/50 p-3 flex justify-between text-sm">
              <span className="font-medium">Total Volume</span>
              <span className="text-blue-400 font-semibold">
                {editedExercises.reduce((s, e) => s + e.total_volume_lbs, 0).toLocaleString()} lbs
              </span>
            </div>

            {saveError === '__FALLBACK__' && (
              <div className="rounded-lg bg-red-900/30 p-4 space-y-2">
                <p className="text-sm text-red-300 font-medium">Persistent save error. Copy your workout below:</p>
                <pre className="text-xs text-gray-300 whitespace-pre-wrap select-all">
                  {editedExercises.map((ex) =>
                    `${ex.exercise_name}\n${ex.sets.map((s, i) => `  S${i + 1}: ${s.reps} reps @ ${s.weight_lbs ?? 'BW'} lbs`).join('\n')}`
                  ).join('\n\n')}
                </pre>
              </div>
            )}

            {saveError && saveError !== '__FALLBACK__' && (
              <div className="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{saveError}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStage('input')
                  setParsed(null)
                }}
                className="flex-1 rounded-lg border border-gray-700 py-3 text-sm font-medium hover:bg-gray-800"
              >
                Edit input
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 rounded-lg bg-blue-600 py-3 text-sm font-medium hover:bg-blue-700"
              >
                {saveError === '__FALLBACK__' ? 'Retry Save' : 'Save Workout'}
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
      </div>
    </div>
  )
}
