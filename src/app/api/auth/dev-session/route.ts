import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Dev-only: get user by email and create a session directly
export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return Response.json({ error: 'Email required' }, { status: 400 })

  // List users to find the one matching the email
  const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers()
  
  if (listError) {
    return Response.json({ error: `Admin error: ${listError.message}. Check SUPABASE_SERVICE_ROLE_KEY env var.` }, { status: 500 })
  }

  const user = usersData.users?.find((u: any) => u.email === email)
  if (!user) return Response.json({ error: 'User not found. Sign up first with the Send code button.' }, { status: 404 })

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
    return Response.json({ error: `Invalid link format: ${link.slice(0, 100)}` }, { status: 500 })
  }

  if (!tokenHash) return Response.json({ error: 'No token_hash in generated link', link: link.slice(0, 200) }, { status: 500 })

  return Response.json({ tokenHash })
}