import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const callId = body.call?.id || body.callId
  const status = body.status || body.call?.status
  const transcript = body.call?.transcript || body.transcript
  const duration = body.call?.duration || body.duration
  const endedReason = body.call?.endedReason || body.endedReason

  if (!callId) return Response.json({ ok: true })

  // Update the call record
  const update: Record<string, unknown> = { status }
  if (transcript) update.transcript = transcript
  if (duration != null) update.duration = duration
  await supabaseAdmin.from('calls').update(update).eq('call_id', callId)

  // When the call ends, push a summary message into the linked conversation
  if (status === 'ended' || status === 'completed') {
    const { data: call } = await supabaseAdmin
      .from('calls')
      .select('user_id, phone_number, conversation_id, template, status, duration, transcript')
      .eq('call_id', callId)
      .single()

    if (call?.conversation_id) {
      const durStr = call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : 'unknown duration'
      const reason = endedReason && endedReason !== 'customer-ended-call' ? ` (ended: ${endedReason})` : ''
      const tplLabel = call.template || 'Phone call'

      let summary = `📞 **${tplLabel} completed**\n\n`
      summary += `**Number:** ${call.phone_number}\n`
      summary += `**Duration:** ${durStr}${reason}\n`

      if (call.transcript) {
        // Include a trimmed transcript so the user sees what happened
        const trimmed = call.transcript.length > 3000
          ? call.transcript.slice(0, 3000) + '\n\n*(transcript truncated — full version in the Calls panel)*'
          : call.transcript
        summary += `\n<details>\n<summary>📋 Transcript</summary>\n\n${trimmed}\n\n</details>\n`
      } else {
        summary += `\n*No transcript available.*\n`
      }

      await supabaseAdmin.from('messages').insert({
        conversation_id: call.conversation_id,
        role: 'assistant',
        content: summary,
      })
    }
  }

  return Response.json({ ok: true })
}