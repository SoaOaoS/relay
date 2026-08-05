import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const VAPI_TOKEN = process.env.VAPI_TOKEN
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { number, context } = await req.json()
  if (!number) return Response.json({ error: 'Phone number required' }, { status: 400 })

  try {
    const res = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumberId: VAPI_PHONE_NUMBER_ID,
        assistantId: VAPI_ASSISTANT_ID,
        customer: { number },
        assistantOverrides: {
          variableValues: {
            context: context || 'No prior context',
            user_name: user.email || 'User',
          },
        },
      }),
    })

    const data = await res.json()

    // Log the call
    await supabase.from('calls').insert({
      user_id: user.id,
      phone_number: number,
      call_id: data.id,
      status: 'initiated',
    })

    return Response.json({ callId: data.id, status: data.status })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
