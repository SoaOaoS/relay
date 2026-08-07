'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { MCP_PROVIDERS, MCPProvider } from '@/lib/mcp-providers'
import { Zap, Globe, FileText, Phone, Check, ArrowLeft, Loader2, Save, Eye, EyeOff, Code2, Server, Plus, Trash2, Power } from 'lucide-react'
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
  const [mcpServers, setMcpServers] = useState<{ id: string; name: string; command: string; args: string[]; env: Record<string, string>; enabled: boolean }[]>([])
  const [showAddServer, setShowAddServer] = useState(false)
  const [newServer, setNewServer] = useState({ name: '', command: '', args: '', env: '' })
  const [addingServer, setAddingServer] = useState(false)

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
    loadMCPServers()
  }

  async function loadMCPServers() {
    const res = await fetch('/api/mcp/servers')
    const data = await res.json()
    if (data.servers) setMcpServers(data.servers)
  }

  async function addMCPServer() {
    if (!newServer.name || !newServer.command) return
    setAddingServer(true)
    const args = newServer.args.split(/\s+/).filter(Boolean)
    let env: Record<string, string> = {}
    try { env = JSON.parse(newServer.env || '{}') } catch { /* ignore */ }
    await fetch('/api/mcp/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newServer.name, command: newServer.command, args, env }),
    })
    setNewServer({ name: '', command: '', args: '', env: '' })
    setShowAddServer(false)
    setAddingServer(false)
    loadMCPServers()
  }

  async function deleteMCPServer(id: string) {
    await fetch('/api/mcp/servers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadMCPServers()
  }

  async function toggleMCPServer(id: string, enabled: boolean) {
    await fetch('/api/mcp/servers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    })
    loadMCPServers()
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

        {/* MCP Servers section */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">MCP Servers</h2>
              <p className="text-zinc-400 mt-1 text-sm">Connect external MCP servers (stdio or HTTP). Tools from these servers are available to the AI in chat.</p>
            </div>
            <button
              onClick={() => setShowAddServer(!showAddServer)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-800 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition text-sm text-zinc-300"
            >
              <Plus className="w-4 h-4" /> Add server
            </button>
          </div>

          {/* Add server form */}
          {showAddServer && (
            <div className="rounded-2xl border border-zinc-800 bg-[#111113] p-5 space-y-4 mb-4">
              <div>
                <label className="text-xs font-medium text-zinc-300 mb-1.5 block">Name <span className="text-red-400">*</span></label>
                <input
                  value={newServer.name}
                  onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                  placeholder="github-mcp"
                  className="w-full px-3.5 py-2.5 bg-[#0a0a0b] border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-300 mb-1.5 block">Command or URL <span className="text-red-400">*</span></label>
                <p className="text-xs text-zinc-500 mb-1.5">Local: <code className="text-indigo-400">npx</code> or a binary path. Remote: <code className="text-indigo-400">https://...</code> URL</p>
                <input
                  value={newServer.command}
                  onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                  placeholder="npx -y @anthropic-ai/mcp-server-github or https://mcp.example.com/sse"
                  className="w-full px-3.5 py-2.5 bg-[#0a0a0b] border border-zinc-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-300 mb-1.5 block">Args (space-separated)</label>
                <input
                  value={newServer.args}
                  onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
                  placeholder="-y @anthropic-ai/mcp-server-github"
                  className="w-full px-3.5 py-2.5 bg-[#0a0a0b] border border-zinc-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-300 mb-1.5 block">Env vars (JSON)</label>
                <input
                  value={newServer.env}
                  onChange={(e) => setNewServer({ ...newServer, env: e.target.value })}
                  placeholder='{"GITHUB_TOKEN": "ghp_xxx"}'
                  className="w-full px-3.5 py-2.5 bg-[#0a0a0b] border border-zinc-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <button
                onClick={addMCPServer}
                disabled={addingServer || !newServer.name || !newServer.command}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-indigo-400 hover:to-violet-500 transition disabled:opacity-50"
              >
                {addingServer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {addingServer ? 'Adding...' : 'Add server'}
              </button>
            </div>
          )}

          {/* Server list */}
          <div className="space-y-3">
            {mcpServers.length === 0 && !showAddServer && (
              <div className="rounded-2xl border border-zinc-800 bg-[#111113] p-8 text-center">
                <Server className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No MCP servers configured. Add one to extend the AI with custom tools.</p>
              </div>
            )}
            {mcpServers.map((srv) => (
              <div key={srv.id} className={cn('rounded-2xl border bg-[#111113] p-4', srv.enabled ? 'border-zinc-700' : 'border-zinc-800 opacity-60')}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    <Server className={cn('w-5 h-5', srv.enabled ? 'text-indigo-400' : 'text-zinc-500')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{srv.name}</span>
                      {srv.enabled && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Active</span>}
                    </div>
                    <code className="text-xs text-zinc-500 truncate block">{srv.command} {srv.args.join(' ')}</code>
                  </div>
                  <button onClick={() => toggleMCPServer(srv.id, !srv.enabled)} className="text-zinc-500 hover:text-white p-2 transition" title={srv.enabled ? 'Disable' : 'Enable'}>
                    <Power className={cn('w-4 h-4', srv.enabled && 'text-emerald-400')} />
                  </button>
                  <button onClick={() => deleteMCPServer(srv.id)} className="text-zinc-500 hover:text-red-400 p-2 transition" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
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