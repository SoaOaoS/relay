'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { MCP_PROVIDERS, MCPProvider } from '@/lib/mcp-providers'
import { Zap, Globe, FileText, Phone, Check, ArrowLeft, Loader2, Save, Eye, EyeOff, Code2 } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const iconMap: Record<string, any> = { globe: Globe, github: Code2, file: FileText, phone: Phone }

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mcpConfig, setMcpConfig] = useState<Record<string, Record<string, string>>>({})
  const [enabledTools, setEnabledTools] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState(false)
  const [showCreds, setShowCreds] = useState<Record<string, boolean>>({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { window.location.href = '/auth'; return }
      loadSettings()
    })
  }, [])

  async function loadSettings() {
    const res = await fetch('/api/settings')
    const data = await res.json()
    if (data.mcpConfig) setMcpConfig(data.mcpConfig)
    if (data.enabledTools) setEnabledTools(new Set(data.enabledTools))
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mcpConfig,
        enabledTools: Array.from(enabledTools),
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggleTool(toolId: string) {
    const next = new Set(enabledTools)
    next.has(toolId) ? next.delete(toolId) : next.add(toolId)
    setEnabledTools(next)
  }

  function toggleProviderTools(provider: MCPProvider) {
    const providerToolIds = provider.tools.map(t => t.id)
    const allEnabled = providerToolIds.every(id => enabledTools.has(id))
    const next = new Set(enabledTools)
    if (allEnabled) {
      providerToolIds.forEach(id => next.delete(id))
    } else {
      providerToolIds.forEach(id => next.add(id))
    }
    setEnabledTools(next)
  }

  function updateCred(providerId: string, key: string, value: string) {
    setMcpConfig(prev => ({
      ...prev,
      [providerId]: { ...(prev[providerId] || {}), [key]: value },
    }))
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b]">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/50 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-zinc-400 hover:text-white transition">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <div className="w-px h-5 bg-zinc-800" />
            <span className="font-semibold">Settings</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">MCP Providers</h1>
        <p className="text-zinc-400 mb-8">Enable tools and configure credentials for each provider. The AI will only use tools you enable.</p>

        {/* Provider cards */}
        <div className="space-y-4">
          {MCP_PROVIDERS.map((provider) => {
            const Icon = iconMap[provider.icon] || Zap
            const providerToolIds = provider.tools.map(t => t.id)
            const allEnabled = providerToolIds.every(id => enabledTools.has(id))
            const hasCreds = provider.credentials && provider.credentials.length > 0
            const isManaged = !!provider.managed
            const userCreds = mcpConfig[provider.id] || {}
            const credsFilled = hasCreds ? provider.credentials!.every(c => userCreds[c.key]) : true

            return (
              <div key={provider.id} className={cn(
                'rounded-2xl border bg-[#111113] overflow-hidden transition',
                allEnabled ? 'border-indigo-500/30' : 'border-zinc-800'
              )}>
                {/* Header */}
                <div className="p-5 flex items-start gap-4">
                  <div className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition',
                    allEnabled ? 'bg-indigo-500/10' : 'bg-white/5'
                  )}>
                    <Icon className={cn('w-5 h-5', allEnabled ? 'text-indigo-400' : 'text-zinc-500')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{provider.name}</h3>
                      {allEnabled && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Active</span>}
                      {allEnabled && hasCreds && !credsFilled && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Missing credentials</span>
                      )}
                      {isManaged && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">Included in Pro</span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-400 mt-0.5">{provider.description}</p>
                  </div>
                  <button
                    onClick={() => toggleProviderTools(provider)}
                    className={cn(
                      'relative w-11 h-6 rounded-full transition shrink-0',
                      allEnabled ? 'bg-indigo-500' : 'bg-zinc-700'
                    )}
                  >
                    <div className={cn(
                      'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                      allEnabled ? 'translate-x-5' : 'translate-x-0.5'
                    )} />
                  </button>
                </div>

                {/* Tools */}
                <div className="px-5 pb-3 space-y-1">
                  {provider.tools.map((tool) => (
                    <label key={tool.id} className="flex items-center gap-3 py-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={enabledTools.has(tool.id)}
                        onChange={() => toggleTool(tool.id)}
                        className="accent-indigo-500 w-4 h-4"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-zinc-200">{tool.name}</span>
                        <span className="text-xs text-zinc-500 ml-2">{tool.description}</span>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Credentials — hidden for managed providers (hosted by Relay) */}
                {hasCreds && allEnabled && !isManaged && (
                  <div className="border-t border-zinc-800 p-5 space-y-4">
                    <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Credentials</p>
                    {provider.credentials!.map((cred) => (
                      <div key={cred.key}>
                        <label className="text-xs font-medium text-zinc-300 mb-1.5 block">
                          {cred.label} {cred.required && <span className="text-red-400">*</span>}
                        </label>
                        {cred.description && <p className="text-xs text-zinc-500 mb-2">{cred.description}</p>}
                        <div className="relative">
                          <input
                            type={cred.type === 'password' && !showCreds[cred.key] ? 'password' : 'text'}
                            value={userCreds[cred.key] || ''}
                            onChange={(e) => updateCred(provider.id, cred.key, e.target.value)}
                            placeholder={cred.placeholder}
                            className="w-full px-3.5 py-2.5 bg-[#0a0a0b] border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition font-mono"
                          />
                          {cred.type === 'password' && (
                            <button
                              onClick={() => setShowCreds(prev => ({ ...prev, [cred.key]: !prev[cred.key] }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                            >
                              {showCreds[cred.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Managed provider notice */}
                {isManaged && allEnabled && (
                  <div className="border-t border-zinc-800 p-5">
                    <p className="text-xs text-zinc-400">
                      <span className="text-indigo-400 font-medium">Relay-managed service.</span>{' '}
                      No configuration needed — calls are placed through Relay&apos;s phone infrastructure. Available on Pro and Unlimited plans.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white px-6 py-2.5 rounded-xl font-medium transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save settings'}
          </button>
          {saved && <span className="text-sm text-emerald-400 flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
        </div>
      </div>
    </div>
  )
}