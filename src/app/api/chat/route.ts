import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildCredEnv } from '@/lib/mcp-providers'
import { canUsePhoneCalls } from '@/lib/stripe'
import { getTemplate } from '@/lib/call-templates'
import { connectMCPClient, mcpToolsToDefinitions, type UserMCPServer, type MCPClientResult } from '@/lib/mcp-client'
import { webSearch, webFetch, browserAction } from '@/lib/browser-search'

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'https://ollama.com'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:70b'
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || ''
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd()
const MAX_TOOL_ROUNDS = 50

const SYSTEM_PROMPT = `You are Relay, a personal AI assistant that gets things done — not just chat.

## YOUR TOOLS — know them precisely

You have EXACTLY these tools. Do NOT confuse them or use the wrong one:

### web-search — for searching the INTERNET
Use this when the user wants to find information ONLINE. This searches the web (DuckDuckGo via headless browser) and returns titles, URLs, and snippets.
- Use for: "search for X", "find Y online", "what's the latest Z", "look up X"
- DO NOT use github-search for general web searches. github-search ONLY searches GitHub code.

### web-fetch — for reading a specific WEB PAGE
Use this AFTER web-search to read the full content of a URL. Renders the page in a real browser (handles JavaScript).
- Use for: "read this page", "fetch this URL", "get the content of this link"
- Requires a full URL (e.g. https://example.com/page)

### github-search — for searching GITHUB CODE ONLY
Use this ONLY when the user explicitly wants to search GitHub repositories, code, issues, or PRs.
- Use for: "find a repo that does X", "search GitHub for Y", "find issues about Z"
- DO NOT use this for general web searches. For web searches, use web-search.

### github-read — for reading a FILE from a GITHUB REPO
Use this to read a specific file from a GitHub repository.
- Use for: "read the README of owner/repo", "show me the package.json of X"
- Requires: owner, repo, and file path

### browser-action — control a REAL BROWSER step by step (with VISION)
Use this to interact with websites like a human. You can SEE the page using screenshot_image, then click, type, and fill forms.
- Use for: "make a reservation", "book a table", "fill out this form", "click the button"
- WORKFLOW: navigate → screenshot_image (SEE the page as an image) → click/type/select → wait → screenshot_image again → repeat
- screenshot_image takes a REAL screenshot that you will SEE as an image — use this to understand the page visually
- screenshot returns a TEXT list of interactive elements — use when you just need selectors quickly
- The browser stays open between calls — you can chain actions
- For complex widgets that don't respond to click: use eval to run custom JavaScript
- ALWAYS call close when done to free the browser

### phone-call — for making AI PHONE CALLS (LAST RESORT)
Use this ONLY when browser-action can't complete the task (e.g. website has no booking form, or form is broken). An AI assistant will speak on your behalf.
- Use for: "call this number", "phone this restaurant" — but ONLY after trying browser-action first
- Requires: phone number in E.164 format (+countrycode...)
- The assistant handles the conversation — you just provide the context

## HOW TO WORK
1. Think about which tool is the RIGHT one for the job. Read the descriptions above carefully.
2. If a request needs external info or action, call the right tool(s).
3. Read tool results, then continue reasoning or call more tools if needed.
4. You can call multiple tools in one round, and chain rounds up to 30 deep.
5. When you have enough information, give a clear, helpful final answer.
6. Briefly mention which tools you used at the end.

## CRITICAL RULES
- web-search = search the INTERNET (general web)
- github-search = search GITHUB ONLY (code, repos, issues)
- web-fetch = read a specific URL (one-shot, returns text)
- browser-action = control a browser step by step (navigate, click, type, screenshot) — use for forms and bookings
- github-read = read a file from a GitHub repo
- phone-call = make a phone call — LAST RESORT, only when browser-action fails
- NEVER use github-search for general web searches
- When making a reservation or booking: use browser-action to navigate to the website, screenshot to see the form, fill it in step by step, and submit. Only use phone-call if there's no form or it fails.
- For browser-action: ALWAYS call screenshot FIRST to understand the page before interacting with it

## YOUR LIMITATIONS
- You CANNOT read or write files on the user's machine
- You CANNOT execute code
- You CANNOT send emails or messages
- You CAN search the web, read web pages, control a browser (fill forms, make bookings), search/read GitHub, and make phone calls
- When asked to make a reservation or booking, use browser-action to drive the website form. Phone-call is last resort only
- If the user asks for something you can't do, say so honestly

Be proactive, concise, and helpful. You help with research, writing, analysis, coding questions, planning, phone calls — anything within your capabilities.`

const TOOL_DEFINITIONS = [
  { type: 'function' as const, function: { name: 'web-search', description: 'Search the INTERNET (general web) for current information. Use this for general web searches, NOT for GitHub code search. Returns titles, URLs, and snippets.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'The search query' } }, required: ['query'] } } },
  { type: 'function' as const, function: { name: 'web-fetch', description: 'Read the full content of a specific web page URL by rendering it in a real browser. Use AFTER web-search to dig deeper into a result.', parameters: { type: 'object', properties: { url: { type: 'string', description: 'The full URL to fetch (e.g. https://example.com/page)' } }, required: ['url'] } } },
  { type: 'function' as const, function: { name: 'browser-action', description: 'Control a real browser step by step. Actions: navigate (open URL), click (by selector or button text), type (fill input), select (dropdown), wait (pause), read (get page text), screenshot (list interactive elements as text), screenshot_image (take a REAL screenshot — you will SEE the page as an image), press_key, scroll, exists (check selector), eval (run custom JavaScript), batch (run multiple actions in ONE call), close. Use screenshot_image to SEE the page like a human would, then click/type to interact. For complex widgets, use screenshot_image to understand the visual layout, then use eval if standard click doesnt work.', parameters: { type: 'object', properties: { action: { type: 'string', description: 'What to do', enum: ['navigate', 'click', 'type', 'select', 'wait', 'read', 'screenshot', 'screenshot_image', 'press_key', 'scroll', 'exists', 'close', 'eval', 'batch'] }, actions: { type: 'array', description: 'For batch action only — array of actions to execute in sequence', items: { type: 'object', properties: { action: { type: 'string' }, selector: { type: 'string' }, text: { type: 'string' }, value: { type: 'string' }, url: { type: 'string' }, key: { type: 'string' }, delay: { type: 'number' }, steps: { type: 'number' } } } }, selector: { type: 'string', description: 'CSS selector (for click, type, select, exists)' }, text: { type: 'string', description: 'Text to type (for type), button text to find (for click), or JavaScript code (for eval)' }, value: { type: 'string', description: 'Value for select dropdown' }, url: { type: 'string', description: 'URL to navigate to' }, key: { type: 'string', description: 'Key to press: Enter, Tab, Escape, ArrowDown, etc.' }, delay: { type: 'number', description: 'Wait time in ms (for wait action)' }, steps: { type: 'number', description: 'Scroll pixels (for scroll action)' } }, required: ['action'] } } },
  { type: 'function' as const, function: { name: 'github-search', description: 'Search GITHUB ONLY — for code, issues, and PRs across GitHub repositories. Do NOT use this for general web searches. Use web-search for general internet searches.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'GitHub search query (supports GitHub search syntax)' } }, required: ['query'] } } },
  { type: 'function' as const, function: { name: 'github-read', description: 'Read a specific FILE from a GitHub repository. Requires owner, repo name, and file path.', parameters: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, path: { type: 'string' } }, required: ['owner', 'repo', 'path'] } } },
  { type: 'function' as const, function: { name: 'phone-call', description: 'Place an AI-powered outbound PHONE CALL. An AI assistant will speak on your behalf to the given number. Use for making reservations, enquiries, appointments by phone.', parameters: { type: 'object', properties: { number: { type: 'string', description: 'Phone number in E.164 format (e.g. +33634554177)' }, context: { type: 'string', description: 'What the call should accomplish — be specific' }, template: { type: 'string', description: 'Optional template ID (appointment, restaurant, hotel, pharmacy, custom)' }, templateValues: { type: 'object', description: 'Field values for the template' } }, required: ['number', 'context'] } } },
]

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { _error: 'Non-JSON response', _text: text.slice(0, 500) } }
}

async function executeTool(userId: string, name: string, args: Record<string, unknown>, creds: Record<string, string>, phoneEnabled: boolean, mcpClient?: MCPClientResult | null): Promise<string> {
  // MCP server tools — names contain "__" (serverName__toolName)
  if (name.includes('__') && mcpClient) {
    return mcpClient.callTool(name, args)
  }

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
      console.log('[web-search] query:', q)
      const { results, error } = await webSearch(q)
      console.log('[web-search] results:', results.length, 'error:', error || 'none')
      if (error && results.length === 0) return JSON.stringify({ error: `Search failed: ${error}`, query: q })
      const formatted = results.map(r => ({ type: 'result', text: `${r.title} — ${r.snippet}`, url: r.url }))
      console.log('[web-search] returning', formatted.length, 'results')
      return JSON.stringify({ results: formatted, query: q })
    }
    case 'web-fetch': {
      const url = args.url as string
      const content = await webFetch(url)
      return content
    }
    case 'browser-action': {
      const result = await browserAction({
        action: args.action as 'navigate' | 'click' | 'type' | 'select' | 'wait' | 'read' | 'screenshot' | 'screenshot_image' | 'press_key' | 'scroll' | 'exists' | 'close' | 'eval' | 'batch',
        actions: (args.actions as { action: string; selector?: string; text?: string; value?: string; url?: string; key?: string; delay?: number; steps?: number }[]) || undefined,
        selector: args.selector as string | undefined,
        text: args.text as string | undefined,
        value: args.value as string | undefined,
        url: args.url as string | undefined,
        key: args.key as string | undefined,
        delay: args.delay as number | undefined,
        steps: args.steps as number | undefined,
      })
      console.log('[browser-action]', args.action, result.slice(0, 200))
      return result
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

type OllamaMsg = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: unknown[]; tool_call_id?: string; name?: string; images?: string[] }
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
  const { data: userSettings } = await supabaseAdmin.from('user_settings').select('mcp_config, enabled_tools, system_prompt').eq('user_id', user.id).single()
  const userCreds = buildCredEnv(userSettings?.mcp_config || {})
  const savedEnabledTools = new Set<string>(userSettings?.enabled_tools || [])
  const userSystemPrompt = (userSettings?.system_prompt as string) || ''

  // Load user's MCP servers and connect to them
  const { data: userMCPServers } = await supabaseAdmin
    .from('user_mcp_servers')
    .select('*')
    .eq('user_id', user.id)
    .eq('enabled', true)

  let mcpClient: MCPClientResult | null = null
  if (userMCPServers && userMCPServers.length > 0) {
    mcpClient = await connectMCPClient(userMCPServers as UserMCPServer[])
  }
  const mcpToolDefs = mcpClient ? mcpToolsToDefinitions(mcpClient.tools) : []

  let convId = conversationId
  if (!convId) {
    const { data: conv } = await supabaseAdmin.from('conversations').insert({ user_id: user.id, title: message.slice(0, 100) }).select().single()
    convId = conv?.id
  }
  await supabaseAdmin.from('messages').insert({ conversation_id: convId, role: 'user', content: message })

  const ollamaMessages: OllamaMsg[] = [
    { role: 'system', content: userSystemPrompt ? `${SYSTEM_PROMPT}\n\n## USER INSTRUCTIONS\nThe user has provided the following custom instructions. Follow them in addition to your default behaviour:\n\n${userSystemPrompt}` : SYSTEM_PROMPT },
    ...(history || []).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }) as OllamaMsg),
    { role: 'user', content: message },
  ]

  // Use tools from the request, or fall back to saved settings
  const enabled = new Set<string>(enabledTools?.length > 0 ? enabledTools : Array.from(savedEnabledTools))
  const phoneAllowed = canUsePhoneCalls(profile)
  if (!phoneAllowed) enabled.delete('phone-call')
  const builtinTools = enabled.size > 0 ? TOOL_DEFINITIONS.filter(t => enabled.has(t.function.name)) : TOOL_DEFINITIONS.filter(t => t.function.name !== 'phone-call' || phoneAllowed)
  // Merge built-in tools with user's MCP server tools
  const activeTools = [...builtinTools, ...mcpToolDefs]
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
              const toolResults = await Promise.all(msg.tool_calls.map(async (tc: { function?: { name?: string; arguments?: string | Record<string, unknown> }; id?: string; name?: string }) => {
                const toolName = tc.function?.name || tc.name || ''
                let toolArgs: Record<string, unknown> = {}
                const rawArgs = tc.function?.arguments
                if (typeof rawArgs === 'string') {
                  try { toolArgs = JSON.parse(rawArgs) } catch { /* empty */ }
                } else if (typeof rawArgs === 'object' && rawArgs !== null) {
                  toolArgs = rawArgs as Record<string, unknown>
                }
                console.log('[tool-call]', toolName, JSON.stringify(toolArgs))
                const result = await executeTool(user.id, toolName, toolArgs, userCreds, phoneAllowed, mcpClient)
                console.log('[tool-result]', toolName, result.slice(0, 200))
                toolCallsLog.push({ name: toolName, result: `Executed ${toolName}` })
                send({ type: 'tool_done', tool: toolName, round: rounds })
                return { tc, result, toolName }
              }))
              // Push results back to the model
              for (const { tc, result, toolName } of toolResults) {
                // Check if result contains an image (screenshot_image action)
                if (result.startsWith('IMAGE:')) {
                  // Inject as a user message with the image so the vision model can see it
                  const base64 = result.slice(6)
                  ollamaMessages.push({
                    role: 'user',
                    content: `Here is a screenshot of the current page (from ${toolName}). Look at it carefully to understand what buttons, inputs, and form fields are visible. Then decide what action to take next.`,
                    images: [base64],
                  })
                } else {
                  ollamaMessages.push({ role: 'tool', content: result, tool_call_id: tc.id, name: toolName })
                }
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

          if (!finalResponse) {
            // Force a final answer — no tools, just synthesize what we have
            ollamaMessages.push({ role: 'user', content: 'You have used all your tool calls. Based on everything you\'ve gathered so far, give me your best, most complete answer now. Do not attempt to call any more tools.' })
            try {
              const forceRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(OLLAMA_API_KEY ? { 'Authorization': `Bearer ${OLLAMA_API_KEY}` } : {}) },
                body: JSON.stringify({ model: OLLAMA_MODEL, messages: ollamaMessages, stream: false }),
              })
              if (forceRes.ok) {
                const forceText = await forceRes.text()
                try { const forceData = JSON.parse(forceText); finalResponse = forceData.message?.content || forceData.choices?.[0]?.message?.content || '' } catch { finalResponse = forceText.slice(0, 5000) }
              }
            } catch { /* ignore */ }
            if (!finalResponse) finalResponse = 'I gathered information but had trouble formulating a final response. Here is what I found so far — please ask me to elaborate on any of it.'
          }
          await supabaseAdmin.from('messages').insert({ conversation_id: convId, role: 'assistant', content: finalResponse })
          send({ type: 'done', conversationId: convId, toolCalls: toolCallsLog })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          await supabaseAdmin.from('messages').insert({ conversation_id: convId, role: 'assistant', content: `Error: ${msg}` })
          send({ type: 'error', error: msg })
        }
        if (mcpClient) await mcpClient.cleanup()
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
        const toolResults = await Promise.all(msg.tool_calls.map(async (tc: { function?: { name?: string; arguments?: string | Record<string, unknown> }; id?: string; name?: string }) => {
          const toolName = tc.function?.name || tc.name || ''
          let toolArgs: Record<string, unknown> = {}
          const rawArgs = tc.function?.arguments
          if (typeof rawArgs === 'string') {
            try { toolArgs = JSON.parse(rawArgs) } catch { /* empty */ }
          } else if (typeof rawArgs === 'object' && rawArgs !== null) {
            toolArgs = rawArgs as Record<string, unknown>
          }
          const result = await executeTool(user.id, toolName, toolArgs, userCreds, phoneAllowed)
          toolCallsLog.push({ name: toolName, result: `Executed ${toolName}` })
          return { tc, result, toolName }
        }))
        for (const { tc, result, toolName } of toolResults) {
          if (result.startsWith('IMAGE:')) {
            const base64 = result.slice(6)
            ollamaMessages.push({
              role: 'user',
              content: `Here is a screenshot of the current page (from ${toolName}). Look at it carefully to understand what buttons, inputs, and form fields are visible. Then decide what action to take next.`,
              images: [base64],
            })
          } else {
            ollamaMessages.push({ role: 'tool', content: result, tool_call_id: tc.id, name: toolName })
          }
        }
        continue
      }
      finalResponse = msg.content || 'No response.'
      break
    }
    if (!finalResponse) {
      ollamaMessages.push({ role: 'user', content: 'You have used all your tool calls. Based on everything you\'ve gathered so far, give me your best, most complete answer now. Do not attempt to call any more tools.' })
      try {
        const forceRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(OLLAMA_API_KEY ? { 'Authorization': `Bearer ${OLLAMA_API_KEY}` } : {}) },
          body: JSON.stringify({ model: OLLAMA_MODEL, messages: ollamaMessages, stream: false }),
        })
        if (forceRes.ok) {
          const forceText = await forceRes.text()
          try { const forceData = JSON.parse(forceText); finalResponse = forceData.message?.content || forceData.choices?.[0]?.message?.content || '' } catch { finalResponse = forceText.slice(0, 5000) }
        }
      } catch { /* ignore */ }
      if (!finalResponse) finalResponse = 'I gathered information but had trouble formulating a final response. Here is what I found so far — please ask me to elaborate on any of it.'
    }
    await supabaseAdmin.from('messages').insert({ conversation_id: convId, role: 'assistant', content: finalResponse })
    if (mcpClient) await mcpClient.cleanup()
    return Response.json({ response: finalResponse, conversationId: convId, toolCalls: toolCallsLog })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await supabaseAdmin.from('messages').insert({ conversation_id: convId, role: 'assistant', content: `Error: ${msg}` })
    if (mcpClient) await mcpClient.cleanup()
    return Response.json({ response: `Error: ${msg}`, conversationId: convId, toolCalls: toolCallsLog })
  }
}