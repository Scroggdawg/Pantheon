import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { count } = await supabase
    .from('withings_tokens')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({ connected: (count ?? 0) > 0 })
}
