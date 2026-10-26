import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabase'
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

function isAdminRole(role: UserRole): boolean {
  return role === 'admin' || role === 'superadmin'
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

    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Sesi tidak valid atau sudah kedaluwarsa' },
      })
    }

    const mappedUser = mapSupabaseUser(data.user)
    if (!isAdminRole(mappedUser.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Akun ini tidak memiliki akses admin' },
      })
    }

    req.user = mappedUser
    return next()
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Gagal memverifikasi sesi' },
    })
  }
}
