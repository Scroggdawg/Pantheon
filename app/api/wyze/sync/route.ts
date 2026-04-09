import { createClient } from '@supabase/supabase-js'
import { checkWyzeCredentials, getWyzeAuth, fetchScaleRecords, parseScaleRecord } from '@/lib/wyze/wyze'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  const startMs = Date.now()
  const supabase = getServiceClient()

  // Check credentials first
  const credError = checkWyzeCredentials()
  if (credError) {
    return Response.json(
      { error: `Wyze not configured: ${credError}. Add Wyze credentials to .env.local or use manual weight entry.` },
      { status: 400 }
    )
  }

  let userId: string | undefined
  try {
    const body = await request.json().catch(() => ({}))
    userId = body.user_id
  } catch {
    // Cron — no body
  }

  try {
    console.log('[wyze-sync] Authenticating...')
    const auth = await getWyzeAuth()
    console.log('[wyze-sync] Auth OK, user_id:', auth.user_id)

    console.log('[wyze-sync] Fetching scale records...')
    const records = await fetchScaleRecords(auth)
    console.log('[wyze-sync] Found', records.length, 'records')

    if (!userId) {
      const { data: users } = await supabase.from('users').select('id').limit(1)
      userId = users?.[0]?.id
    }

    if (!userId) {
      return Response.json({ error: 'No user found. Complete onboarding first.' }, { status: 400 })
    }

    let newCount = 0
    for (const record of records) {
      const parsed = parseScaleRecord(record)
      const { error } = await supabase.from('weight_readings').upsert(
        { ...parsed, user_id: userId },
        { onConflict: 'wyze_record_id' }
      )
      if (!error) newCount++
      else console.error('[wyze-sync] Insert error:', error.message)
    }

    await supabase.from('wyze_sync_log').insert({
      user_id: userId,
      records_found: records.length,
      records_new: newCount,
      duration_ms: Date.now() - startMs,
    })

    return Response.json({
      success: true,
      records_found: records.length,
      records_new: newCount,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[wyze-sync] FULL ERROR:', errMsg)

    if (userId) {
      try {
        await supabase.from('wyze_sync_log').insert({
          user_id: userId,
          records_found: 0,
          records_new: 0,
          error: errMsg,
          duration_ms: Date.now() - startMs,
        })
      } catch {
        // Ignore logging errors
      }
    }

    return Response.json({ error: errMsg }, { status: 500 })
  }
}

export async function GET() {
  return POST(new Request('http://localhost', { method: 'POST' }))
}
