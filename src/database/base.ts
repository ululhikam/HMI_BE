import { supabase } from '../config/supabase'
import { AppError } from '../middleware/error'
import type { PaginationMeta } from '../types'

export interface QueryOptions {
  page?: number
  perPage?: number
  select?: string
  orderBy?: string
  ascending?: boolean
  eq?: Record<string, string>
  neq?: Record<string, string>
  like?: Record<string, string>
  gte?: Record<string, string>
  lte?: Record<string, string>
}

export { supabase }

export class BaseRepository {
  protected table: string

  constructor(table: string) {
    this.table = table
  }

  async findAll(options?: QueryOptions) {
    let query = supabase.from(this.table).select(options?.select || '*', { count: 'exact' })

    if (options?.eq) {
      for (const [field, value] of Object.entries(options.eq)) {
        query = query.eq(field, value)
      }
    }

    if (options?.neq) {
      for (const [field, value] of Object.entries(options.neq)) {
        query = query.neq(field, value)
      }
    }

    if (options?.like) {
      for (const [field, value] of Object.entries(options.like)) {
        query = query.ilike(field, `%${value}%`)
      }
    }

    if (options?.gte) {
      for (const [field, value] of Object.entries(options.gte)) {
        query = query.gte(field, value)
      }
    }

    if (options?.lte) {
      for (const [field, value] of Object.entries(options.lte)) {
        query = query.lte(field, value)
      }
    }

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options?.ascending ?? false })
    }

    if (options?.perPage) {
      const page = options.page ?? 1
      const from = (page - 1) * options.perPage
      const to = from + options.perPage - 1
      query = query.range(from, to)
    }

    const { data, error, count } = await query

    if (error) throw error
    return { data: data ?? [], total: count ?? 0 }
  }

  async findById(id: string) {
    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data
  }

  async create(record: any) {
    const { data, error } = await supabase
      .from(this.table)
      .insert([record])
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: string, record: any) {
    const { data, error } = await supabase
      .from(this.table)
      .update(record)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) throw new AppError('Data tidak ditemukan', 404, 'NOT_FOUND')
    return data
  }

  async delete(id: string) {
    const { data, error } = await supabase
      .from(this.table)
      .delete()
      .eq('id', id)
      .select('id')

    if (error) throw error
    if (!data || data.length === 0) throw new AppError('Data tidak ditemukan', 404, 'NOT_FOUND')
    return { success: true }
  }

  async countAll(eq?: Record<string, string>): Promise<number> {
    let query = supabase.from(this.table).select('*', { count: 'exact', head: true })
    if (eq) {
      for (const [field, value] of Object.entries(eq)) {
        query = query.eq(field, value)
      }
    }
    const { count } = await query
    return count ?? 0
  }

  /** Build PaginationMeta from total count and query options */
  buildMeta(total: number, options?: { page?: number; perPage?: number }): PaginationMeta {
    const page = options?.page ?? 1
    const perPage = options?.perPage ?? 20
    return {
      page,
      perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    }
  }
}