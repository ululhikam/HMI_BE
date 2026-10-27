import { Request, Response, NextFunction } from 'express'
import { supabase, supabaseAuth } from '../config/supabase'
import { adminUserRepository } from '../database'
import { AppError } from './error'
import type { UserRole } from '../types'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    name: string
    role: UserRole
    avatar?: string
    createdAt: string
  }
}

export function mapSupabaseUser(user: {
  id: string
  email?: string
  created_at?: string
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
}): NonNullable<AuthRequest['user']> {
  const metadata = user.user_metadata ?? {}
  const appMetadata = user.app_metadata ?? {}
  const appRole = appMetadata.role
  const role: UserRole =
    appRole === 'superadmin' || appRole === 'admin' || appRole === 'kader' ? appRole : 'kader'
  const name =
    (metadata.name as string | undefined) ||
    (metadata.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Administrator'

  return {
    id: user.id,
    email: user.email ?? '',
    name,
    role,
    avatar: (metadata.avatar_url as string | undefined) || undefined,
    createdAt: user.created_at ?? new Date().toISOString(),
  }
}

/**
 * Validasi akun Supabase Auth terhadap tabel `admin_users`.
 * Tabel tersebut menjadi sumber otorisasi (role + status aktif) aplikasi.
 */
export async function resolveAdminUser(
  user: Parameters<typeof mapSupabaseUser>[0],
): Promise<NonNullable<AuthRequest['user']>> {
  const profile = await adminUserRepository.findById(user.id)

  if (!profile) {
    throw new AppError(
      'Akun ini belum terdaftar sebagai admin. Hubungi superadmin.',
      403,
      'ADMIN_NOT_REGISTERED',
    )
  }

  if (!profile.isActive) {
    throw new AppError('Akun admin ini sudah dinonaktifkan.', 403, 'ADMIN_INACTIVE')
  }

  const mappedUser = mapSupabaseUser(user)
  return {
    ...mappedUser,
    name: profile.name || mappedUser.name,
    email: profile.email || mappedUser.email,
    role: profile.role,
    createdAt: profile.createdAt,
  }
}

function sendAuthError(res: Response, err: unknown) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    })
  }

  return res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'Gagal memverifikasi sesi' },
  })
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Token tidak ditemukan' },
      })
    }

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Token tidak ditemukan' },
      })
    }

    const { data, error } = await supabaseAuth.auth.getUser(token)

    if (error || !data.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Sesi tidak valid atau sudah kedaluwarsa' },
      })
    }

    req.user = await resolveAdminUser(data.user)
    return next()
  } catch (err) {
    return sendAuthError(res, err)
  }
}

export function superadminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Hanya superadmin yang dapat mengelola admin' },
    })
  }

  return next()
}
