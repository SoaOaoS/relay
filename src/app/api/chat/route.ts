import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

const SYSTEM_PROMPT = `You are Relay, an AI coding assistant with MCP tool access.

You can use these tools when the user asks:
- github-search: Search code, issues, PRs on GitHub
- github-read: Read files and repos from GitHub
- web-search: Search the web for information
- web-fetch: Fetch and read web pages
- file-read: Read files from the workspace
- file-write: Write and edit files
- file-glob: Search files by pattern
- phone-call: Make AI-powered phone calls

When you use a tool, respond with the result and mention which tool you used.
Always write clean, production-ready code. Explain your reasoning briefly.`

export async function POST(req: NextRequest) {
  const { message, conversationId, tools, messages: history } = await req.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Check usage
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('messages_used, is_pro, is_unlimited')
    .eq('id', user.id)
    .single()

  const isUnlimited = profile?.is_unlimited || false
  const isPro = profile?.is_pro || false
  const used = profile?.messages_used || 0
  const limit = isUnlimited ? Infinity : isPro ? 500 : 20

  if (used >= limit) {
    return Response.json({ response: 'You\'ve reached your message limit. Upgrade to Pro for more.' })
  }

  // Increment usage
  await supabaseAdmin.from('profiles').upsert({
    id: user.id,
    messages_used: used + 1,
  })

  // Create conversation if new
  let convId = conversationId
  if (!convId) {
    const { data: conv } = await supabaseAdmin.from('conversations').insert({
      user_id: user.id,
      title: message.slice(0, 100),
    }).select().single()
    convId = conv?.id
  }

  // Save user message
  await supabaseAdmin.from('messages').insert({
    conversation_id: convId,
    role: 'user',
    content: message,
  })

  // Call Anthropic
  const anthropicMessages = [
    ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ]

  let toolCalls: { name: string; result: string }[] = []

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: anthropicMessages,
      }),
    })

    const data = await res.json()
    const response = data.content?.[0]?.text || 'No response'

    // Save assistant message
    await supabaseAdmin.from('messages').insert({
      conversation_id: convId,
      role: 'assistant',
      content: response,
    })

    return Response.json({ response, conversationId: convId, toolCalls })
  } catch (e: any) {
    return Response.json({ response: `Error: ${e.message}`, conversationId: convId, toolCalls: [] })
  }
}
