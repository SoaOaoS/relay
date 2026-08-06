'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Bot } from 'lucide-react'
import Link from 'next/link'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSendCode(e: React.FormEvent) {
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

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })
    if (err) {
      setError(err.message)
      setLoading(false)
    } else if (data.session) {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Bot className="w-10 h-10 text-blue-600 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">Welcome to Relay</h1>
          <p className="text-muted-foreground text-sm">
            {sent ? `Enter the code sent to ${email}` : 'Sign in with your email'}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSendCode} className="space-y-4">
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
              {loading ? 'Sending...' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <input
              type="text"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              required
              className="w-full px-4 py-2.5 border rounded-lg text-sm text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify code'}
            </button>
            <button
              type="button"
              onClick={() => { setSent(false); setCode(''); setError('') }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition"
            >
              Use a different email
            </button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link href="/" className="hover:underline">Back to home</Link>
        </p>
      </div>
    </div>
  )
}