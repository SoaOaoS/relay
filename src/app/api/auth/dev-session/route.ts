import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Dev-only: sign in without email, returns a session
export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return Response.json({ error: 'Email required' }, { status: 400 })

  // Get the user
  const { data: users } = await supabaseAdmin.auth.admin.listUsers()
  const user = users?.users?.find((u: any) => u.email === email)

  if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

  // Generate a magic link that we can use to get a session
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // The generated link contains a token_hash we can use to verify
  const link = data.properties?.action_link || ''
  const url = new URL(link)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') || 'email'

  if (!tokenHash) return Response.json({ error: 'No token in link' }, { status: 500 })

  // Return the token hash and redirect URL for the client to verify
  return Response.json({
    tokenHash,
    redirectUrl: link,
  })
}