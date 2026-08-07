import Stripe from 'stripe'
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder', { apiVersion: '2026-07-29.dahlia' as any })
export const PRICES = { monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_placeholder', yearly: process.env.STRIPE_PRICE_YEARLY || 'price_placeholder' }
export const PLANS = { free: { name: 'Free', messages: 20, tools: false, calls: 0 }, pro: { name: 'Pro', messages: 500, tools: true, calls: 5 }, unlimited: { name: 'Unlimited', messages: -1, tools: true, calls: 50 } }

export type PlanKey = keyof typeof PLANS

// Resolve the effective plan from a Supabase profile row.
export function planKeyFromProfile(p: { is_pro?: boolean; is_unlimited?: boolean } | null | undefined): PlanKey {
  if (p?.is_unlimited) return 'unlimited'
  if (p?.is_pro) return 'pro'
  return 'free'
}

// Whether the user's plan grants access to managed phone calls.
export function canUsePhoneCalls(profile: { is_pro?: boolean; is_unlimited?: boolean } | null | undefined): boolean {
  return PLANS[planKeyFromProfile(profile)].calls > 0
}