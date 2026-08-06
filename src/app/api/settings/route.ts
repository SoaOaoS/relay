import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET /api/settings — load user's MCP config and enabled tools
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('user_settings')
    .select('mcp_config, enabled_tools')
    .eq('user_id', user.id)
    .single()

  return Response.json({
    mcpConfig: data?.mcp_config || {},
    enabledTools: data?.enabled_tools || [],
  })
}

// POST /api/settings — save MCP config and enabled tools
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { mcpConfig, enabledTools } = await req.json()

  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      mcp_config: mcpConfig || {},
      enabled_tools: enabledTools || [],
      updated_at: new Date().toISOString(),
    })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}