// S26 Step 4e — transcript-level response cache for parse-meal.
//
// Caches the full ParsedMealResponse keyed by sha256(user_id +
// ':' + normalized_transcript). 90-day TTL.
//
// S26 Step 4f — normalization extended to strip terminal/internal
// punctuation and collapse whitespace, so voice-to-text variants
// like "double espresso." and "double espresso" hit the same key.
// Pre-Step-4f cache rows still match if their original transcript
// had no punctuation; otherwise they age out via 90-day TTL.
//
// Lookups happen BEFORE the Anthropic synthesis call, so a cache
// hit avoids the Sonnet round-trip entirely (~10s → ~100ms).
// Writes happen AFTER successful synthesis.
//
// Cache is busted on library writes (saved_meals, products) so
// the next parse-meal call reflects fresh library state.

import crypto from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { ParsedMealResponse } from '@/types/database'

function normalizeTranscript(transcript: string): string {
  return transcript
    .toLowerCase()
    .replace(/[.,!?;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function computeCacheKey(userId: string, transcript: string): string {
  const normalized = normalizeTranscript(transcript)
  const input = `${userId}:${normalized}`
  return crypto.createHash('sha256').update(input).digest('hex')
}

export async function lookupResponseCache(
  supabase: SupabaseClient,
  userId: string,
  transcript: string,
): Promise<ParsedMealResponse | null> {
  const cacheKey = computeCacheKey(userId, transcript)
  const { data, error } = await supabase
    .from('parse_meal_response_cache')
    .select('response_json, expires_at')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !data) return null
  return data.response_json as ParsedMealResponse
}

export async function writeResponseCache(
  supabase: SupabaseClient,
  userId: string,
  transcript: string,
  response: ParsedMealResponse,
): Promise<void> {
  const cacheKey = computeCacheKey(userId, transcript)
  const normalized = normalizeTranscript(transcript)

  // Strip _telemetry from cached response (regenerated per request).
  const { _telemetry, ...cleanResponse } = response as ParsedMealResponse & {
    _telemetry?: unknown
  }
  void _telemetry

  const { error } = await supabase
    .from('parse_meal_response_cache')
    .upsert(
      {
        cache_key: cacheKey,
        user_id: userId,
        normalized_transcript: normalized,
        response_json: cleanResponse,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        onConflict: 'cache_key',
      },
    )

  if (error) {
    console.warn('[parse-meal-response-cache] Write failed:', error.message)
    // Best-effort — failures don't block response.
  }
}

export async function bustResponseCacheForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('parse_meal_response_cache')
    .delete()
    .eq('user_id', userId)

  if (error) {
    console.warn('[parse-meal-response-cache] Bust failed:', error.message)
  }
}
