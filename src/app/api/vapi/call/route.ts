import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { canUsePhoneCalls, planKeyFromProfile, PLANS } from '@/lib/stripe'
import { getTemplate } from '@/lib/call-templates'

// Managed Vapi credentials — hosted by Relay, never exposed to users.
const VAPI_TOKEN = process.env.VAPI_TOKEN
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID

// Pick the right assistant based on the phone number's country code.
// +33 → FR assistant, anything else → EN assistant.
function pickAssistantId(number: string): string {
  const frAssistant = process.env.VAPI_ASSISTANT_ID_FR || VAPI_ASSISTANT_ID || ''
  const enAssistant = process.env.VAPI_ASSISTANT_ID_EN || VAPI_ASSISTANT_ID || ''
  return number.startsWith('+33') ? frAssistant : enAssistant
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Plan gating — phone calls are a managed service included on Pro & Unlimited.
  const { data: profile } = await supabaseAdmin.from('profiles').select('is_pro, is_unlimited').eq('id', user.id).single()
  if (!canUsePhoneCalls(profile)) {
    const plan = planKeyFromProfile(profile)
    return Response.json({
      error: `Phone calls are not available on the ${PLANS[plan].name} plan. Upgrade to Pro to place AI calls.`,
      upgradeRequired: true,
    }, { status: 403 })
  }

  const { number, templateId, templateValues, context, conversationId } = await req.json()
  if (!number || !number.trim()) return Response.json({ error: 'Phone number required' }, { status: 400 })
  // Normalise: strip spaces, ensure E.164-ish (+ prefix)
  const normalized = number.trim().replace(/\s+/g, '')
  if (!/^\+\d{6,15}$/.test(normalized)) {
    return Response.json({ error: 'Invalid phone number. Use international format, e.g. +33634554177.' }, { status: 400 })
  }
  if (!VAPI_TOKEN || !VAPI_PHONE_NUMBER_ID) {
    return Response.json({ error: 'Phone calls are not configured on the server.' }, { status: 503 })
  }

  // Build call context from the template (if provided).
  // The assistant's system prompt already contains {{context}} and {{user_name}}
  // variables — we just pass the values via variableValues.
  let callContext = context || 'No prior context'
  let templateLabel = 'Custom call'
  if (templateId) {
    const tpl = getTemplate(templateId)
    if (tpl && templateValues) {
      callContext = tpl.buildContext(templateValues)
      templateLabel = tpl.label
    }
  }

  const assistantId = pickAssistantId(normalized)
  if (!assistantId) {
    return Response.json({ error: 'Phone calls are not configured on the server.' }, { status: 503 })
  }

  try {
    const res = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${VAPI_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumberId: VAPI_PHONE_NUMBER_ID,
        assistantId,
        customer: { number: normalized },
        assistantOverrides: {
          variableValues: { context: callContext, user_name: user.email || 'User' },
        },
      }),
    })
    const data = await res.json()
    if (!res.ok) return Response.json({ error: data.message || 'Vapi error' }, { status: res.status })
    await supabaseAdmin.from('calls').insert({
      user_id: user.id,
      phone_number: normalized,
      call_id: data.id,
      status: 'initiated',
      template: templateLabel,
      ...(conversationId ? { conversation_id: conversationId } : {}),
    })
    return Response.json({ callId: data.id, status: data.status, template: templateLabel })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return Response.json({ error: msg }, { status: 500 })
  }
}