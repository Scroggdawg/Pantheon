'use client'

import { useEffect, useState } from 'react'
import type { User } from '@/types/database'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUser() {
      const res = await fetch('/api/user')
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      }
      setLoading(false)
    }

    fetchUser()
  }, [])

  return { user, userId: user?.id ?? null, loading }
}
