import { NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return Response.json({ error: 'No signature' }, { status: 400 })
  const body = await req.text()
  let event
  try { event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!) } catch { return Response.json({ error: 'Invalid signature' }, { status: 400 }) }
  const session = event.data.object as any
  const userId = session.metadata?.userId
  if (!userId) return Response.json({ error: 'No userId' }, { status: 400 })
  switch (event.type) {
    case 'checkout.session.completed': {
      const priceId = session.line_items?.data?.[0]?.price?.id || session.metadata?.priceId
      const isYearly = priceId === process.env.STRIPE_PRICE_YEARLY
      const isPro = priceId === process.env.STRIPE_PRICE_MONTHLY || isYearly
      await supabaseAdmin.from('profiles').upsert({ id: userId, stripe_customer_id: session.customer, is_pro: true, is_unlimited: false, messages_used: 0 })
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as any
      const active = subscription.status === 'active' || subscription.status === 'trialing'
      if (!active) { await supabaseAdmin.from('profiles').upsert({ id: userId, is_pro: false, is_unlimited: false }) }
      break
    }
  }
  return Response.json({ ok: true })
}