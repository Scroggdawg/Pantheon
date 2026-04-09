import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  // During SSR prerender with no env vars, defer client creation
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    // Return a placeholder — will be created on the client when env vars are available
    if (typeof window === 'undefined') {
      return null as unknown as ReturnType<typeof createBrowserClient>
    }
    throw new Error('Missing Supabase environment variables')
  }

  if (!client) {
    client = createBrowserClient(url, key)
  }
  return client
}
