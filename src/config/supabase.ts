import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL wajib diisi di environment backend.')
}

if (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'SUPABASE_ANON_KEY (atau SUPABASE_SERVICE_ROLE_KEY) wajib diisi di environment backend.',
  )
}

// Service role key dipakai untuk operasi database di server bila tersedia.
// Anon key tetap dipakai sebagai fallback agar setup lokal tetap sederhana.
const databaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!

export { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY }

export const SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET?.trim().replace(/^\/+|\/+$/g, '') || 'media'

export const supabase = createClient(SUPABASE_URL, databaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
})
