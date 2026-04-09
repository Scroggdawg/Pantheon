'use client'

import { useState, useRef } from 'react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Read from DOM directly as fallback — Safari autofill can bypass React onChange
    const pw = password || inputRef.current?.value || ''
    console.log('[login] handleSubmit fired, statePassword:', JSON.stringify(password), 'domValue:', JSON.stringify(inputRef.current?.value), 'using:', JSON.stringify(pw))
    if (!pw || loading) return
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      console.log('[login] API response status:', res.status)

      if (res.ok) {
        // Set cookie client-side — Safari private browsing can drop Set-Cookie from fetch responses
        document.cookie = 'pantheon_session=1; path=/; max-age=2592000; samesite=lax'
        console.log('[login] success — cookie set, redirecting to /dashboard')
        window.location.href = '/dashboard'
        return
      } else {
        console.log('[login] failed — shaking')
        setShake(true)
        setPassword('')
        if (inputRef.current) inputRef.current.value = ''
        inputRef.current?.focus()
        setTimeout(() => setShake(false), 500)
      }
    } catch (err) {
      console.error('[login] fetch error:', err)
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-xs space-y-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">PANTHEON</h1>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            autoFocus
            className={`w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-center text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-transform ${
              shake ? 'animate-[shake_0.4s_ease-in-out]' : ''
            }`}
          />
          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Entering…' : 'Enter'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
