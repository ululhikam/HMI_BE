import cors from 'cors'

const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)

const allowAllOrigins = configuredOrigins.length === 0 || configuredOrigins.includes('*')

if (process.env.NODE_ENV === 'production' && configuredOrigins.length === 0) {
  console.warn(
    '[cors] CORS_ORIGINS belum diisi. Semua origin diizinkan; isi CORS_ORIGINS untuk produksi.',
  )
}

function isAllowedOrigin(origin: string): boolean {
  if (allowAllOrigins) return true

  return configuredOrigins.some((allowed) => {
    if (allowed === origin) return true

    // Dukungan domain preview, mis. *.vercel.app.
    if (allowed.startsWith('*.')) {
      return origin.endsWith(allowed.slice(1))
    }

    return false
  })
}

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Request tanpa Origin (curl, health check, server-to-server) tetap diizinkan.
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true)
      return
    }
    callback(null, false)
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Visitor-Id'],
  maxAge: 86_400,
})
