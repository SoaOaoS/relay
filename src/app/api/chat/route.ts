import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolve, join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { glob as globAsync } from 'glob'
import { buildCredEnv } from '@/lib/mcp-providers'
import { canUsePhoneCalls } from '@/lib/stripe'
import { getTemplate } from '@/lib/call-templates'

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'https://ollama.com'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:70b'
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || ''
const WORKSPACE_ROOT = resolve(process.env.WORKSPACE_ROOT || process.cwd())
const MAX_TOOL_ROUNDS = 10

const SYSTEM_PROMPT = `You are Relay, a personal AI assistant that gets things done — not just chat.

You have access to tools. Use them proactively and chain them together when a request needs multiple steps:
- web-search: search the live web for current information
- web-fetch: read the full content of a web page (use after web-search to dig deeper)
- github-search: find code, issues, PRs across GitHub
- github-read: read a file from any GitHub repo
- file-read: read a file from the workspace
- file-write: create or overwrite a file in the workspace
- file-glob: find files by glob pattern
- phone-call: place an AI phone call to a number

How you work:
1. Analyse the request. If it needs external info or action, call the right tool(s).
2. Read tool results, then continue reasoning or call more tools if needed.
3. You can call multiple tools in one round, and chain rounds up to 10 deep.
4. When you have enough information, give a clear, helpful final answer.
5. Briefly mention which tools you used at the end.

Examples of multi-tool chains:
- "Find the best headphones under $200 and call the store": web-search → web-fetch (read reviews) → phone-call
- "Check this repo's README and save a summary": github-read → file-write
- "Search for X and save the results to a file": web-search → file-write

Be proactive, concise, and helpful. You help with research, writing, analysis, coding, planning, calls — anything.`

const TOOL_DEFINITIONS = [
  { type: 'function' as const, function: { name: 'web-search', description: 'Search the web for current information using DuckDuckGo.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'The search query' } }, required: ['query'] } } },
  { type: 'function' as const, function: { name: 'web-fetch', description: 'Fetch and read the full content of a web page URL.', parameters: { type: 'object', properties: { url: { type: 'string', description: 'The URL to fetch' } }, required: ['url'] } } },
  { type: 'function' as const, function: { name: 'github-search', description: 'Search for code, issues, and PRs across GitHub repositories.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query (supports GitHub search syntax)' } }, required: ['query'] } } },
  { type: 'function' as const, function: { name: 'github-read', description: 'Read a file from a GitHub repository.', parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, path: { type: 'string' } }, required: ['owner', 'repo', 'path'] } } },
  { type: 'function' as const, function: { name: 'file-read', description: 'Read a file from the workspace filesystem.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function' as const, function: { name: 'file-write', description: 'Write content to a file in the workspace.', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
  { type: 'function' as const, function: { name: 'file-glob', description: 'Find files in the workspace by glob pattern.', parameters: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] } } },
  { type: 'function' as const, function: { name: 'phone-call', description: 'Place an AI-powered outbound phone call. The assistant will speak on your behalf.', parameters: { type: 'object', properties: { number: { type: 'string', description: 'Phone number in E.164 format (e.g. +33634554177)' }, context: { type: 'string', description: 'What the call should accomplish' }, template: { type: 'string', description: 'Optional template ID (appointment, restaurant, hotel, pharmacy, custom)' }, templateValues: { type: 'object', description: 'Field values for the template' } }, required: ['number', 'context'] } } },
]

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { _error: 'Non-JSON response', _text: text.slice(0, 500) } }
}

async function executeTool(userId: string, name: string, args: Record<string, unknown>, creds: Record<string, string>, phoneEnabled: boolean): Promise<string> {
  const GITHUB_TOKEN = creds.GITHUB_TOKEN || process.env.GITHUB_TOKEN || ''
  const VAPI_TOKEN = process.env.VAPI_TOKEN || ''
  const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID || ''
  switch (name) {
    case 'github-search': {
      const res = await fetch(`https://api.github.com/search/code?q=${encodeURIComponent(args.query as string)}`, { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } })
      const data = await safeJson(res)
      const items = (data.items as unknown[]) || []
      return JSON.stringify({ items: items.slice(0, 10), total: data.total_count || 0, ...(data._errors ? { error: data._text } : {}) })
    }
    case 'github-read': {
      const { owner, repo, path } = args as { owner: string; repo: string; path: string }
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } })
      const data = await safeJson(res)
      if (data._errors) return JSON.stringify({ error: 'GitHub API error', detail: data._text })
      if (data.content) return Buffer.from(data.content as string, 'base64').toString('utf-8')
      return JSON.stringify(data)
    }
    case 'web-search': {
      const q = args.query as string
      const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`)
      const ddgData = await safeJson(ddgRes)
      if (ddgData._errors) return JSON.stringify({ error: 'Search failed', query: q })
      const results: { type: string; text: string; url?: string; source?: string }[] = []
      if (ddgData.AbstractText) results.push({ type: 'abstract', text: ddgData.AbstractText as string, source: ddgData.AbstractURL as string })
      for (const t of (ddgData.RelatedTopics as unknown[]) || []) {
        const topic = t as { Text?: string; FirstURL?: string; Topics?: { Text?: string; FirstURL?: string }[] }
        if (topic.Text) results.push({ type: 'related', text: topic.Text, url: topic.FirstURL })
        if (topic.Topics) for (const sub of topic.Topics) if (sub.Text) results.push({ type: 'related', text: sub.Text, url: sub.FirstURL })
      }
      return JSON.stringify({ results: results.slice(0, 10), abstract: (ddgData.AbstractText as string) || '' })
    }
    case 'web-fetch': {
      const url = args.url as string
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Relay/1.0' }, redirect: 'follow' })
        const text = await res.text()
        const isHtml = (res.headers.get('content-type') || '').includes('text/html')
        const content = isHtml ? text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20000) : text.slice(0, 20000)
        return content || 'Empty page'
      } catch (e) {
        return JSON.stringify({ error: `Failed to fetch ${url}: ${e instanceof Error ? e.message : String(e)}` })
      }
    }
    case 'file-read': {
      const safePath = resolve(join(WORKSPACE_ROOT, args.path as string))
      if (!safePath.startsWith(WORKSPACE_ROOT)) return JSON.stringify({ error: 'Path outside workspace' })
      try { return await readFile(safePath, 'utf-8') } catch { return JSON.stringify({ error: 'File not found' }) }
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
      if (!phoneEnabled) return JSON.stringify({ error: 'Phone calls require a Pro or Unlimited plan.' })
      if (!VAPI_TOKEN || !VAPI_PHONE_NUMBER_ID) return JSON.stringify({ error: 'Phone calls are not configured on the server.' })
      const number = (args.number as string).trim().replace(/\s+/g, '')
      if (!/^\+\d{6,15}$/.test(number)) return JSON.stringify({ error: 'Invalid phone number. Use E.164 format like +33634554177.' })

      // Build context from template if provided, otherwise use raw context
      let callContext = (args.context as string) || 'No prior context'
      let templateLabel = 'Phone call'
      const tplId = args.template as string
      const tplValues = args.templateValues as Record<string, string>
      if (tplId) {
        const tpl = getTemplate(tplId)
        if (tpl && tplValues) {
          callContext = tpl.buildContext(tplValues)
          templateLabel = tpl.label
        }
      }

      // Pick assistant based on country code
      const frAssistant = process.env.VAPI_ASSISTANT_ID_FR || process.env.VAPI_ASSISTANT_ID || ''
      const enAssistant = process.env.VAPI_ASSISTANT_ID_EN || process.env.VAPI_ASSISTANT_ID || ''
      const assistantId = number.startsWith('+33') ? frAssistant : enAssistant
      if (!assistantId) return JSON.stringify({ error: 'Phone calls are not configured on the server.' })

      const vapiRes = await fetch('https://api.vapi.ai/call', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${VAPI_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumberId: VAPI_PHONE_NUMBER_ID,
          assistantId,
          customer: { number },
          assistantOverrides: { variableValues: { context: callContext, user_name: 'User' } },
        }),
      })
      const callData = await safeJson(vapiRes)
      if (!vapiRes.ok) return JSON.stringify({ error: (callData.message as string) || 'Vapi error' })
      await supabaseAdmin.from('calls').insert({ user_id: userId, phone_number: number, call_id: callData.id as string, status: 'initiated', template: templateLabel })
      return JSON.stringify({ callId: callData.id, status: callData.status, template: templateLabel, message: `Call placed to ${number}. The assistant will report back when the call completes.` })
    }
    default: return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

type OllamaMsg = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: unknown[]; tool_call_id?: string; name?: string }
type ToolCall = { function?: { name?: string; arguments?: string }; id?: string; name?: string }

function sseEncode(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  const { message, conversationId, tools: enabledTools, messages: history, stream: wantStream } = await req.json()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin.from('profiles').select('messages_used, is_pro, is_unlimited').eq('id', user.id).single()
  const isUnlimited = profile?.is_unlimited || false
  const isPro = profile?.is_pro || false
  const used = profile?.messages_used || 0
  const limit = isUnlimited ? Infinity : isPro ? 500 : 20
  if (used >= limit) return Response.json({ response: "You've reached your message limit. Upgrade to Pro for more." })

  await supabaseAdmin.from('profiles').upsert({ id: user.id, messages_used: used + 1 })

  // Load user's MCP config (credentials + enabled tools)
  const { data: userSettings } = await supabaseAdmin.from('user_settings').select('mcp_config, enabled_tools').eq('user_id', user.id).single()
  const userCreds = buildCredEnv(userSettings?.mcp_config || {})
  const savedEnabledTools = new Set<string>(userSettings?.enabled_tools || [])

  let convId = conversationId
  if (!convId) {
    const { data: conv } = await supabaseAdmin.from('conversations').insert({ user_id: user.id, title: message.slice(0, 100) }).select().single()
    convId = conv?.id
  }
  await supabaseAdmin.from('messages').insert({ conversation_id: convId, role: 'user', content: message })

  const ollamaMessages: OllamaMsg[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(history || []).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }) as OllamaMsg),
    { role: 'user', content: message },
  ]

  // Use tools from the request, or fall back to saved settings
  const enabled = new Set<string>(enabledTools?.length > 0 ? enabledTools : Array.from(savedEnabledTools))
  const phoneAllowed = canUsePhoneCalls(profile)
  if (!phoneAllowed) enabled.delete('phone-call')
  const activeTools = enabled.size > 0 ? TOOL_DEFINITIONS.filter(t => enabled.has(t.function.name)) : TOOL_DEFINITIONS.filter(t => t.function.name !== 'phone-call' || phoneAllowed)
  const toolCallsLog: { name: string; result: string }[] = []
  let finalResponse = ''
  let rounds = 0

  // Streaming mode — SSE
  if (wantStream) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => controller.enqueue(encoder.encode(sseEncode(data)))
        send({ type: 'conversation', conversationId: convId })

        try {
          while (rounds < MAX_TOOL_ROUNDS) {
            rounds++
            // For tool-calling rounds, use non-streaming to get the full response
            // For the final response round, use streaming for real-time tokens
            const requestBody: Record<string, unknown> = {
              model: OLLAMA_MODEL,
              messages: ollamaMessages,
              stream: false, // Non-stream for tool rounds; we'll stream the final answer
            }
            if (activeTools.length > 0) requestBody.tools = activeTools

            const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(OLLAMA_API_KEY ? { 'Authorization': `Bearer ${OLLAMA_API_KEY}` } : {}),
              },
              body: JSON.stringify(requestBody),
            })

            if (!res.ok) {
              const errText = await res.text().catch(() => res.statusText)
              finalResponse = `Model error (${res.status}): ${errText.slice(0, 200)}`
              send({ type: 'error', error: finalResponse })
              break
            }

            // Parse response — handle both streaming and non-streaming from Ollama
            const resText = await res.text()
            let data: { message?: { content?: string; tool_calls?: ToolCall[] }; choices?: { message?: { content?: string; tool_calls?: ToolCall[] } }[] }
            try {
              // Ollama native (non-stream) returns a single JSON object
              data = JSON.parse(resText)
            } catch {
              // Might be newline-delimited JSON (streaming despite stream:false)
              const lines = resText.split('\n').filter(l => l.trim())
              if (lines.length === 0) {
                finalResponse = 'Empty response from model.'
                send({ type: 'error', error: finalResponse })
                break
              }
              try {
                // Take the last complete JSON line (has done:true)
                const lastLine = lines[lines.length - 1]
                data = JSON.parse(lastLine)
              } catch {
                finalResponse = `Failed to parse model response: ${resText.slice(0, 200)}`
                send({ type: 'error', error: finalResponse })
                break
              }
            }
            const msg = data.message || data.choices?.[0]?.message
            if (!msg) { finalResponse = 'No response from model.'; send({ type: 'error', error: finalResponse }); break }

            // Tool calls — execute and continue
            if (msg.tool_calls && msg.tool_calls.length > 0) {
              ollamaMessages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls })
              // Notify frontend which tools are being called
              for (const tc of msg.tool_calls) {
                const toolName = tc.function?.name || tc.name
                send({ type: 'tool_start', tool: toolName, round: rounds })
              }
              // Execute all tool calls in parallel
              const toolResults = await Promise.all(msg.tool_calls.map(async (tc: { function?: { name?: string; arguments?: string }; id?: string; name?: string }) => {
                const toolName = tc.function?.name || tc.name || ''
                let toolArgs: Record<string, unknown> = {}
                try { toolArgs = JSON.parse(tc.function?.arguments || '{}') } catch { /* empty */ }
                const result = await executeTool(user.id, toolName, toolArgs, userCreds, phoneAllowed)
                toolCallsLog.push({ name: toolName, result: `Executed ${toolName}` })
                send({ type: 'tool_done', tool: toolName, round: rounds })
                return { tc, result, toolName }
              }))
              // Push results back to the model
              for (const { tc, result, toolName } of toolResults) {
                ollamaMessages.push({ role: 'tool', content: result, tool_call_id: tc.id, name: toolName })
              }
              continue
            }

            // Final answer — stream it
            finalResponse = msg.content || 'No response.'

            // Stream the final response token by token
            // Re-request with streaming enabled for just the final message
            const streamRequestBody: Record<string, unknown> = {
              model: OLLAMA_MODEL,
              messages: ollamaMessages,
              stream: true,
            }
            // No tools on the final streaming call — we want the answer, not more tool calls
            const streamRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(OLLAMA_API_KEY ? { 'Authorization': `Bearer ${OLLAMA_API_KEY}` } : {}),
              },
              body: JSON.stringify(streamRequestBody),
            })

            if (streamRes.ok && streamRes.body) {
              const reader = streamRes.body.getReader()
              const decoder = new TextDecoder()
              let buffer = ''
              let streamedContent = ''

              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''
                for (const line of lines) {
                  if (!line.trim()) continue
                  try {
                    const chunk = JSON.parse(line)
                    const token = chunk.message?.content || chunk.choices?.[0]?.delta?.content || ''
                    if (token) {
                      streamedContent += token
                      send({ type: 'token', content: token })
                    }
                  } catch { /* skip invalid json */ }
                }
              }
              if (streamedContent) finalResponse = streamedContent
            } else {
              // Fallback — send the full response at once
              send({ type: 'token', content: finalResponse })
            }
            break
          }

          if (!finalResponse) finalResponse = 'I reached the tool-call limit without a final answer.'
          await supabaseAdmin.from('messages').insert({ conversation_id: convId, role: 'assistant', content: finalResponse })
          send({ type: 'done', conversationId: convId, toolCalls: toolCallsLog })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          await supabaseAdmin.from('messages').insert({ conversation_id: convId, role: 'assistant', content: `Error: ${msg}` })
          send({ type: 'error', error: msg })
        }
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }

  // Non-streaming mode (fallback)
  try {
    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++
      const requestBody: Record<string, unknown> = {
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        stream: false,
      }
      if (activeTools.length > 0) requestBody.tools = activeTools

      const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(OLLAMA_API_KEY ? { 'Authorization': `Bearer ${OLLAMA_API_KEY}` } : {}),
        },
        body: JSON.stringify(requestBody),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText)
        finalResponse = `Model error (${res.status}): ${errText.slice(0, 200)}`
        break
      }

      const resText = await res.text()
      let data: { message?: { content?: string; tool_calls?: ToolCall[] }; choices?: { message?: { content?: string; tool_calls?: ToolCall[] } }[] }
      try {
        data = JSON.parse(resText)
      } catch {
        const lines = resText.split('\n').filter(l => l.trim())
        if (lines.length === 0) { finalResponse = 'Empty response from model.'; break }
        try { data = JSON.parse(lines[lines.length - 1]) } catch { finalResponse = `Failed to parse response: ${resText.slice(0, 200)}`; break }
      }
      const msg = data.message || data.choices?.[0]?.message
      if (!msg) { finalResponse = 'No response from model.'; break }

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        ollamaMessages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls })
        // Execute tool calls in parallel
        const toolResults = await Promise.all(msg.tool_calls.map(async (tc: { function?: { name?: string; arguments?: string }; id?: string; name?: string }) => {
          const toolName = tc.function?.name || tc.name || ''
          let toolArgs: Record<string, unknown> = {}
          try { toolArgs = JSON.parse(tc.function?.arguments || '{}') } catch { /* empty */ }
          const result = await executeTool(user.id, toolName, toolArgs, userCreds, phoneAllowed)
          toolCallsLog.push({ name: toolName, result: `Executed ${toolName}` })
          return { tc, result, toolName }
        }))
        for (const { tc, result, toolName } of toolResults) {
          ollamaMessages.push({ role: 'tool', content: result, tool_call_id: tc.id, name: toolName })
        }
        continue
      }
      finalResponse = msg.content || 'No response.'
      break
    }
    if (!finalResponse) finalResponse = 'I reached the tool-call limit without a final answer.'
    await supabaseAdmin.from('messages').insert({ conversation_id: convId, role: 'assistant', content: finalResponse })
    return Response.json({ response: finalResponse, conversationId: convId, toolCalls: toolCallsLog })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await supabaseAdmin.from('messages').insert({ conversation_id: convId, role: 'assistant', content: `Error: ${msg}` })
    return Response.json({ response: `Error: ${msg}`, conversationId: convId, toolCalls: toolCallsLog })
  }
}