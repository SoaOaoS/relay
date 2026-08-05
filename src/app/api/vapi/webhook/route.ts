import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Vapi webhook events: call.ended, call.transcript, etc.
  const callId = body.call?.id || body.callId
  const status = body.status || body.call?.status
  const transcript = body.call?.transcript || body.transcript
  const duration = body.call?.duration || body.duration

  if (callId) {
    const update: any = { status }
    if (transcript) update.transcript = transcript
    if (duration) update.duration = duration

    await supabaseAdmin.from('calls').update(update).eq('call_id', callId)
  }

  return Response.json({ ok: true })
}
