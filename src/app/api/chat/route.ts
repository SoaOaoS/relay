import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolve, join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { glob as globAsync } from 'glob'
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'https://api.ollama.com/v1'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:70b'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const VAPI_TOKEN = process.env.VAPI_TOKEN
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID
const WORKSPACE_ROOT = resolve(process.env.WORKSPACE_ROOT || process.cwd())
const MAX_TOOL_ROUNDS = 6

const SYSTEM_PROMPT = `You are Relay, a personal AI assistant that gets things done — not just chat.

You have access to tools. Use them proactively when the user's request needs real action:
- web-search: search the live web for current information
- web-fetch: read the full content of a web page
- github-search: find code, issues, PRs across GitHub
- github-read: read a file from any GitHub repo
- file-read: read a file from the workspace
- file-write: create or overwrite a file in the workspace
- file-glob: find files by glob pattern
- phone-call: place an AI phone call to a number

How you work:
1. If a request needs external info or action, call the right tool.
2. Read the tool result, then continue reasoning or call another tool if needed.
3. When you have enough information, give a clear, helpful final answer.
4. Mention which tools you used and what you found, briefly.

Be proactive, concise, and helpful. You help with research, writing, analysis, coding, planning, calls — anything.`

const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'web-search',
      description: 'Search the web for current information. Returns instant-answer abstracts and related topic snippets from DuckDuckGo.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search query' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web-fetch',
      description: 'Fetch the content of a web page URL and return it as cleaned text (HTML tags stripped).',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'Full URL to fetch' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'github-search',
      description: 'Search for code across GitHub repositories.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'GitHub code search query' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'github-read',
      description: 'Read a file from a GitHub repository by owner, repo, and path.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          path: { type: 'string', description: 'File path within the repo' },
        },
        required: ['owner', 'repo', 'path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file-read',
      description: 'Read a file from the workspace filesystem.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Relative path from workspace root' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file-write',
      description: 'Write content to a file in the workspace (creates parent dirs).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path from workspace root' },
          content: { type: 'string', description: 'File content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file-glob',
      description: 'Find files in the workspace by glob pattern (e.g. "**/*.ts").',
      parameters: {
        type: 'object',
        properties: { pattern: { type: 'string', description: 'Glob pattern' } },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'phone-call',
      description: 'Place an AI-powered outbound phone call to the given number. The assistant on the call uses the provided context. Returns a call ID.',
      parameters: {
        type: 'object',
        properties: {
          number: { type: 'string', description: 'Phone number in E.164 format, e.g. +33634554177' },
          context: { type: 'string', description: 'Context/instructions for the call assistant' },
        },
        required: ['number'],
      },
    },
  },
]

// Tool executor — mirrors /api/mcp but runs in-process to avoid an extra HTTP hop.
async function executeTool(userId: string, name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'github-search': {
      const res = await fetch(`https://api.github.com/search/code?q=${encodeURIComponent(args.query as string)}`, {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
      })
      const data = await res.json()
      return JSON.stringify({ items: data.items?.slice(0, 10) || [], total: data.total_count })
    }
    case 'github-read': {
      const { owner, repo, path } = args as { owner: string; repo: string; path: string }
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
      })
      const data = await res.json()
      if (data.content) return Buffer.from(data.content, 'base64').toString('utf-8')
      return JSON.stringify(data)
    }
    case 'web-search': {
      const q = args.query as string
      const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`)
      const ddgData = await ddgRes.json()
      const results: any[] = []
      if (ddgData.AbstractText) results.push({ type: 'abstract', text: ddgData.AbstractText, source: ddgData.AbstractURL })
      for (const t of ddgData.RelatedTopics || []) {
        if (t.Text) results.push({ type: 'related', text: t.Text, url: t.FirstURL })
        if (t.Topics) for (const sub of t.Topics) if (sub.Text) results.push({ type: 'related', text: sub.Text, url: sub.FirstURL })
      }
      return JSON.stringify({ results: results.slice(0, 10), abstract: ddgData.AbstractText || '' })
    }
    case 'web-fetch': {
      const url = args.url as string
      const res = await fetch(url, { headers: { 'User-Agent': 'Relay/1.0' } })
      const text = await res.text()
      const isHtml = (res.headers.get('content-type') || '').includes('text/html')
      const content = isHtml
        ? text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20000)
        : text.slice(0, 20000)
      return content
    }
    case 'file-read': {
      const safePath = resolve(join(WORKSPACE_ROOT, args.path as string))
      if (!safePath.startsWith(WORKSPACE_ROOT)) return JSON.stringify({ error: 'Path outside workspace' })
      return await readFile(safePath, 'utf-8')
    }
    case 'file-write': {
      const safePath = resolve(join(WORKSPACE_ROOT, args.path as string))
      if (!safePath.startsWith(WORKSPACE_ROOT)) return JSON.stringify({ error: 'Path outside workspace' })
      await mkdir(resolve(safePath, '..'), { recursive: true })
      await writeFile(safePath, args.content as string, 'utf-8')
      return JSON.stringify({ ok: true, bytes: (args.content as string).length })
    }
    case 'file-glob': {
      const matches = await globAsync(args.pattern as string, { cwd: WORKSPACE_ROOT, ignore: ['**/node_modules/**', '**/.git/**', '**/.next/**'] })
      return JSON.stringify({ files: matches.slice(0, 100) })
    }
    case 'phone-call': {
      const vapiRes = await fetch('https://api.vapi.ai/call', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${VAPI_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumberId: VAPI_PHONE_NUMBER_ID,
          assistantId: VAPI_ASSISTANT_ID,
          customer: { number: args.number as string },
          assistantOverrides: { variableValues: { context: args.context || 'No prior context', user_name: 'User' } },
        }),
      })
      const callData = await vapiRes.json()
      await supabaseAdmin.from('calls').insert({
        user_id: userId,
        phone_number: args.number as string,
        call_id: callData.id,
        status: 'initiated',
      })
      return JSON.stringify({ callId: callData.id, status: callData.status })
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

export async function POST(req: NextRequest) {
  const { message, conversationId, tools: enabledTools, messages: history } = await req.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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
    return Response.json({ response: "You've reached your message limit. Upgrade to Pro for more." })
  }

  await supabaseAdmin.from('profiles').upsert({ id: user.id, messages_used: used + 1 })

  let convId = conversationId
  if (!convId) {
    const { data: conv } = await supabaseAdmin.from('conversations').insert({
      user_id: user.id,
      title: message.slice(0, 100),
    }).select().single()
    convId = conv?.id
  }

  await supabaseAdmin.from('messages').insert({ conversation_id: convId, role: 'user', content: message })

  // Build the message list for Ollama
  type OllamaMsg = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: any[]; tool_call_id?: string; name?: string }
  const ollamaMessages: OllamaMsg[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  // Filter tool definitions by user-enabled tools
  const enabled = new Set<string>(enabledTools || [])
  const activeTools = enabled.size > 0 ? TOOL_DEFINITIONS.filter(t => enabled.has(t.function.name)) : TOOL_DEFINITIONS

  const toolCallsLog: { name: string; result: string }[] = []
  let finalResponse = ''
  let rounds = 0

  try {
    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++
      const res = await fetch(`${OLLAMA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: ollamaMessages,
          tools: activeTools,
          stream: false,
          max_tokens: 4096,
        }),
      })
      const data = await res.json()
      const choice = data.choices?.[0]
      const msg = choice?.message

      if (!msg) {
        finalResponse = 'No response from model.'
        break
      }

      // If the model made tool calls, execute them and feed results back
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Append the assistant message with tool_calls to the conversation
        ollamaMessages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls })

        for (const tc of msg.tool_calls) {
          const toolName = tc.function?.name || tc.name
          let toolArgs: Record<string, unknown> = {}
          try { toolArgs = JSON.parse(tc.function?.arguments || '{}') } catch { toolArgs = {} }
          const result = await executeTool(user.id, toolName, toolArgs)
          const resultShort = result.length > 500 ? result.slice(0, 500) + '...' : result
          toolCallsLog.push({ name: toolName, result: `Executed ${toolName}` })
          ollamaMessages.push({ role: 'tool', content: result, tool_call_id: tc.id, name: toolName })
        }
        continue
      }

      // No tool calls — this is the final answer
      finalResponse = msg.content || 'No response.'
      break
    }

    if (!finalResponse) finalResponse = 'I reached the tool-call limit without a final answer. Here is what I found so far.'

    await supabaseAdmin.from('messages').insert({
      conversation_id: convId,
      role: 'assistant',
      content: finalResponse,
    })

    return Response.json({ response: finalResponse, conversationId: convId, toolCalls: toolCallsLog })
  } catch (e: any) {
    const errMsg = `Error: ${e.message}`
    await supabaseAdmin.from('messages').insert({
      conversation_id: convId,
      role: 'assistant',
      content: errMsg,
    })
    return Response.json({ response: errMsg, conversationId: convId, toolCalls: toolCallsLog })
  }
}