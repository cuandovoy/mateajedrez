import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
  })
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

// Ensure Supabase URL uses HTTPS (fix mixed content issues)
if (supabaseUrl.startsWith('http://')) {
  supabaseUrl = supabaseUrl.replace('http://', 'https://')
  console.warn('Supabase URL was changed from HTTP to HTTPS for security')
}

// Create Supabase client with better error handling
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
