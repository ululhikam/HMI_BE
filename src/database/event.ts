import { BaseRepository, supabase } from './base'
import { AppError } from '../middleware/error'
import type {
  Event,
  EventRegistration,
  EventRegistrationInput,
  EventStatus,
  EventSummary,
  PastEventPhoto,
  Speaker,
  Testimonial,
} from '../types'

export interface EventListQuery {
  page?: number
  perPage?: number
  category?: string
  status?: EventStatus | 'Semua'
  search?: string
  upcoming?: boolean
}

export type EventInput = Omit<Event, 'id'>

export class EventRepository extends BaseRepository {
  constructor() {
    super('events')
  }

  async list(query: EventListQuery = {}) {
    const page = query.page ?? 1
    const perPage = query.perPage ?? 20

    let q = supabase.from('events').select('*', { count: 'exact' })

    if (query.category && query.category !== 'Semua') {
      q = q.eq('category', query.category)
    }

    if (query.status && query.status !== 'Semua') {
      q = q.eq('status', query.status)
    }

    if (query.upcoming) {
      q = q.gte('date', new Date().toISOString())
    }

    if (query.search) {
      q = q.or(`title.ilike.%${query.search}%,description.ilike.%${query.search}%`)
    }

    q = q.order('date', { ascending: true })

    const from = (page - 1) * perPage
    const to = from + perPage - 1
    q = q.range(from, to)

    const { data, error, count } = await q
    if (error) throw error

    return {
      data: (data ?? []) as Event[],
      total: count ?? 0,
      meta: this.buildMeta(count ?? 0, { page, perPage }),
    }
  }

  async findEventById(id: string): Promise<Event | null> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data as Event | null
  }

  async getFeatured(): Promise<Event | null> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'upcoming')
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data as Event | null
  }

  async getSummary(): Promise<EventSummary> {
    const [eventsCount, speakersCount, registrationsCount] = await Promise.all([
      this.countAll(),
      supabase.from('speakers').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0),
      supabase.from('event_registrations').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0),
    ])

    return {
      speakers: speakersCount,
      participants: registrationsCount,
      sessions: eventsCount,
      alumni: 0,
    }
  }

  async listSpeakers(): Promise<Speaker[]> {
    const { data, error } = await supabase
      .from('speakers')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return (data ?? []) as Speaker[]
  }

  async listTestimonials(): Promise<Testimonial[]> {
    const { data, error } = await supabase
      .from('testimonials')
      .select('*')

    if (error) throw error
    return (data ?? []) as Testimonial[]
  }

  async listPastHighlights(): Promise<PastEventPhoto[]> {
    const { data, error } = await supabase
      .from('past_highlights')
      .select('*')
      .order('year', { ascending: false })

    if (error) throw error
    return (data ?? []) as PastEventPhoto[]
  }

  async register(eventId: string, input: EventRegistrationInput): Promise<EventRegistration> {
    const record = {
      eventId,
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('event_registrations')
      .insert([record])
      .select()
      .single()

    if (error) throw error
    return data as EventRegistration
  }

  async createEvent(input: Partial<Event>): Promise<Event> {
    const { data, error } = await supabase
      .from('events')
      .insert([input])
      .select()
      .single()

    if (error) throw error
    return data as Event
  }

  async updateEvent(id: string, input: Partial<Event>): Promise<Event> {
    const { data, error } = await supabase
      .from('events')
      .update(input)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) throw new AppError('Event tidak ditemukan', 404, 'NOT_FOUND')
    return data as Event
  }

  async deleteEvent(id: string) {
    const { data, error } = await supabase.from('events').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data || data.length === 0) {
      throw new AppError('Event tidak ditemukan', 404, 'NOT_FOUND')
    }
    return { message: 'Event berhasil dihapus' }
  }
}