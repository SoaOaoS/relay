'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Phone, LogOut, Plus, MessageSquare, PanelLeftClose, PanelLeft, Zap, CreditCard, Loader2, PhoneCall } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { AVAILABLE_TOOLS } from '@/lib/mcp'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
}

interface Profile {
  messages_used: number
  is_pro: boolean
  is_unlimited: boolean
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
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [calls, setCalls] = useState<Call[]>([])
  const [callsOpen, setCallsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Close sidebar by default on mobile
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
    const { data } = await supabase.from('profiles').select('messages_used, is_pro, is_unlimited').eq('id', userId).single()
    if (data) setProfile(data)
  }

  async function loadConversations(userId: string) {
    const { data } = await supabase.from('conversations').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (data) setConversations(data)
  }

  async function loadMessages(convId: string) {
    setLoadingMessages(true)
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true })
    if (data) {
      setMessages(data.map(m => ({ id: m.id, role: m.role, content: m.content })))
    }
    setLoadingMessages(false)
  }

  async function loadCalls(userId: string) {
    const { data } = await supabase.from('calls').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
    if (data) setCalls(data)
  }

  // Poll for call status updates every 10s when calls panel is open
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
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    }
    setSending(false)
  }

  async function handlePhoneCall() {
    if (!phoneNumber.trim()) return
    setPhoneCalling(true)
    try {
      const res = await fetch('/api/vapi/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phoneNumber, context: messages.map(m => `${m.role}: ${m.content}`).join('\n') }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: `📞 **Call placed to ${phoneNumber}**\n\nCall ID: \`${data.callId}\`\n\nI'll update you when the call completes.` }])
      setPhoneModal(false)
      setPhoneNumber('')
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Failed to place call. Please try again.' }])
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
  const remaining = limit === Infinity ? '∞' : Math.max(0, limit - used)

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>

  return (
    <div className="flex h-screen bg-white">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={cn('border-r flex flex-col transition-all duration-200 bg-gray-50/50 z-30 md:relative fixed inset-y-0 left-0 shadow-lg md:shadow-none', sidebarOpen ? 'w-64' : 'w-0 overflow-hidden')}>
        <div className="p-4 border-b flex items-center justify-between bg-white">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Bot className="w-5 h-5 text-blue-600" />
            Relay
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600"><PanelLeftClose className="w-4 h-4" /></button>
        </div>

        <div className="p-3">
          <button onClick={newConversation} className="w-full flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:text-gray-700 hover:border-gray-400 transition">
            <Plus className="w-4 h-4" /> New conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
          {conversations.map(c => (
            <button key={c.id} onClick={() => switchConversation(c.id)} className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition', activeConv === c.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100')}>
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>

        <div className="p-3 border-t bg-white space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <span>{plan} plan</span>
            <span>{used}/{limit === Infinity ? '∞' : limit} messages</span>
          </div>
          {plan === 'Free' && (
            <button onClick={handleUpgrade} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
              <CreditCard className="w-3.5 h-3.5" /> Upgrade to Pro
            </button>
          )}
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b flex items-center px-4 gap-2 bg-white">
          {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-gray-600"><PanelLeft className="w-4 h-4" /></button>}
          <div className="flex-1" />
          <button onClick={() => setToolsOpen(!toolsOpen)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition', toolsOpen ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100')}>
            <Zap className="w-4 h-4" /> Tools
          </button>
          <button onClick={() => setCallsOpen(!callsOpen)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition', callsOpen ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100')}>
            <PhoneCall className="w-4 h-4" /> Calls
          </button>
          <button onClick={() => setPhoneModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition">
            <Phone className="w-4 h-4" /> Call
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Chat */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16">
                  <Bot className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-2">What can I help you with?</h2>
                  <p className="text-gray-500 text-sm max-w-sm mx-auto">Ask me to research, write, analyze, search the web, or make a call. I can do it all.</p>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={m.id || i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[80%] rounded-2xl px-4 py-3 chat-message', m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900')}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      {m.toolCalls && m.toolCalls.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-300/30 space-y-1">
                          {m.toolCalls.map((tc, j) => (
                            <div key={j} className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Zap className="w-3 h-3" /> Used {tc.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-4 py-3">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-4 bg-white">
              <div className="flex gap-2 max-w-4xl mx-auto">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="Ask me anything... (Shift+Enter for new line)"
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button onClick={sendMessage} disabled={sending || !input.trim()} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Tools panel */}
          {toolsOpen && (
            <div className="w-72 border-l overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Zap className="w-4 h-4" /> MCP Tools</h3>
              <p className="text-xs text-gray-500">Toggle tools the AI can use</p>
              {AVAILABLE_TOOLS.map((tool) => (
                <label key={tool.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={enabledTools.has(tool.id)}
                    onChange={() => {
                      const next = new Set(enabledTools)
                      next.has(tool.id) ? next.delete(tool.id) : next.add(tool.id)
                      setEnabledTools(next)
                    }}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium">{tool.name}</div>
                    <div className="text-xs text-gray-500">{tool.description}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Calls panel */}
          {callsOpen && (
            <div className="w-80 border-l overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              <h3 className="font-semibold text-sm flex items-center gap-2"><PhoneCall className="w-4 h-4" /> Call History</h3>
              <p className="text-xs text-gray-500">Auto-refreshes every 10s</p>
              {calls.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">No calls yet</p>
              ) : (
                calls.map(c => (
                  <div key={c.id} className="border rounded-lg p-3 bg-white space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{c.phone_number}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', c.status === 'completed' ? 'bg-green-100 text-green-700' : c.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700')}>
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString()}</div>
                    {c.duration != null && <div className="text-xs text-gray-500">Duration: {Math.floor(c.duration / 60)}m {c.duration % 60}s</div>}
                    {c.transcript && (
                      <details className="mt-1">
                        <summary className="text-xs text-blue-600 cursor-pointer">Transcript</summary>
                        <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap max-h-40 overflow-y-auto">{c.transcript}</p>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setPhoneModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <Phone className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-lg">Make a phone call</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Relay will call this number and handle the conversation. It will report back with a summary.</p>
            <input
              type="tel"
              placeholder="+33634554177"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button onClick={() => setPhoneModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handlePhoneCall} disabled={phoneCalling || !phoneNumber.trim()} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {phoneCalling ? 'Calling...' : 'Call'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
