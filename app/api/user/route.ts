import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .limit(1)
    .single()

  if (error || !data) {
    return Response.json({ error: 'No user found' }, { status: 404 })
  }

  return Response.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .insert(body)
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 400 })
  }

  return Response.json(data)
}
