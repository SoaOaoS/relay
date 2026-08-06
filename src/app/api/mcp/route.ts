import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname, resolve, join } from 'path'
import { glob as globAsync } from 'glob'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const VAPI_TOKEN = process.env.VAPI_TOKEN
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID

const WORKSPACE_ROOT = resolve(process.env.WORKSPACE_ROOT || process.cwd())

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { toolId, params } = await req.json()

  try {
    switch (toolId) {
      case 'github-search': {
        const query = params.query as string
        const res = await fetch(`https://api.github.com/search/code?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
        })
        const data = await res.json()
        return Response.json({ items: data.items?.slice(0, 10) || [], total: data.total_count })
      }

      case 'github-read': {
        const { owner, repo, path } = params as { owner: string; repo: string; path: string }
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
          headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
        })
        const data = await res.json() as { content?: string }
        if (data.content) return Response.json({ content: Buffer.from(data.content, 'base64').toString('utf-8') })
        return Response.json(data)
      }

      case 'web-search': {
        const q = params.query as string
        const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`)
        const ddgData = await ddgRes.json()
        const results: any[] = []
        if (ddgData.AbstractText) results.push({ type: 'abstract', text: ddgData.AbstractText, source: ddgData.AbstractURL })
        for (const t of ddgData.RelatedTopics || []) {
          if (t.Text) results.push({ type: 'related', text: t.Text, url: t.FirstURL })
          if (t.Topics) for (const sub of t.Topics) if (sub.Text) results.push({ type: 'related', text: sub.Text, url: sub.FirstURL })
        }
        return Response.json({ results: results.slice(0, 10), abstract: ddgData.AbstractText || '' })
      }

      case 'web-fetch': {
        const url = params.url as string
        const res = await fetch(url, { headers: { 'User-Agent': 'Relay/1.0' } })
        const text = await res.text()
        const isHtml = (res.headers.get('content-type') || '').includes('text/html')
        const content = isHtml
          ? text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20000)
          : text.slice(0, 20000)
        return Response.json({ content, url, contentType: res.headers.get('content-type') })
      }

      case 'file-read': {
        const filePath = params.path as string
        const safePath = resolve(join(WORKSPACE_ROOT, filePath))
        if (!safePath.startsWith(WORKSPACE_ROOT)) return Response.json({ error: 'Path outside workspace' }, { status: 403 })
        const content = await readFile(safePath, 'utf-8')
        return Response.json({ content, path: filePath })
      }

      case 'file-write': {
        const { path: filePath, content: fileContent } = params as { path: string; content: string }
        const safePath = resolve(join(WORKSPACE_ROOT, filePath))
        if (!safePath.startsWith(WORKSPACE_ROOT)) return Response.json({ error: 'Path outside workspace' }, { status: 403 })
        await mkdir(dirname(safePath), { recursive: true })
        await writeFile(safePath, fileContent, 'utf-8')
        return Response.json({ ok: true, path: filePath, bytes: fileContent.length })
      }

      case 'file-glob': {
        const pattern = params.pattern as string
        const matches = await globAsync(pattern, { cwd: WORKSPACE_ROOT, ignore: ['**/node_modules/**', '**/.git/**', '**/.next/**'] })
        return Response.json({ files: matches.slice(0, 100) })
      }

      case 'phone-call': {
        const { number, context } = params as { number: string; context?: string }
        if (!number) return Response.json({ error: 'Phone number required' }, { status: 400 })
        const vapiRes = await fetch('https://api.vapi.ai/call', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${VAPI_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumberId: VAPI_PHONE_NUMBER_ID, assistantId: VAPI_ASSISTANT_ID, customer: { number }, assistantOverrides: { variableValues: { context: context || 'No prior context', user_name: user.email || 'User' } } }),
        })
        const callData = await vapiRes.json()
        await supabaseAdmin.from('calls').insert({ user_id: user.id, phone_number: number, call_id: callData.id, status: 'initiated' })
        return Response.json({ callId: callData.id, status: callData.status })
      }

      default:
        return Response.json({ error: `Unknown tool: ${toolId}` }, { status: 400 })
    }
  } catch (e: any) {
    return Response.json({ error: e.message, toolId }, { status: 500 })
  }
}