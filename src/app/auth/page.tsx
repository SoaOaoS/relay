'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Bot } from 'lucide-react'
import Link from 'next/link'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    if (err) setError(err.message)
    else setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Check your email</h2>
          <p className="text-muted-foreground">We sent a magic link to <strong>{email}</strong>. Click it to sign in.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Bot className="w-10 h-10 text-blue-600 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">Welcome to Relay</h1>
          <p className="text-muted-foreground text-sm">Sign in with your email</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send magic link'}
          </button>
        </form>
        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link href="/" className="hover:underline">Back to home</Link>
        </p>
      </div>
    </div>
  )
}
