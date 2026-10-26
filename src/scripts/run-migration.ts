import 'dotenv/config'
import { Client } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

const DB_PASSWORD = process.env.DB_PASSWORD
const DB_HOST = process.env.DB_HOST
const DB_USER = process.env.DB_USER
const DB_NAME = process.env.DB_NAME || 'postgres'

if (!process.env.DATABASE_URL && (!DB_PASSWORD || !DB_HOST || !DB_USER)) {
  throw new Error(
    'DATABASE_URL, atau DB_HOST + DB_USER + DB_PASSWORD wajib diisi di environment backend.',
  )
}

async function run() {
  console.log('Connecting to Supabase database...')

  let client: Client | null = null
  const ports = [5432, 6543]

  for (const port of ports) {
    const c = process.env.DATABASE_URL
      ? new Client({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 10000,
        })
      : new Client({
          host: DB_HOST,
          port,
          user: DB_USER,
          password: DB_PASSWORD,
          database: DB_NAME,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 10000,
        })

    try {
      console.log(`Trying port ${port}...`)
      await c.connect()
      console.log(`Connected successfully on port ${port}.`)
      client = c
      break
    } catch (err: any) {
      console.warn(`Port ${port} failed: ${err.message}`)
      try {
        await c.end()
      } catch {
        // abaikan
      }
    }
  }

  if (!client) {
    console.error('Failed to connect on both ports 5432 and 6543.')
    process.exit(1)
  }

  const sqlPath = path.resolve(__dirname, '../../schema.sql')
  console.log(`Reading SQL schema from ${sqlPath}...`)
  const sql = fs.readFileSync(sqlPath, 'utf-8')

  console.log('Executing migration SQL onto Supabase...')
  try {
    await client.query(sql)
    console.log('Migration successful.')
  } catch (err: any) {
    console.error('Migration error:', err.message)
    console.error(err)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

run()
