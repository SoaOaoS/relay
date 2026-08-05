import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const VAPI_TOKEN = process.env.VAPI_TOKEN

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { toolId, params } = await req.json()

  switch (toolId) {
    case 'github-search': {
      const query = params.query as string
      const res = await fetch(`https://api.github.com/search/code?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
      })
      const data = await res.json()
      return Response.json({ items: data.items?.slice(0, 5) || [], total: data.total_count })
    }

    case 'github-read': {
      const { owner, repo, path } = params as any
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
      })
      const data = await res.json()
      if (data.content) {
        return Response.json({ content: Buffer.from(data.content, 'base64').toString('utf-8') })
      }
      return Response.json(data)
    }

    case 'web-search': {
      const q = params.query as string
      const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json`)
      const data = await res.json()
      return Response.json({ results: data.RelatedTopics?.slice(0, 5) || [], abstract: data.Abstract })
    }

    case 'web-fetch': {
      const url = params.url as string
      const res = await fetch(url)
      const text = await res.text()
      return Response.json({ content: text.slice(0, 10000) })
    }

    default:
      return Response.json({ error: `Unknown tool: ${toolId}` }, { status: 400 })
  }
}
