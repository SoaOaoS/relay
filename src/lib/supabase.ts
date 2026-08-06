import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uazlfifipfztygfutraz.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhemxmaWZpcGZ6dHlnZnV0cmF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMDIzNjcsImV4cCI6MjEwMTU3ODM2N30.ENjKVevblAkCadEsMd82M4qHwSyino1Xt7_DPu0AXe8'

let _supabase: SupabaseClient | null = null
let _supabaseAdmin: SupabaseClient | null = null

export function getSupabase() {
  if (!_supabase) { _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY) }
  return _supabase
}

export function getSupabaseAdmin() {
  if (!_supabaseAdmin) { _supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || '') }
  return _supabaseAdmin
}

export const supabase = new Proxy({} as SupabaseClient, { get(_, prop) { return (getSupabase() as any)[prop] } })
export const supabaseAdmin = new Proxy({} as SupabaseClient, { get(_, prop) { return (getSupabaseAdmin() as any)[prop] } })