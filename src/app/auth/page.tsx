'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Zap, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = '/dashboard'
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email, password })
        if (err) { setError(err.message); } 
        else if (data.session) { window.location.href = '/dashboard' }
        else { setError('Account created. Please sign in.') ; setMode('signin') }
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) { setError(err.message) } 
        else if (data.session) { window.location.href = '/dashboard' }
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0b]">
      {/* Glow */}
      <div className="glow absolute inset-0 h-[500px] pointer-events-none" />

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 mb-12">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Zap className="w-4.5 h-4.5 text-white" fill="white" />
          </div>
          <span className="font-semibold text-lg">Relay</span>
        </Link>

        {/* Card */}
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-1">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-sm text-zinc-400 mb-8">
            {mode === 'signin' ? 'Sign in to your Relay account' : 'Start using Relay for free — no credit card required'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#111113] border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Password</label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 bg-[#111113] border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
              />
            </div>
            {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white py-2.5 rounded-xl font-medium transition disabled:opacity-50 shadow-lg shadow-indigo-500/20"
            >
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-zinc-400">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}
              className="text-indigo-400 hover:text-indigo-300 font-medium transition"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>

        <Link href="/" className="mt-12 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition">
          <ArrowLeft className="w-3 h-3" /> Back to home
        </Link>
      </div>
    </div>
  )
}