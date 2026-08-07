import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { MCP_PROVIDERS } from '@/lib/mcp-providers'

// Encryption key for MCP credentials — stored in server env, never in DB
const ENC_KEY = process.env.MCP_ENC_KEY || 'relay-default-encryption-key-change-me'

// GET /api/settings — load user's enabled tools (credentials NOT returned to client)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Load enabled tools from user_settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('enabled_tools, system_prompt')
    .eq('user_id', user.id)
    .single()

  // Load which credentials are configured (without returning the values)
  const { data: secrets } = await supabaseAdmin
    .from('user_mcp_secrets')
    .select('provider, cred_key')
    .eq('user_id', user.id)

  // Build a map of which creds are set: { github: { GITHUB_TOKEN: true } }
  const configuredCreds: Record<string, Record<string, boolean>> = {}
  for (const s of secrets || []) {
    if (!configuredCreds[s.provider]) configuredCreds[s.provider] = {}
    configuredCreds[s.provider][s.cred_key] = true
  }

  return Response.json({
    enabledTools: settings?.enabled_tools || [],
    configuredCreds,
    systemPrompt: settings?.system_prompt || '',
  })
}

// PUT /api/settings — save enabled tools and encrypt credentials
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { enabledTools, mcpConfig, systemPrompt } = await req.json()

  // Save enabled tools + system prompt
  const { error: settingsErr } = await supabaseAdmin
    .from('user_settings')
    .upsert({
      user_id: user.id,
      enabled_tools: enabledTools || [],
      system_prompt: systemPrompt || '',
      updated_at: new Date().toISOString(),
    })

  if (settingsErr) return Response.json({ error: settingsErr.message }, { status: 500 })

  // Encrypt and save credentials via the DB function
  if (mcpConfig) {
    for (const [providerId, creds] of Object.entries(mcpConfig)) {
      const provider = MCP_PROVIDERS.find(p => p.id === providerId)
      if (!provider?.credentials) continue

      for (const cred of provider.credentials) {
        const value = (creds as Record<string, string>)[cred.key]
        if (value) {
          const { error: encErr } = await supabaseAdmin.rpc('set_mcp_credential', {
            p_user_id: user.id,
            p_provider: providerId,
            p_cred_key: cred.key,
            p_value: value,
            p_encryption_key: ENC_KEY,
          })
          if (encErr) console.error('Failed to encrypt credential:', cred.key, encErr.message)
        }
      }
    }
  }

  return Response.json({ ok: true })
}