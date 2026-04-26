import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()

  // Step 1 — Get stored token
  const { data: tokens } = await supabase
    .from('withings_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({ error: 'not_connected' }, { status: 401 })
  }

  let token = tokens[0]

  // Step 2 — Refresh if expired
  if (new Date(token.expires_at) < new Date()) {
    const refreshRes = await fetch('https://wbsapi.withings.net/v2/oauth2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action: 'requesttoken',
        grant_type: 'refresh_token',
        client_id: process.env.WITHINGS_CLIENT_ID ?? '',
        client_secret: process.env.WITHINGS_CLIENT_SECRET ?? '',
        refresh_token: token.refresh_token,
      }),
    })

    const refreshData = await refreshRes.json()
    if (refreshData.status !== 0) {
      return NextResponse.json({ error: 'refresh_failed', details: refreshData }, { status: 500 })
    }

    const { access_token, refresh_token, expires_in } = refreshData.body
    const newExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    await supabase
      .from('withings_tokens')
      .update({
        access_token,
        refresh_token,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', token.id)

    token = { ...token, access_token, refresh_token, expires_at: newExpiresAt }
  }

  // Step 3 — Fetch measurements
  const measUrl = new URL('https://wbsapi.withings.net/measure')
  measUrl.searchParams.set('action', 'getmeas')
  measUrl.searchParams.set('meastypes', '1,6')
  measUrl.searchParams.set('category', '1')

  const measRes = await fetch(measUrl.toString(), {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })

  const measData = await measRes.json()
  if (measData.status !== 0 || !measData.body?.measuregrps?.length) {
    return NextResponse.json({ error: 'no_measurements', details: measData }, { status: 404 })
  }

  // Take the most recent measuregrp (highest date)
  const grps = measData.body.measuregrps as {
    date: number
    measures: { type: number; value: number; unit: number }[]
  }[]
  const latest = grps.reduce((a, b) => (a.date > b.date ? a : b))

  let weightKg: number | null = null
  let bodyFatPct: number | null = null

  for (const m of latest.measures) {
    const realValue = m.value * Math.pow(10, m.unit)
    if (m.type === 1) weightKg = realValue
    if (m.type === 6) bodyFatPct = realValue
  }

  if (weightKg === null) {
    return NextResponse.json({ error: 'no_weight_in_measurement' }, { status: 404 })
  }

  const weightLbs = Math.round(weightKg * 2.20462 * 10) / 10
  const measuredAt = new Date(latest.date * 1000).toISOString()

  // Step 4 — Get user ID
  const { data: users } = await supabase.from('users').select('id').limit(1)
  if (!users || users.length === 0) {
    return NextResponse.json({ error: 'no_user_found' }, { status: 500 })
  }

  // Check for duplicate (same user + same measured_at)
  const { data: existing } = await supabase
    .from('weight_readings')
    .select('id')
    .eq('user_id', users[0].id)
    .eq('measured_at', measuredAt)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({
      weight_lbs: weightLbs,
      body_fat_pct: bodyFatPct,
      measured_at: measuredAt,
      synced: false,
      message: 'already_exists',
    })
  }

  const { error: insertError } = await supabase.from('weight_readings').insert({
    user_id: users[0].id,
    weight_lbs: weightLbs,
    body_fat_pct: bodyFatPct,
    measured_at: measuredAt,
    source: 'withings',
  })

  if (insertError) {
    return NextResponse.json({ error: 'insert_failed', details: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    weight_lbs: weightLbs,
    body_fat_pct: bodyFatPct,
    measured_at: measuredAt,
    synced: true,
  })
}
