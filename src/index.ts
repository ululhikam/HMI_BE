import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import { authMiddleware, superadminMiddleware, AuthRequest, resolveAdminUser } from './middleware/auth'
import { corsMiddleware } from './middleware/cors'
import { AppError, errorHandler, notFoundHandler } from './middleware/error'
import { supabase, supabaseAuth } from './config/supabase'
import {
  LOCAL_UPLOAD_DIR,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  storeImage,
  usesObjectStorage,
} from './services/mediaStorage'
import {
  articleRepository,
  commentRepository,
  memberRepository,
  eventRepository,
  applicantRepository,
  galleryRepository,
  contactMessageRepository,
  newsletterRepository,
  siteRepository,
  adminUserRepository,
} from './database'
import type { AdminRole, EventRegistrationStatus } from './types'

const app = express()
const PORT = process.env.PORT || 3001

app.set('trust proxy', 1)

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(corsMiddleware)
app.use(express.json({ limit: '4.5mb' }))
app.use(express.urlencoded({ limit: '4.5mb', extended: true }))

// Hanya tersedia saat development/local. Filesystem Vercel tidak persisten;
// upload produksi disajikan dari Supabase Storage.
if (!usesObjectStorage()) {
  app.use('/uploads', express.static(LOCAL_UPLOAD_DIR))
}

/**
 * Identitas anonim per perangkat untuk like/bookmark.
 * Dikirim frontend lewat header `X-Visitor-Id`.
 */
function getVisitorId(req: Request): string {
  const raw = req.header('x-visitor-id')?.trim()
  if (raw && raw.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(raw)) return raw
  return 'anonymous'
}

// ============================================================
// Media Upload Route
// ============================================================

app.post('/upload', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { data, filename } = req.body ?? {}
    if (!data || typeof data !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Data gambar base64 wajib disertakan' },
      })
    }

    if (data.startsWith('http://') || data.startsWith('https://')) {
      return res.json({ success: true, data: { url: data } })
    }

    const matches = data.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/)
    if (!matches || matches.length !== 3) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Format data gambar base64 tidak valid' },
      })
    }

    const mimeType = matches[1]
    const base64Data = matches[2]
    const extensionByMime: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }
    const ext = extensionByMime[mimeType] ?? 'png'
    const cleanName = String(filename || 'media')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 60) || 'media'
    const safeFilename = `${Date.now()}-${cleanName}.${ext}`
    const buffer = Buffer.from(base64Data, 'base64')

    if (!buffer.length) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Data gambar kosong atau rusak' },
      })
    }

    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `Ukuran gambar melebihi ${MAX_UPLOAD_MB}MB`,
        },
      })
    }

    const baseUrl = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(
      /\/+$/,
      '',
    )
    const uploaded = await storeImage(buffer, safeFilename, mimeType, baseUrl)

    return res.json({ success: true, data: uploaded })
  } catch (err) {
    return next(err)
  }
})

// ============================================================
// Health Check
// ============================================================

app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      service: 'HMI Insan Cita API',
      status: 'ok',
      health: '/health',
    },
  })
})

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'supabase',
      storage: usesObjectStorage() ? 'supabase' : 'local',
    },
  })
})

// ============================================================
// Auth Routes
// ============================================================

app.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {}

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Email dan password wajib diisi' },
    })
  }

  try {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error || !data.session || !data.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Email atau password salah' },
      })
    }

    const mappedUser = await resolveAdminUser(data.user)

    await adminUserRepository.touchLastLogin(data.user.id).catch(() => {
      // Login tetap berhasil meskipun pencatatan waktu login gagal.
    })

    const expiresIn = data.session.expires_in ?? 3600
    return res.json({
      success: true,
      data: {
        user: mappedUser,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      },
    })
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message },
      })
    }
    return res.status(503).json({
      success: false,
      error: { code: 'AUTH_UNAVAILABLE', message: 'Layanan autentikasi tidak dapat dihubungi' },
    })
  }
})

app.post('/auth/logout', authMiddleware, (_req: AuthRequest, res: Response) => {
  return res.json({ success: true, data: { message: 'Logout berhasil' } })
})

app.get('/auth/me', authMiddleware, (req: AuthRequest, res: Response) => {
  const user = req.user
  if (!user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User tidak terautentikasi' },
    })
  }
  return res.json({ success: true, data: user })
})

app.post('/auth/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {}

  if (typeof refreshToken !== 'string' || !refreshToken) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Refresh token wajib diisi' },
    })
  }

  try {
    const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken })

    if (error || !data.session || !data.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Sesi sudah kedaluwarsa, silakan login ulang',
        },
      })
    }

    const mappedUser = await resolveAdminUser(data.user)

    const expiresIn = data.session.expires_in ?? 3600
    return res.json({
      success: true,
      data: {
        user: mappedUser,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      },
    })
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message },
      })
    }
    return res.status(503).json({
      success: false,
      error: { code: 'AUTH_UNAVAILABLE', message: 'Layanan autentikasi tidak dapat dihubungi' },
    })
  }
})

// ============================================================
// Admin Users Routes
// ============================================================

const ADMIN_ROLES: AdminRole[] = ['superadmin', 'admin']

function parseAdminRole(value: unknown): AdminRole | null {
  return typeof value === 'string' && ADMIN_ROLES.includes(value as AdminRole)
    ? (value as AdminRole)
    : null
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

app.get('/admin-users', authMiddleware, superadminMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page, perPage, search, role, isActive } = req.query
    const result = await adminUserRepository.list({
      page: page ? parseInt(page as string, 10) : undefined,
      perPage: perPage ? parseInt(perPage as string, 10) : undefined,
      search: typeof search === 'string' ? search : undefined,
      role: parseAdminRole(role) ?? 'Semua',
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    })

    return res.json({ success: true, data: result.data, meta: result.meta })
  } catch (err) {
    next(err)
  }
})

app.post('/admin-users', authMiddleware, superadminMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, name, password, role } = req.body ?? {}

    if (typeof email !== 'string' || !isValidEmail(email.trim())) {
      throw new AppError('Email admin tidak valid.', 400, 'VALIDATION_ERROR')
    }
    if (typeof name !== 'string' || !name.trim()) {
      throw new AppError('Nama admin wajib diisi.', 400, 'VALIDATION_ERROR')
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw new AppError('Password minimal 8 karakter.', 400, 'VALIDATION_ERROR')
    }

    const normalizedRole = parseAdminRole(role)
    if (!normalizedRole) {
      throw new AppError('Role admin tidak valid.', 400, 'VALIDATION_ERROR')
    }

    const data = await adminUserRepository.createAdmin({
      email: email.trim().toLowerCase(),
      name: name.trim(),
      password,
      role: normalizedRole,
    })

    return res.status(201).json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.patch('/admin-users/:id', authMiddleware, superadminMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, password, role, isActive } = req.body ?? {}
    const target = await adminUserRepository.findById(req.params.id)

    if (!target) {
      throw new AppError('Admin tidak ditemukan.', 404, 'NOT_FOUND')
    }

    const updates: {
      name?: string
      password?: string
      role?: AdminRole
      isActive?: boolean
    } = {}

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        throw new AppError('Nama admin wajib diisi.', 400, 'VALIDATION_ERROR')
      }
      updates.name = name.trim()
    }

    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 8) {
        throw new AppError('Password minimal 8 karakter.', 400, 'VALIDATION_ERROR')
      }
      updates.password = password
    }

    if (role !== undefined) {
      const normalizedRole = parseAdminRole(role)
      if (!normalizedRole) {
        throw new AppError('Role admin tidak valid.', 400, 'VALIDATION_ERROR')
      }
      updates.role = normalizedRole
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        throw new AppError('Status aktif admin tidak valid.', 400, 'VALIDATION_ERROR')
      }
      updates.isActive = isActive
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('Tidak ada data admin yang diubah.', 400, 'VALIDATION_ERROR')
    }

    if (target.id === req.user?.id && updates.isActive === false) {
      throw new AppError('Tidak dapat menonaktifkan akun sendiri.', 400, 'SELF_UPDATE_FORBIDDEN')
    }

    if (target.id === req.user?.id && updates.role && updates.role !== 'superadmin') {
      throw new AppError('Tidak dapat menurunkan role akun sendiri.', 400, 'SELF_UPDATE_FORBIDDEN')
    }

    const removesActiveSuperadmin =
      target.role === 'superadmin' &&
      target.isActive &&
      ((updates.role !== undefined && updates.role !== 'superadmin') || updates.isActive === false)

    if (removesActiveSuperadmin) {
      const otherSuperadmins = await adminUserRepository.countActiveSuperadmins(target.id)
      if (otherSuperadmins === 0) {
        throw new AppError('Minimal harus ada satu superadmin aktif.', 400, 'LAST_SUPERADMIN')
      }
    }

    const data = await adminUserRepository.updateAdmin(target.id, updates)
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.delete('/admin-users/:id', authMiddleware, superadminMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const target = await adminUserRepository.findById(req.params.id)

    if (!target) {
      throw new AppError('Admin tidak ditemukan.', 404, 'NOT_FOUND')
    }

    if (target.id === req.user?.id) {
      throw new AppError('Tidak dapat menghapus akun sendiri.', 400, 'SELF_DELETE_FORBIDDEN')
    }

    if (target.role === 'superadmin' && target.isActive) {
      const otherSuperadmins = await adminUserRepository.countActiveSuperadmins(target.id)
      if (otherSuperadmins === 0) {
        throw new AppError('Minimal harus ada satu superadmin aktif.', 400, 'LAST_SUPERADMIN')
      }
    }

    const data = await adminUserRepository.deleteAdmin(target.id)
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.post('/admin-users/:id/reset-password', authMiddleware, superadminMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body ?? {}

    if (typeof password !== 'string' || password.length < 8) {
      throw new AppError('Password minimal 8 karakter.', 400, 'VALIDATION_ERROR')
    }

    const target = await adminUserRepository.findById(req.params.id)
    if (!target) {
      throw new AppError('Admin tidak ditemukan.', 404, 'NOT_FOUND')
    }

    await adminUserRepository.updateAdmin(target.id, { password })
    return res.json({
      success: true,
      data: { message: 'Password admin berhasil diperbarui.' },
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// Articles Routes
// ============================================================

app.get('/articles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, perPage, category, tag, search, status, sort, featured } = req.query
    const result = await articleRepository.list({
      page: page ? parseInt(page as string, 10) : undefined,
      perPage: perPage ? parseInt(perPage as string, 10) : undefined,
      category: category as string,
      tag: tag as string,
      search: search as string,
      status: status as string,
      sort: sort as string,
      featured: featured === 'true',
    })
    return res.json({
      success: true,
      data: result.data,
      meta: result.meta,
    })
  } catch (err) {
    next(err)
  }
})

app.post('/articles', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await articleRepository.createArticle(req.body)
    return res.status(201).json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/articles/id/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await articleRepository.findByIdSingle(req.params.id)
    if (!data) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Artikel tidak ditemukan' },
      })
    }
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/articles/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await articleRepository.findBySlug(req.params.slug)
    if (!data) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Artikel tidak ditemukan' },
      })
    }
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.patch('/articles/:slug', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await articleRepository.updateArticleBySlug(req.params.slug, req.body)
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.delete('/articles/:slug', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await articleRepository.deleteArticleBySlug(req.params.slug)
    return res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

app.patch('/articles/id/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await articleRepository.updateArticle(req.params.id, req.body)
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.delete('/articles/id/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await articleRepository.deleteArticle(req.params.id)
    return res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

app.post('/articles/:slug/views', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await articleRepository.incrementViews(req.params.slug)
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.post('/articles/:slug/like', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await articleRepository.likeArticle(req.params.slug, getVisitorId(req))
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.post('/articles/:slug/bookmark', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await articleRepository.bookmarkArticle(req.params.slug, getVisitorId(req))
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.delete('/articles/:slug/like', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await articleRepository.unlikeArticle(req.params.slug, getVisitorId(req))
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.delete('/articles/:slug/bookmark', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await articleRepository.unbookmarkArticle(req.params.slug, getVisitorId(req))
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})


// Comments under article
app.get('/articles/:slug/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1
    const perPage = req.query.perPage ? parseInt(req.query.perPage as string, 10) : 50
    const result = await commentRepository.listByArticleSlug(req.params.slug, page, perPage)
    return res.json({ success: true, data: result.data, meta: result.meta })
  } catch (err) {
    next(err)
  }
})

app.post('/articles/:slug/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await commentRepository.createComment(req.params.slug, req.body)
    return res.status(201).json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.delete('/comments/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await commentRepository.deleteComment(req.params.id)
    return res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// Members Routes
// ============================================================

app.get('/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, perPage, department, period, search } = req.query
    const result = await memberRepository.list({
      page: page ? parseInt(page as string, 10) : undefined,
      perPage: perPage ? parseInt(perPage as string, 10) : undefined,
      department: department as string,
      period: period as string,
      search: search as string,
    })
    return res.json({ success: true, data: result.data, meta: result.meta })
  } catch (err) {
    next(err)
  }
})

app.post('/members', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await memberRepository.createMember(req.body)
    return res.status(201).json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/members/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await memberRepository.findMemberById(req.params.id)
    if (!data) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Anggota tidak ditemukan' },
      })
    }
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.patch('/members/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await memberRepository.updateMember(req.params.id, req.body)
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.delete('/members/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await memberRepository.deleteMember(req.params.id)
    return res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// Events Routes
// ============================================================

app.get('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, perPage, category, status, search, upcoming } = req.query
    const result = await eventRepository.list({
      page: page ? parseInt(page as string, 10) : undefined,
      perPage: perPage ? parseInt(perPage as string, 10) : undefined,
      category: category as string,
      status: status as any,
      search: search as string,
      upcoming: upcoming === 'true',
    })
    return res.json({ success: true, data: result.data, meta: result.meta })
  } catch (err) {
    next(err)
  }
})

app.post('/events', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await eventRepository.createEvent(req.body)
    return res.status(201).json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/events/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await eventRepository.getSummary()
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/events/featured', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await eventRepository.getFeatured()
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/events/past-highlights', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await eventRepository.listPastHighlights()
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/testimonials', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await eventRepository.listTestimonials()
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/events/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await eventRepository.findEventById(req.params.id)
    if (!data) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Event tidak ditemukan' },
      })
    }
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.patch('/events/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await eventRepository.updateEvent(req.params.id, req.body)
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.delete('/events/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await eventRepository.deleteEvent(req.params.id)
    return res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

app.post('/events/:id/registrations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await eventRepository.register(req.params.id, req.body)
    return res.status(201).json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// Event Registration Management Routes (non-LK1)
// ============================================================

app.get('/event-registrations', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page, perPage, eventId, status, search } = req.query
    const result = await eventRepository.listRegistrations({
      page: page ? parseInt(page as string, 10) : undefined,
      perPage: perPage ? parseInt(perPage as string, 10) : undefined,
      eventId: eventId as string | undefined,
      status: status as EventRegistrationStatus | 'Semua' | undefined,
      search: search as string | undefined,
    })
    return res.json({ success: true, data: result.data, meta: result.meta })
  } catch (err) {
    next(err)
  }
})

app.get('/event-registrations/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await eventRepository.findRegistrationById(req.params.id)
    if (!data) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Pendaftaran agenda tidak ditemukan' },
      })
    }
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.patch('/event-registrations/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = req.body?.status as EventRegistrationStatus
    const data = await eventRepository.updateRegistrationStatus(req.params.id, status)
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.delete('/event-registrations/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await eventRepository.deleteRegistration(req.params.id)
    return res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// LK1 Applications Routes
// ============================================================

app.get('/lk1-applications', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page, perPage, status, search } = req.query
    const result = await applicantRepository.list({
      page: page ? parseInt(page as string, 10) : undefined,
      perPage: perPage ? parseInt(perPage as string, 10) : undefined,
      status: status as any,
      search: search as string,
    })
    return res.json({ success: true, data: result.data, meta: result.meta })
  } catch (err) {
    next(err)
  }
})

app.post('/lk1-applications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await applicantRepository.createApplicant(req.body)
    return res.status(201).json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/lk1-applications/stats', authMiddleware, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await applicantRepository.getStats()
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/lk1-applications/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await applicantRepository.findApplicantById(req.params.id)
    if (!data) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Aplikasi pendaftar tidak ditemukan' },
      })
    }
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.patch('/lk1-applications/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body
    const data = await applicantRepository.updateStatus(req.params.id, status)
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// Gallery Routes
// ============================================================

app.get('/gallery', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, perPage, category, type, search } = req.query
    const result = await galleryRepository.list({
      page: page ? parseInt(page as string, 10) : undefined,
      perPage: perPage ? parseInt(perPage as string, 10) : undefined,
      category: category as any,
      type: type as any,
      search: search as string,
    })
    return res.json({ success: true, data: result.data, meta: result.meta })
  } catch (err) {
    next(err)
  }
})

app.post('/gallery', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await galleryRepository.createGallery(req.body)
    return res.status(201).json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/gallery/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await galleryRepository.findGalleryById(req.params.id)
    if (!data) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Item galeri tidak ditemukan' },
      })
    }
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.patch('/gallery/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await galleryRepository.updateGallery(req.params.id, req.body)
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.delete('/gallery/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await galleryRepository.deleteGallery(req.params.id)
    return res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// Contact Messages Routes
// ============================================================

app.post('/contact-messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await contactMessageRepository.createMessage(req.body)
    return res.status(201).json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/contact-messages', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page, perPage, status } = req.query
    const result = await contactMessageRepository.list({
      page: page ? parseInt(page as string, 10) : undefined,
      perPage: perPage ? parseInt(perPage as string, 10) : undefined,
      status: status as any,
    })
    return res.json({ success: true, data: result.data, meta: result.meta })
  } catch (err) {
    next(err)
  }
})

app.patch('/contact-messages/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await contactMessageRepository.markAsRead(req.params.id)
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// Newsletter Routes
// ============================================================

app.post('/newsletter/subscriptions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await newsletterRepository.subscribe(req.body)
    return res.status(201).json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// Site Routes
// ============================================================

app.get('/site/settings', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await siteRepository.getSettings()
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/site/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await siteRepository.getStats()
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/site/home', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await siteRepository.getHome()
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/site/about', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await siteRepository.getAbout()
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

app.get('/site/live-streams', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await siteRepository.getLiveStreams()
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// Admin Dashboard
// ============================================================

app.get('/admin/dashboard', authMiddleware, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await siteRepository.getDashboardStats()
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

// Error handlers
app.use(notFoundHandler)
app.use(errorHandler)

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Backend running at http://localhost:${PORT}`)
  })
}


export default app