import 'dotenv/config'
import { Client } from 'pg'

const DB_PASSWORD = process.env.DB_PASSWORD
const DB_HOST = process.env.DB_HOST
const DB_USER = process.env.DB_USER
const DB_NAME = process.env.DB_NAME || 'postgres'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrator'

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi di environment backend.')
  process.exit(1)
}

if (ADMIN_PASSWORD.length < 8) {
  console.error('ADMIN_PASSWORD minimal 8 karakter.')
  process.exit(1)
}

if (!process.env.DATABASE_URL && (!DB_PASSWORD || !DB_HOST || !DB_USER)) {
  console.error('DATABASE_URL, atau DB_HOST + DB_USER + DB_PASSWORD wajib diisi di environment backend.')
  process.exit(1)
}

async function main() {
  const client = process.env.DATABASE_URL
    ? new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
      })
    : new Client({
        host: DB_HOST,
        port: 5432,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
      })

  await client.connect()

  try {
    await client.query('BEGIN')

    const existing = await client.query<{ id: string }>(
      'select id from auth.users where email = $1 limit 1',
      [ADMIN_EMAIL],
    )

    let userId: string

    if (existing.rows[0]) {
      userId = existing.rows[0].id
      await client.query(
        `update auth.users
         set encrypted_password = crypt($2, gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             raw_app_meta_data = $3::jsonb,
             raw_user_meta_data = $4::jsonb,
             updated_at = now()
         where id = $1`,
        [
          userId,
          ADMIN_PASSWORD,
          JSON.stringify({ provider: 'email', providers: ['email'], role: 'superadmin' }),
          JSON.stringify({ name: ADMIN_NAME }),
        ],
      )
      console.log(`Admin diperbarui: ${ADMIN_EMAIL}`)
    } else {
      const inserted = await client.query<{ id: string }>(
        `insert into auth.users (
           instance_id, id, aud, role, email, encrypted_password,
           email_confirmed_at, confirmation_token, recovery_token,
           email_change, email_change_token_new,
           raw_app_meta_data, raw_user_meta_data,
           created_at, updated_at
         ) values (
           '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
           'authenticated', 'authenticated', $1, crypt($2, gen_salt('bf')),
           now(), '', '', '', '',
           $3::jsonb, $4::jsonb,
           now(), now()
         )
         returning id`,
        [
          ADMIN_EMAIL,
          ADMIN_PASSWORD,
          JSON.stringify({ provider: 'email', providers: ['email'], role: 'superadmin' }),
          JSON.stringify({ name: ADMIN_NAME }),
        ],
      )
      userId = inserted.rows[0].id
      console.log(`Admin dibuat: ${ADMIN_EMAIL}`)
    }

    await client.query(
      `insert into auth.identities (
         provider_id, user_id, identity_data, provider,
         last_sign_in_at, created_at, updated_at
       ) values (
         $1::text, $2::uuid,
         jsonb_build_object('sub', $2::uuid::text, 'email', $1::text),
         'email', now(), now(), now()
       )
       on conflict (provider_id, provider) do update
       set identity_data = excluded.identity_data,
           updated_at = now()`,
      [ADMIN_EMAIL, userId],
    )

    await client.query(
      `insert into public.admin_users (id, email, name, role, "isActive", "createdAt", "updatedAt")
       values ($1::uuid, $2, $3, 'superadmin', true, now(), now())
       on conflict (id) do update
       set email = excluded.email,
           name = excluded.name,
           role = 'superadmin',
           "isActive" = true,
           "updatedAt" = now()`,
      [userId, ADMIN_EMAIL, ADMIN_NAME],
    )

    await client.query('COMMIT')
    console.log('Akun admin siap digunakan.')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
