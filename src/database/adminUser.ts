import { SUPABASE_SERVICE_ROLE_KEY } from '../config/supabase'
import { AppError } from '../middleware/error'
import type {
  AdminRole,
  AdminUser,
  AdminUserCreateInput,
  AdminUserUpdateInput,
} from '../types'
import { BaseRepository, supabase } from './base'

export interface AdminUserListQuery {
  page?: number
  perPage?: number
  search?: string
  role?: AdminRole | 'Semua'
  isActive?: boolean
}

const ADMIN_ROLES: AdminRole[] = ['superadmin', 'admin']

function assertServiceRole() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError(
      'SUPABASE_SERVICE_ROLE_KEY diperlukan untuk mengelola akun admin.',
      503,
      'ADMIN_API_UNAVAILABLE',
    )
  }
}

function toAdminApiError(message: string, fallback: string) {
  if (/already|exists|registered/i.test(message)) {
    return new AppError('Email sudah terdaftar sebagai akun.', 409, 'DUPLICATE_ENTRY')
  }
  return new AppError(message || fallback, 400, 'ADMIN_API_ERROR')
}

export class AdminUserRepository extends BaseRepository {
  constructor() {
    super('admin_users')
  }

  async list(query: AdminUserListQuery = {}) {
    const page = query.page ?? 1
    const perPage = query.perPage ?? 20

    let q = supabase.from('admin_users').select('*', { count: 'exact' })

    if (query.search) {
      q = q.or(`name.ilike.%${query.search}%,email.ilike.%${query.search}%`)
    }

    if (query.role && query.role !== 'Semua') {
      q = q.eq('role', query.role)
    }

    if (typeof query.isActive === 'boolean') {
      q = q.eq('isActive', query.isActive)
    }

    q = q.order('createdAt', { ascending: true })

    const from = (page - 1) * perPage
    q = q.range(from, from + perPage - 1)

    const { data, error, count } = await q
    if (error) throw error

    return {
      data: (data ?? []) as AdminUser[],
      meta: this.buildMeta(count ?? 0, { page, perPage }),
    }
  }

  async findById(id: string): Promise<AdminUser | null> {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return (data as AdminUser | null) ?? null
  }

  async findByEmail(email: string): Promise<AdminUser | null> {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (error) throw error
    return (data as AdminUser | null) ?? null
  }

  async countActiveSuperadmins(excludeId?: string): Promise<number> {
    let q = supabase
      .from('admin_users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'superadmin')
      .eq('isActive', true)

    if (excludeId) q = q.neq('id', excludeId)

    const { count, error } = await q
    if (error) throw error
    return count ?? 0
  }

  async createAdmin(input: AdminUserCreateInput): Promise<AdminUser> {
    assertServiceRole()

    const email = input.email.trim().toLowerCase()
    const existing = await this.findByEmail(email)
    if (existing) {
      throw new AppError('Email sudah terdaftar sebagai admin.', 409, 'DUPLICATE_ENTRY')
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      app_metadata: { role: input.role },
      user_metadata: { name: input.name },
    })

    if (authError || !authData.user) {
      throw toAdminApiError(authError?.message ?? '', 'Gagal membuat akun autentikasi admin.')
    }

    const { data, error } = await supabase
      .from('admin_users')
      .insert([
        {
          id: authData.user.id,
          email,
          name: input.name,
          role: input.role,
          isActive: true,
        },
      ])
      .select()
      .single()

    if (error) {
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw error
    }

    return data as AdminUser
  }

  async updateAdmin(id: string, input: AdminUserUpdateInput): Promise<AdminUser> {
    assertServiceRole()

    const existing = await this.findById(id)
    if (!existing) throw new AppError('Admin tidak ditemukan.', 404, 'NOT_FOUND')

    if (input.role && !ADMIN_ROLES.includes(input.role)) {
      throw new AppError('Role admin tidak valid.', 400, 'VALIDATION_ERROR')
    }

    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(id)
    if (authError || !authData.user) {
      throw new AppError('Akun autentikasi admin tidak ditemukan.', 404, 'NOT_FOUND')
    }

    const attributes: {
      password?: string
      app_metadata?: Record<string, unknown>
      user_metadata?: Record<string, unknown>
    } = {
      app_metadata: {
        ...(authData.user.app_metadata ?? {}),
        role: input.role ?? existing.role,
      },
      user_metadata: {
        ...(authData.user.user_metadata ?? {}),
        name: input.name ?? existing.name,
      },
    }

    if (input.password) attributes.password = input.password

    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
      id,
      attributes,
    )
    if (updateAuthError) {
      throw toAdminApiError(updateAuthError.message, 'Gagal memperbarui akun autentikasi admin.')
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }
    if (input.name !== undefined) updates.name = input.name
    if (input.role !== undefined) updates.role = input.role
    if (input.isActive !== undefined) updates.isActive = input.isActive

    const { data, error } = await supabase
      .from('admin_users')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as AdminUser
  }

  async deleteAdmin(id: string): Promise<{ message: string }> {
    assertServiceRole()

    const existing = await this.findById(id)
    if (!existing) throw new AppError('Admin tidak ditemukan.', 404, 'NOT_FOUND')

    const { error: authError } = await supabase.auth.admin.deleteUser(id)
    if (authError && !/not found|does not exist/i.test(authError.message)) {
      throw toAdminApiError(authError.message, 'Gagal menghapus akun autentikasi admin.')
    }

    const { error } = await supabase.from('admin_users').delete().eq('id', id)
    if (error) throw error

    return { message: 'Admin berhasil dihapus.' }
  }

  async touchLastLogin(id: string): Promise<void> {
    const { error } = await supabase
      .from('admin_users')
      .update({ lastLoginAt: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  }
}
