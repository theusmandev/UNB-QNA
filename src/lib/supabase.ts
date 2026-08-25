import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

/** Base URL used to build shareable /r/:slug links (set via VITE_PUBLIC_BASE_URL). */
export const publicBaseUrl: string =
  (import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin).replace(/\/$/, '')

/** Display name for the channel, shown next to admin replies. */
export const channelName: string = import.meta.env.VITE_CHANNEL_NAME || 'Urdu Novel Bank'
