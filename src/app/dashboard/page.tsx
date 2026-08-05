'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Phone, Globe, FileText, Search, LogOut, Plus, MessageSquare, PanelLeftClose, PanelLeft, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { AVAILABLE_TOOLS, executeTool, MCPTool } from '@/lib/mcp'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: { name: string; result: string }[]
}

interface Conversation {
  id: string
  title: string
  created_at: string
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) window.location.href = '/auth'
      setUser(user)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('conversations').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setConversations(data)
    })
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    } catch (e) {
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
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Failed to place call. Please try again.' }])
    }
    setPhoneCalling(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div className={cn('border-r flex flex-col transition-all duration-200', sidebarOpen ? 'w-64' : 'w-0 overflow-hidden')}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <Bot className="w-5 h-5 text-blue-600" />
            Relay
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground"><PanelLeftClose className="w-4 h-4" /></button>
        </div>
        <div className="p-3">
          <button className="w-full flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition">
            <Plus className="w-4 h-4" /> New conversation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          {conversations.map(c => (
            <button key={c.id} onClick={() => setActiveConv(c.id)} className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition', activeConv === c.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100')}>
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>
        <div className="p-3 border-t">
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-gray-100 transition">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b flex items-center px-4 gap-2">
          {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground"><PanelLeft className="w-4 h-4" /></button>}
          <div className="flex-1" />
          <button onClick={() => setToolsOpen(!toolsOpen)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition', toolsOpen ? 'bg-blue-50 text-blue-700' : 'text-muted-foreground hover:text-foreground hover:bg-gray-100')}>
            <Zap className="w-4 h-4" /> Tools
          </button>
          <button onClick={() => setPhoneModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-gray-100 transition">
            <Phone className="w-4 h-4" /> Call
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Chat */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-16">
                  <Bot className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-2">What can I help you with?</h2>
                  <p className="text-muted-foreground text-sm">Ask me to research, write, analyze, search the web, or make a call.</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[80%] rounded-2xl px-4 py-3 chat-message', m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-foreground')}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    {m.toolCalls && m.toolCalls.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-300/30 space-y-1">
                        {m.toolCalls.map((tc, j) => (
                          <div key={j} className="flex items-center gap-1.5 text-xs opacity-70">
                            <Zap className="w-3 h-3" /> Used {tc.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
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
            <div className="border-t p-4">
              <div className="flex gap-2 max-w-4xl mx-auto">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder="Ask me anything... (Shift+Enter for new line)"
                  className="flex-1 px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={sendMessage} disabled={sending || !input.trim()} className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Tools panel */}
          {toolsOpen && (
            <div className="w-72 border-l overflow-y-auto p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Zap className="w-4 h-4" /> MCP Tools</h3>
              <p className="text-xs text-muted-foreground">Toggle tools the AI can use</p>
              {AVAILABLE_TOOLS.map((tool) => (
                <label key={tool.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabledTools.has(tool.id)}
                    onChange={() => {
                      const next = new Set(enabledTools)
                      next.has(tool.id) ? next.delete(tool.id) : next.add(tool.id)
                      setEnabledTools(next)
                    }}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium">{tool.name}</div>
                    <div className="text-xs text-muted-foreground">{tool.description}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Phone modal */}
      {phoneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setPhoneModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <Phone className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-lg">Make a phone call</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">The AI assistant will call this number and handle the conversation.</p>
            <input
              type="tel"
              placeholder="+33634554177"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button onClick={() => setPhoneModal(false)} className="flex-1 py-2.5 border rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handlePhoneCall} disabled={phoneCalling || !phoneNumber.trim()} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {phoneCalling ? 'Calling...' : 'Call'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
