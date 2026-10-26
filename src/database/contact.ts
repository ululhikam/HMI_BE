import { BaseRepository, supabase } from './base'
import { AppError } from '../middleware/error'
import type { ContactMessage, ContactMessageInput } from '../types'

export interface ContactMessageListQuery {
  page?: number
  perPage?: number
  status?: ContactMessage['status']
}

export class ContactMessageRepository extends BaseRepository {
  constructor() {
    super('contact_messages')
  }

  async list(query: ContactMessageListQuery = {}) {
    const page = query.page ?? 1
    const perPage = query.perPage ?? 20

    let q = supabase.from('contact_messages').select('*', { count: 'exact' })

    if (query.status) {
      q = q.eq('status', query.status)
    }

    q = q.order('createdAt', { ascending: false })

    const from = (page - 1) * perPage
    const to = from + perPage - 1
    q = q.range(from, to)

    const { data, error, count } = await q
    if (error) throw error

    return {
      data: (data ?? []) as ContactMessage[],
      total: count ?? 0,
      meta: this.buildMeta(count ?? 0, { page, perPage }),
    }
  }

  async createMessage(input: ContactMessageInput): Promise<ContactMessage> {
    const record = {
      ...input,
      status: 'new',
      createdAt: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('contact_messages')
      .insert([record])
      .select()
      .single()

    if (error) throw error
    return data as ContactMessage
  }

  async markAsRead(id: string): Promise<ContactMessage> {
    const { data, error } = await supabase
      .from('contact_messages')
      .update({ status: 'read' })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) throw new AppError('Pesan tidak ditemukan', 404, 'NOT_FOUND')
    return data as ContactMessage
  }
}