import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
export function getPlan(messagesUsed: number, isPro: boolean, isUnlimited: boolean) { if (isUnlimited) return 'unlimited'; if (isPro) return 'pro'; return 'free' }
export function getRemainingMessages(plan: string, used: number) { if (plan === 'unlimited') return Infinity; if (plan === 'pro') return Math.max(0, 500 - used); return Math.max(0, 20 - used) }