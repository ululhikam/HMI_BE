import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('SUPABASE_URL dan SUPABASE_ANON_KEY wajib diisi di environment backend.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const tables = [
  'articles',
  'comments',
  'article_likes',
  'article_bookmarks',
  'members',
  'events',
  'event_registrations',
  'speakers',
  'testimonials',
  'past_highlights',
  'lk1_applications',
  'gallery',
  'contact_messages',
  'newsletter_subscriptions',
  'site_settings',
  'site_pages',
  'live_streams',
]

async function verify() {
  console.log('Checking database connection and tables...\n')
  let allGood = true

  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (error) {
      allGood = false
      console.log(`[${table}]: ERROR (${error.message})`)
    } else {
      console.log(`[${table}]: OK (records: ${count ?? 0})`)
    }
  }

  console.log('\n----------------------------------------')
  if (allGood) {
    console.log('Semua tabel tersedia dan siap digunakan.')
  } else {
    console.log('Beberapa tabel bermasalah. Periksa output di atas.')
    process.exitCode = 1
  }
}

verify()
