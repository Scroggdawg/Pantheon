// Op FASTRAK Alpha.2 — Whisper vocabulary hint builder.
//
// Builds a free-text comma-separated vocabulary string from the user's
// library + recent food log, ordered by recency × frequency × stability.
// Passed as the `prompt` parameter to OpenAI's Whisper API to bias
// transcription toward known foods/brands. Specifically targets cases
// like "Spindrift" → "Spendthrift" or "Yerba Mate" → "Madre Enlightenment"
// that voice-to-text without domain priors fumbles.
//
// OpenAI Whisper documents a ~244-token limit on the prompt parameter
// (we target 224 to stay clear of edge cases). Whisper uses its own
// tokenizer, NOT cl100k_base, so exact counting via tiktoken would be
// approximate either way. Instead we use a conservative character-count
// heuristic (~3.5 chars/token for English brand/food names; aim ~700
// chars total so we sit comfortably under 224 tokens). Truncation lands
// at the last comma boundary that fits.
//
// Vocab sources (in priority order; ordering enforced via a single
// sort over a unified candidates array):
//   1. saved_meals.name (user-scoped)
//   2. products.name (global per access doc)
//   3. recent food_log_entries → foods_json[].name (last N entries)
//
// Within the unified pool, ranking is:
//   1. last_logged_at desc (recency)
//   2. times_logged desc (frequency)
//   3. alphabetical (stability tiebreaker)
//
// Greedy include in order; stop when the next entry would push past the
// character cap. Resulting string is comma-separated brand/food names.

import type { SupabaseClient } from '@supabase/supabase-js'

// Conservative cap. Whisper's 224-token limit; ~3.5 chars/token is the
// English-brand-name approximation. 700 chars puts us comfortably under
// 224 tokens for typical brand-name vocabularies.
const CHAR_CAP = 700

// Recent food_log_entries names to scrape — bounded to keep the unique
// pool manageable as Luke's log volume grows.
const RECENT_LOG_LIMIT = 30

interface VocabCandidate {
  name: string
  last_logged_at: string | null
  times_logged: number | null
}

export interface VocabResult {
  prompt: string                 // empty string when no library entries exist
  source_count: number           // distinct food/brand names included
  char_count: number             // length of the prompt string
  truncated: boolean             // true if we couldn't include every candidate
}

interface SavedMealRow {
  name: string | null
  last_logged_at: string | null
  times_logged: number | null
}

interface ProductRow {
  name: string | null
  brand: string | null
}

interface FoodLogEntryRow {
  foods_json: { name?: string }[] | null
  logged_at: string | null
}

export async function buildVocabString(
  supabase: SupabaseClient,
  userId: string,
): Promise<VocabResult> {
  // Pull the three sources in parallel.
  const [mealsRes, productsRes, logsRes] = await Promise.all([
    supabase
      .from('saved_meals')
      .select('name, last_logged_at, times_logged')
      .eq('user_id', userId),
    supabase
      .from('products')
      .select('name, brand'),
    supabase
      .from('food_log_entries')
      .select('foods_json, logged_at')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(RECENT_LOG_LIMIT),
  ])

  const candidates = new Map<string, VocabCandidate>()

  // 1. saved_meals — recency + frequency carry through to ranking.
  for (const m of (mealsRes.data ?? []) as SavedMealRow[]) {
    if (!m.name) continue
    const key = m.name.trim().toLowerCase()
    if (!candidates.has(key)) {
      candidates.set(key, {
        name: m.name.trim(),
        last_logged_at: m.last_logged_at,
        times_logged: m.times_logged,
      })
    }
  }

  // 2. products — global; brand-name preserved when present
  // (e.g. "Yasso Greek Yogurt Bar"). last_logged_at + times_logged
  // are not tracked on products; treated as oldest/least-frequent.
  for (const p of (productsRes.data ?? []) as ProductRow[]) {
    if (!p.name) continue
    const display = p.brand && !p.name.toLowerCase().startsWith(p.brand.toLowerCase())
      ? `${p.brand} ${p.name}`
      : p.name
    const key = display.trim().toLowerCase()
    if (!candidates.has(key)) {
      candidates.set(key, {
        name: display.trim(),
        last_logged_at: null,
        times_logged: null,
      })
    }
  }

  // 3. recent food_log_entries.foods_json[].name — recency carries via
  // the entry's logged_at; frequency is implicit (multiple recent
  // entries containing the same food get the same key, ranked by the
  // most-recent occurrence).
  for (const e of (logsRes.data ?? []) as FoodLogEntryRow[]) {
    for (const food of e.foods_json ?? []) {
      if (!food.name) continue
      const key = food.name.trim().toLowerCase()
      if (!candidates.has(key)) {
        candidates.set(key, {
          name: food.name.trim(),
          last_logged_at: e.logged_at,
          times_logged: null,
        })
      } else {
        // Already present from saved_meals/products; bump recency if
        // this log is more recent.
        const existing = candidates.get(key)!
        if (
          e.logged_at &&
          (!existing.last_logged_at || e.logged_at > existing.last_logged_at)
        ) {
          existing.last_logged_at = e.logged_at
        }
      }
    }
  }

  // Sort: recency desc → frequency desc → alphabetical (stable tiebreaker).
  const sorted = Array.from(candidates.values()).sort((a, b) => {
    const aTime = a.last_logged_at ? new Date(a.last_logged_at).getTime() : 0
    const bTime = b.last_logged_at ? new Date(b.last_logged_at).getTime() : 0
    if (aTime !== bTime) return bTime - aTime
    const aFreq = a.times_logged ?? 0
    const bFreq = b.times_logged ?? 0
    if (aFreq !== bFreq) return bFreq - aFreq
    return a.name.localeCompare(b.name)
  })

  // Greedy include under CHAR_CAP. Truncate at the last comma boundary
  // that fits — we never emit half a name.
  const included: string[] = []
  let runningChars = 0
  let truncated = false
  for (const cand of sorted) {
    const sep = included.length === 0 ? '' : ', '
    const next = sep + cand.name
    if (runningChars + next.length > CHAR_CAP) {
      truncated = true
      break
    }
    included.push(cand.name)
    runningChars += next.length
  }

  const prompt = included.join(', ')
  return {
    prompt,
    source_count: included.length,
    char_count: prompt.length,
    truncated,
  }
}
