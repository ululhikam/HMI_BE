import { BaseRepository, supabase } from './base'
import { AppError } from '../middleware/error'
import type {
  ApplicantStats,
  ApplicantStatus,
  LK1Applicant,
  LK1ApplicationInput,
} from '../types'

export interface ApplicantListQuery {
  page?: number
  perPage?: number
  status?: ApplicantStatus | 'Semua'
  search?: string
}

export class ApplicantRepository extends BaseRepository {
  constructor() {
    super('lk1_applications')
  }

  async list(query: ApplicantListQuery = {}) {
    const page = query.page ?? 1
    const perPage = query.perPage ?? 20

    let q = supabase.from('lk1_applications').select('*', { count: 'exact' })

    if (query.status && query.status !== 'Semua') {
      q = q.eq('status', query.status)
    }

    if (query.search) {
      q = q.or(`fullName.ilike.%${query.search}%,nim.ilike.%${query.search}%,university.ilike.%${query.search}%`)
    }

    q = q.order('submittedAt', { ascending: false })

    const from = (page - 1) * perPage
    const to = from + perPage - 1
    q = q.range(from, to)

    const { data, error, count } = await q
    if (error) throw error

    return {
      data: (data ?? []) as LK1Applicant[],
      total: count ?? 0,
      meta: this.buildMeta(count ?? 0, { page, perPage }),
    }
  }

  async getStats(): Promise<ApplicantStats> {
    const [total, pending, accepted, rejected] = await Promise.all([
      this.countAll(),
      this.countAll({ status: 'pending' }),
      this.countAll({ status: 'accepted' }),
      this.countAll({ status: 'rejected' }),
    ])

    return {
      total,
      pending,
      accepted,
      rejected,
    }
  }

  async createApplicant(input: LK1ApplicationInput): Promise<LK1Applicant> {
    const record = {
      ...input,
      status: 'pending',
      submittedAt: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('lk1_applications')
      .insert([record])
      .select()
      .single()

    if (error) throw error
    return data as LK1Applicant
  }

  async updateStatus(id: string, status: ApplicantStatus): Promise<LK1Applicant> {
    const { data, error } = await supabase
      .from('lk1_applications')
      .update({ status })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) throw new AppError('Pendaftar tidak ditemukan', 404, 'NOT_FOUND')
    return data as LK1Applicant
  }

  async findApplicantById(id: string): Promise<LK1Applicant | null> {
    const { data, error } = await supabase
      .from('lk1_applications')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data as LK1Applicant | null
  }
}