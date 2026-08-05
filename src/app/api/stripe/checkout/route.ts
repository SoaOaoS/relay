import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { stripe, PRICES } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { priceId, successUrl, cancelUrl } = await req.json()

  const session = await stripe.checkout.sessions.create({
    customer_email: user.email,
    mode: 'subscription',
    line_items: [{ price: priceId || PRICES.monthly, quantity: 1 }],
    success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    metadata: { userId: user.id },
  })

  return Response.json({ url: session.url })
}
