'use client'

import { useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  extractParentheticalCorrections,
  applySavedCorrections,
  isPhoneticallySimilar,
} from '@/lib/corrections/corrections'
import type { SavedCorrection } from '@/lib/corrections/corrections'
import type { VoiceCorrection } from '@/types/database'

interface ProcessResult {
  cleanedTranscript: string
  newCorrections: { heard: string; corrected: string }[]
  appliedCorrections: { heard: string; corrected: string }[]
}

export function useVoiceCorrections(userId: string) {
  const supabase = createClient()
  const cachedCorrections = useRef<SavedCorrection[] | null>(null)

  const loadCorrections = useCallback(async (): Promise<SavedCorrection[]> => {
    if (cachedCorrections.current) return cachedCorrections.current

    const { data } = await supabase
      .from('voice_corrections')
      .select('id, heard, corrected')
      .eq('user_id', userId)

    const corrections = (data as VoiceCorrection[] | null)?.map((r) => ({
      id: r.id,
      heard: r.heard,
      corrected: r.corrected,
    })) ?? []

    cachedCorrections.current = corrections
    return corrections
  }, [supabase, userId])

  const processTranscript = useCallback(async (text: string): Promise<ProcessResult> => {
    // 1. Extract parenthetical corrections from edited text
    const { corrections: extracted, cleanedText } = extractParentheticalCorrections(text)

    // 2. Save phonetically-similar ones via upsert
    const newCorrections: { heard: string; corrected: string }[] = []
    for (const c of extracted) {
      if (isPhoneticallySimilar(c.heard, c.corrected)) {
        await supabase.from('voice_corrections').upsert(
          { user_id: userId, heard: c.heard.toLowerCase(), corrected: c.corrected },
          { onConflict: 'user_id,heard' }
        )
        newCorrections.push(c)
      }
    }

    // Invalidate cache after saving new corrections
    if (newCorrections.length > 0) {
      cachedCorrections.current = null
    }

    // 3. Load all saved corrections
    const saved = await loadCorrections()

    // 4. Apply saved corrections to cleaned text
    const { correctedText, appliedIds } = applySavedCorrections(cleanedText, saved)

    // 5. Increment times_applied via RPC for any that fired
    const appliedCorrections: { heard: string; corrected: string }[] = []
    for (const id of appliedIds) {
      await supabase.rpc('increment_correction_count', { correction_id: id })
      const match = saved.find((s) => s.id === id)
      if (match) appliedCorrections.push({ heard: match.heard, corrected: match.corrected })
    }

    return {
      cleanedTranscript: correctedText,
      newCorrections,
      appliedCorrections,
    }
  }, [supabase, userId, loadCorrections])

  return { processTranscript }
}
