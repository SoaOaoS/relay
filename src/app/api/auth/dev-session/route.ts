import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return Response.json({ error: 'Email required' }, { status: 400 })

  // Generate a magic link using the admin API
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (linkError) return Response.json({ error: linkError.message }, { status: 500 })

  const link = linkData.properties?.action_link || ''
  
  // Extract token_hash from the link
  let tokenHash = ''
  try {
    const url = new URL(link)
    tokenHash = url.searchParams.get('token_hash') || url.searchParams.get('token') || ''
  } catch {
    return Response.json({ error: `Invalid link format` }, { status: 500 })
  }

  if (!tokenHash) return Response.json({ error: 'No token hash in generated link' }, { status: 500 })

  // Use the server-side SSR client to verify the OTP and set cookies
  const supabase = await createClient()
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  })

  if (verifyError) return Response.json({ error: verifyError.message }, { status: 500 })

  // The SSR client automatically sets cookies — return success
  return Response.json({ ok: true, session: !!verifyData.session })
}