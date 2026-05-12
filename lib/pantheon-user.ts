import type { SupabaseClient } from '@supabase/supabase-js'

export class PantheonUserError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'PantheonUserError'
    this.status = status
  }
}

export async function getCanonicalUserId(
  supabase: SupabaseClient,
): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .limit(1)
    .single()

  if (error || !data?.id) {
    throw new PantheonUserError(
      500,
      `failed to resolve canonical user: ${error?.message ?? 'not found'}`,
    )
  }

  return data.id
}

export async function assertCanonicalUserId(
  supabase: SupabaseClient,
  requestedUserId: unknown,
): Promise<string> {
  if (!requestedUserId || typeof requestedUserId !== 'string') {
    throw new PantheonUserError(400, 'user_id required')
  }

  const canonicalUserId = await getCanonicalUserId(supabase)
  if (requestedUserId !== canonicalUserId) {
    throw new PantheonUserError(403, 'user_id mismatch')
  }

  return canonicalUserId
}

