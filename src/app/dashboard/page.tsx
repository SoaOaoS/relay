'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Phone, LogOut, Plus, MessageSquare, PanelLeftClose, PanelLeft, Zap, CreditCard, Loader2, PhoneCall, Bot, Settings, ChevronDown, Calendar, UtensilsCrossed, BedDouble, Pill, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { AVAILABLE_TOOLS } from '@/lib/mcp'
import { CALL_TEMPLATES, CallTemplate, CallField } from '@/lib/call-templates'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Link from 'next/link'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: { name: string; result: string }[]
}

interface Conversation {
  id: string
  title: string
  created_at: string
}

interface Call {
  id: string
  phone_number: string
  call_id: string | null
  status: string
  transcript: string | null
  duration: number | null
  created_at: string
  template?: string | null
}

interface Profile {
  messages_used: number
  is_pro: boolean
  is_unlimited: boolean
  email?: string
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [enabledTools, setEnabledTools] = useState<Set<string>>(new Set(AVAILABLE_TOOLS.map(t => t.id)))
  const [phoneModal, setPhoneModal] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneCalling, setPhoneCalling] = useState(false)
  const [phoneStep, setPhoneStep] = useState<'template' | 'details'>('template')
  const [selectedTemplate, setSelectedTemplate] = useState<CallTemplate | null>(null)
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({})
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [calls, setCalls] = useState<Call[]>([])
  const [callsOpen, setCallsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { window.location.href = '/auth'; return }
      setUser(user)
      loadProfile(user.id)
      loadConversations(user.id)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('messages_used, is_pro, is_unlimited, email').eq('id', userId).single()
    if (data) setProfile(data)
  }

  async function loadConversations(userId: string) {
    const { data } = await supabase.from('conversations').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (data) setConversations(data)
  }

  async function loadMessages(convId: string) {
    setLoadingMessages(true)
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true })
    if (data) setMessages(data.map(m => ({ id: m.id, role: m.role, content: m.content })))
    setLoadingMessages(false)
  }

  async function loadCalls(userId: string) {
    const { data } = await supabase.from('calls').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
    if (data) setCalls(data)
  }

  useEffect(() => {
    if (!user || !callsOpen) return
    loadCalls(user.id)
    const interval = setInterval(() => loadCalls(user.id), 10000)
    return () => clearInterval(interval)
  }, [user, callsOpen])

  function switchConversation(convId: string) {
    setActiveConv(convId)
    setMessages([])
    loadMessages(convId)
  }

  function newConversation() {
    setActiveConv(null)
    setMessages([])
  }

  async function sendMessage() {
    if (!input.trim() || sending) return
    const userMsg = input.trim()
    setInput('')
    setSending(true)
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          conversationId: activeConv,
          tools: Array.from(enabledTools),
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response, toolCalls: data.toolCalls }])
      if (!activeConv && data.conversationId) {
        setActiveConv(data.conversationId)
        setConversations(prev => [{ id: data.conversationId, title: userMsg.slice(0, 50), created_at: new Date().toISOString() }, ...prev])
      }
      if (profile) setProfile({ ...profile, messages_used: profile.messages_used + 1 })
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    }
    setSending(false)
  }

  function openPhoneModal() {
    setPhoneStep('template')
    setSelectedTemplate(null)
    setTemplateValues({})
    setPhoneNumber('')
    setPhoneModal(true)
  }

  function pickTemplate(tpl: CallTemplate) {
    setSelectedTemplate(tpl)
    setTemplateValues({})
    setPhoneStep('details')
  }

  function updateTemplateField(key: string, value: string) {
    setTemplateValues(prev => ({ ...prev, [key]: value }))
  }

  function requiredFieldsFilled(): boolean {
    if (!selectedTemplate) return false
    return selectedTemplate.fields.every(f => !f.required || (templateValues[f.key] && templateValues[f.key].trim()))
  }

  async function handlePhoneCall() {
    if (!phoneNumber.trim() || !selectedTemplate || !requiredFieldsFilled()) return
    setPhoneCalling(true)
    try {
      const res = await fetch('/api/vapi/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: phoneNumber,
          templateId: selectedTemplate.id,
          templateValues,
          conversationId: activeConv,
          context: selectedTemplate.buildContext(templateValues),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error || 'Failed to place call.'
        const upgrade = data.upgradeRequired ? ' Upgrade to Pro to enable phone calls.' : ''
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${msg}${upgrade}` }])
      } else {
        const tplLabel = data.template || selectedTemplate.label
        setMessages(prev => [...prev, { role: 'assistant', content: `📞 **${tplLabel} call placed to ${phoneNumber}**\n\nCall ID: \`${data.callId}\`\n\nThe assistant is on the line — I'll report back when the call completes with a summary and transcript.` }])
        setPhoneModal(false)
      }
      setPhoneNumber('')
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Failed to place call.' }])
    }
    setPhoneCalling(false)
  }

  async function handleUpgrade() {
    const res = await fetch('/api/stripe/checkout', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const plan = profile?.is_unlimited ? 'Unlimited' : profile?.is_pro ? 'Pro' : 'Free'
  const limit = profile?.is_unlimited ? Infinity : profile?.is_pro ? 500 : 20
  const used = profile?.messages_used || 0
  const pct = limit === Infinity ? 0 : Math.min(100, (used / limit) * 100)

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b]">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
    </div>
  )

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-white">
      {/* Mobile backdrop */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <div className={cn('flex flex-col transition-all duration-200 bg-[#0d0d0f] border-r border-zinc-800/50 z-30 md:relative fixed inset-y-0 left-0', sidebarOpen ? 'w-64' : 'w-0 overflow-hidden')}>
        <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" fill="white" />
            </div>
            Relay
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="text-zinc-500 hover:text-white"><PanelLeftClose className="w-4 h-4" /></button>
        </div>

        <div className="p-3">
          <button onClick={newConversation} className="w-full flex items-center gap-2 px-3 py-2.5 border border-zinc-800 rounded-xl text-sm text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-white/5 transition">
            <Plus className="w-4 h-4" /> New conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {conversations.map(c => (
            <button key={c.id} onClick={() => switchConversation(c.id)} className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition', activeConv === c.id ? 'bg-white/5 text-white font-medium' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200')}>
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>

        {/* Plan + User */}
        <div className="p-3 border-t border-zinc-800/50 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">{plan} plan</span>
            <span className="text-zinc-500">{used}/{limit === Infinity ? '∞' : limit}</span>
          </div>
          {plan === 'Free' && (
            <button onClick={handleUpgrade} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-lg text-xs font-medium hover:from-indigo-400 hover:to-violet-500 transition">
              <CreditCard className="w-3 h-3" /> Upgrade to Pro
            </button>
          )}
          <div className="relative">
            <button onClick={() => setSettingsOpen(!settingsOpen)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition">
              <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-medium">{user.email?.[0]?.toUpperCase()}</div>
              <span className="truncate flex-1 text-left">{user.email}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {settingsOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#18181b] border border-zinc-800 rounded-lg shadow-xl py-1">
                <Link href="/settings" className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition">
                  <Settings className="w-3 h-3" /> MCP Providers
                </Link>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition">
                  <LogOut className="w-3 h-3" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b border-zinc-800/50 flex items-center px-4 gap-2 bg-[#0a0a0b]">
          {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="text-zinc-500 hover:text-white"><PanelLeft className="w-4 h-4" /></button>}
          <div className="flex-1" />
          <button onClick={() => setToolsOpen(!toolsOpen)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition', toolsOpen ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:text-white hover:bg-white/5')}>
            <Zap className="w-4 h-4" /> Tools
          </button>
          <button onClick={() => setCallsOpen(!callsOpen)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition', callsOpen ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:text-white hover:bg-white/5')}>
            <PhoneCall className="w-4 h-4" /> Calls
          </button>
          <button onClick={openPhoneModal} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition">
            <Phone className="w-4 h-4" /> Call
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Chat */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
              ) : messages.length === 0 ? (
                <div className="text-center py-20 fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-5">
                    <Bot className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">What can I do for you?</h2>
                  <p className="text-zinc-500 text-sm max-w-sm mx-auto">Ask me to research, write, analyze, search the web, make a call, or anything else.</p>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={m.id || i} className={cn('flex gap-3 fade-in', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {m.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Zap className="w-4 h-4 text-white" fill="white" />
                      </div>
                    )}
                    <div className={cn('max-w-[75%] rounded-2xl px-4 py-3 chat-message text-sm leading-relaxed', m.role === 'user' ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-br-md' : 'bg-[#18181b] text-zinc-100 border border-zinc-800 rounded-bl-md')}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      {m.toolCalls && m.toolCalls.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-zinc-700/50 space-y-1">
                          {m.toolCalls.map((tc, j) => (
                            <div key={j} className="flex items-center gap-1.5 text-xs text-zinc-500">
                              <Zap className="w-3 h-3 text-indigo-400" /> Used {tc.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {sending && (
                <div className="flex gap-3 justify-start fade-in">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-white" fill="white" />
                  </div>
                  <div className="bg-[#18181b] border border-zinc-800 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-zinc-800/50 p-4 bg-[#0a0a0b]">
              <div className="max-w-3xl mx-auto flex gap-2 items-end">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="Ask me anything..."
                  className="flex-1 px-4 py-3 bg-[#111113] border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                />
                <button onClick={sendMessage} disabled={sending || !input.trim()} className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white p-3 rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Tools panel */}
          {toolsOpen && (
            <div className="w-64 border-l border-zinc-800/50 overflow-y-auto p-4 space-y-2 bg-[#0d0d0f]">
              <h3 className="font-medium text-sm flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-indigo-400" /> Tools</h3>
              <p className="text-xs text-zinc-500 mb-3">Toggle which tools the AI can use</p>
              {AVAILABLE_TOOLS.map((tool) => (
                <label key={tool.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={enabledTools.has(tool.id)}
                    onChange={() => {
                      const next = new Set(enabledTools)
                      next.has(tool.id) ? next.delete(tool.id) : next.add(tool.id)
                      setEnabledTools(next)
                    }}
                    className="mt-0.5 accent-indigo-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-zinc-200">{tool.name}</div>
                    <div className="text-xs text-zinc-500">{tool.description}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Calls panel */}
          {callsOpen && (
            <div className="w-72 border-l border-zinc-800/50 overflow-y-auto p-4 space-y-3 bg-[#0d0d0f]">
              <h3 className="font-medium text-sm flex items-center gap-2 mb-3"><PhoneCall className="w-4 h-4 text-indigo-400" /> Call History</h3>
              <p className="text-xs text-zinc-500 mb-2">Auto-refreshes every 10s</p>
              {calls.length === 0 ? (
                <p className="text-sm text-zinc-600 py-8 text-center">No calls yet</p>
              ) : (
                calls.map(c => (
                  <div key={c.id} className="border border-zinc-800 rounded-xl p-3 bg-[#111113] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-zinc-200">{c.phone_number}</span>
                        {c.template && <span className="text-xs text-zinc-500 ml-2">· {c.template}</span>}
                      </div>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', c.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : c.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400')}>{c.status}</span>
                    </div>
                    <div className="text-xs text-zinc-500">{new Date(c.created_at).toLocaleString()}</div>
                    {c.duration != null && <div className="text-xs text-zinc-500">{Math.floor(c.duration / 60)}m {c.duration % 60}s</div>}
                    {c.transcript && (
                      <details className="mt-1">
                        <summary className="text-xs text-indigo-400 cursor-pointer">Transcript</summary>
                        <p className="text-xs text-zinc-400 mt-1 whitespace-pre-wrap max-h-40 overflow-y-auto">{c.transcript}</p>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Phone modal */}
      {phoneModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setPhoneModal(false)}>
          <div className="bg-[#111113] border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-2 p-5 border-b border-zinc-800 sticky top-0 bg-[#111113] z-10">
              {phoneStep === 'details' && (
                <button onClick={() => setPhoneStep('template')} className="text-zinc-500 hover:text-white text-sm">&larr;</button>
              )}
              <Phone className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-lg flex-1">
                {phoneStep === 'template' ? 'New phone call' : selectedTemplate?.label}
              </h3>
              <button onClick={() => setPhoneModal(false)} className="text-zinc-500 hover:text-white text-sm">✕</button>
            </div>

            <div className="p-5">
              {/* Step 1: Choose a template */}
              {phoneStep === 'template' && (
                <div className="space-y-2">
                  <p className="text-sm text-zinc-400 mb-4">What do you need the call for?</p>
                  {CALL_TEMPLATES.map((tpl) => {
                    const Icon = { Calendar, UtensilsCrossed, BedDouble, Pill, Phone }[tpl.icon] || Phone
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => pickTemplate(tpl)}
                        className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-zinc-800 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition group text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-zinc-100">{tpl.label}</div>
                          <div className="text-xs text-zinc-500 truncate">{tpl.description}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400 transition shrink-0" />
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Step 2: Fill in the template fields + phone number */}
              {phoneStep === 'details' && selectedTemplate && (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-400">{selectedTemplate.description}</p>

                  {selectedTemplate.fields.map((field: CallField) => (
                    <div key={field.key}>
                      <label className="text-xs font-medium text-zinc-300 mb-1.5 block">
                        {field.label} {field.required && <span className="text-red-400">*</span>}
                      </label>
                      {field.description && <p className="text-xs text-zinc-500 mb-1.5">{field.description}</p>}
                      {field.type === 'select' && field.options ? (
                        <select
                          value={templateValues[field.key] || ''}
                          onChange={(e) => updateTemplateField(field.key, e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-[#0a0a0b] border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                        >
                          <option value="" disabled>Select…</option>
                          {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          placeholder={field.placeholder}
                          value={templateValues[field.key] || ''}
                          onChange={(e) => updateTemplateField(field.key, e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-[#0a0a0b] border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                        />
                      )}
                    </div>
                  ))}

                  {/* Phone number */}
                  <div className="pt-2 border-t border-zinc-800">
                    <label className="text-xs font-medium text-zinc-300 mb-1.5 block">
                      Phone number to call <span className="text-red-400">*</span>
                    </label>
                    <p className="text-xs text-zinc-500 mb-1.5">International format, e.g. +33123456789</p>
                    <input
                      type="tel"
                      placeholder="+33123456789"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#0a0a0b] border border-zinc-800 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setPhoneStep('template')} className="px-4 py-2.5 border border-zinc-800 rounded-xl text-sm text-zinc-300 hover:bg-white/5 transition">Back</button>
                    <button
                      onClick={handlePhoneCall}
                      disabled={phoneCalling || !phoneNumber.trim() || !requiredFieldsFilled()}
                      className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-600 text-white py-2.5 rounded-xl text-sm font-medium hover:from-indigo-400 hover:to-violet-500 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {phoneCalling ? <><Loader2 className="w-4 h-4 animate-spin" /> Calling…</> : <><Phone className="w-4 h-4" /> Place call</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}