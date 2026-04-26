import { NextResponse } from 'next/server'

export async function GET() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.WITHINGS_CLIENT_ID ?? '',
    redirect_uri: 'https://pantheon-woad.vercel.app/api/auth/withings/callback',
    scope: 'user.metrics',
    state: 'pantheon',
  })

  const authUrl = `https://account.withings.com/oauth2_user/authorize2?${params.toString()}`
  return NextResponse.redirect(authUrl)
}
