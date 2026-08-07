import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: servers } = await supabaseAdmin
    .from('user_mcp_servers')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return Response.json({ servers: servers || [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, command, args, env } = await req.json()
  if (!name || !command) return Response.json({ error: 'Name and command required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('user_mcp_servers')
    .insert({
      user_id: user.id,
      name,
      command,
      args: args || [],
      env: env || {},
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ server: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return Response.json({ error: 'Server ID required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('user_mcp_servers')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, enabled } = await req.json()
  if (!id) return Response.json({ error: 'Server ID required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('user_mcp_servers')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}