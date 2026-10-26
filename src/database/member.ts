import { BaseRepository, supabase } from './base'
import { AppError } from '../middleware/error'
import type { Member, MemberInput } from '../types'

export interface MemberListQuery {
  page?: number
  perPage?: number
  department?: string
  period?: string
  search?: string
}

export class MemberRepository extends BaseRepository {
  constructor() {
    super('members')
  }

  async list(query: MemberListQuery = {}) {
    const page = query.page ?? 1
    const perPage = query.perPage ?? 20

    let q = supabase.from('members').select('*', { count: 'exact' })

    if (query.department) {
      q = q.eq('department', query.department)
    }

    if (query.period) {
      q = q.eq('period', query.period)
    }

    if (query.search) {
      q = q.or(`name.ilike.%${query.search}%,position.ilike.%${query.search}%`)
    }

    q = q.order('name', { ascending: true })

    const from = (page - 1) * perPage
    const to = from + perPage - 1
    q = q.range(from, to)

    const { data, error, count } = await q
    if (error) throw error

    return {
      data: (data ?? []) as Member[],
      total: count ?? 0,
      meta: this.buildMeta(count ?? 0, { page, perPage }),
    }
  }

  async findMemberById(id: string): Promise<Member | null> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data as Member | null
  }

  async createMember(input: MemberInput): Promise<Member> {
    const { data, error } = await supabase
      .from('members')
      .insert([input])
      .select()
      .single()

    if (error) throw error
    return data as Member
  }

  async updateMember(id: string, input: Partial<MemberInput>): Promise<Member> {
    const { data, error } = await supabase
      .from('members')
      .update(input)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) throw new AppError('Anggota tidak ditemukan', 404, 'NOT_FOUND')
    return data as Member
  }

  async deleteMember(id: string) {
    const { data, error } = await supabase.from('members').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data || data.length === 0) {
      throw new AppError('Anggota tidak ditemukan', 404, 'NOT_FOUND')
    }
    return { message: 'Anggota berhasil dihapus' }
  }
}