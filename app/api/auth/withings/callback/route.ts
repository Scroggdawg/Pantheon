import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ error: 'missing_code' }, { status: 400 })
  }

  // Step 1 — Exchange code for tokens
  const tokenRes = await fetch('https://wbsapi.withings.net/v2/oauth2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      action: 'requesttoken',
      grant_type: 'authorization_code',
      client_id: process.env.WITHINGS_CLIENT_ID ?? '',
      client_secret: process.env.WITHINGS_CLIENT_SECRET ?? '',
      code,
      redirect_uri: 'https://pantheon-woad.vercel.app/api/auth/withings/callback',
    }),
  })

  const tokenData = await tokenRes.json()
  if (tokenData.status !== 0) {
    return NextResponse.json({ error: 'token_exchange_failed', details: tokenData }, { status: 500 })
  }

  const { access_token, refresh_token, expires_in, userid } = tokenData.body

  // Step 2 — Get the single user ID
  const supabase = await createClient()
  const { data: users } = await supabase.from('users').select('id').limit(1)
  if (!users || users.length === 0) {
    return NextResponse.json({ error: 'no_user_found' }, { status: 500 })
  }
  const userId = users[0].id

  // Step 3 — Upsert token
  const { error: upsertError } = await supabase.from('withings_tokens').upsert(
    {
      user_id: userId,
      access_token,
      refresh_token,
      expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      withings_user_id: String(userid),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (upsertError) {
    return NextResponse.json({ error: 'upsert_failed', details: upsertError.message }, { status: 500 })
  }

  return NextResponse.redirect('https://pantheon.guru/dashboard?withings=connected')
}
