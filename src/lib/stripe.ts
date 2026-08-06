import Stripe from 'stripe'
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-07-29.dahlia' as any })
export const PRICES = { monthly: process.env.STRIPE_PRICE_MONTHLY!, yearly: process.env.STRIPE_PRICE_YEARLY! }
export const PLANS = { free: { name: 'Free', messages: 20, tools: false, calls: 0 }, pro: { name: 'Pro', messages: 500, tools: true, calls: 5 }, unlimited: { name: 'Unlimited', messages: -1, tools: true, calls: 50 } }