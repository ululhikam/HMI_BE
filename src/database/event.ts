import { BaseRepository, supabase } from './base'
import { AppError } from '../middleware/error'
import type {
  Event,
  EventRegistration,
  EventRegistrationEventSummary,
  EventRegistrationInput,
  EventRegistrationStatus,
  EventRegistrationWithEvent,
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

export interface EventRegistrationListQuery {
  page?: number
  perPage?: number
  eventId?: string
  status?: EventRegistrationStatus | 'Semua'
  search?: string
}

const REGISTRATION_STATUSES: EventRegistrationStatus[] = ['confirmed', 'waitlist', 'cancelled']
const LK1_REGISTRATION_MESSAGE = 'Pendaftaran LK 1 dikelola melalui menu Pendaftar LK 1.'

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

  private async getManageableEventIds(eventId?: string): Promise<string[]> {
    if (eventId) {
      const event = await this.findEventById(eventId)
      if (!event) throw new AppError('Agenda tidak ditemukan.', 404, 'NOT_FOUND')
      if (event.category === 'LK1') {
        throw new AppError(LK1_REGISTRATION_MESSAGE, 400, 'LK1_REGISTRATION_SEPARATE')
      }
      return [event.id]
    }

    const { data, error } = await supabase.from('events').select('id').neq('category', 'LK1')
    if (error) throw error
    return ((data ?? []) as Array<{ id: string }>).map((event) => event.id)
  }

  private registrationEventSummary(event: Event): EventRegistrationEventSummary {
    return {
      id: event.id,
      title: event.title,
      category: event.category,
      date: event.date,
      location: event.location,
    }
  }

  private async attachRegistrationEvents(
    registrations: EventRegistration[],
  ): Promise<EventRegistrationWithEvent[]> {
    if (registrations.length === 0) return []

    const eventIds = [...new Set(registrations.map((registration) => registration.eventId))]
    const { data, error } = await supabase
      .from('events')
      .select('id,title,category,date,location')
      .in('id', eventIds)

    if (error) throw error

    const eventsById = new Map(
      ((data ?? []) as EventRegistrationEventSummary[]).map((event) => [event.id, event]),
    )

    return registrations.map((registration) => ({
      ...registration,
      event: eventsById.get(registration.eventId) ?? null,
    }))
  }

  async listRegistrations(query: EventRegistrationListQuery = {}) {
    const page = Math.max(1, query.page ?? 1)
    const perPage = Math.min(200, Math.max(1, query.perPage ?? 50))
    const eventIds = await this.getManageableEventIds(query.eventId)

    if (eventIds.length === 0) {
      return {
        data: [] as EventRegistrationWithEvent[],
        total: 0,
        meta: this.buildMeta(0, { page, perPage }),
      }
    }

    let q = supabase
      .from('event_registrations')
      .select('*', { count: 'exact' })
      .in('eventId', eventIds)

    if (query.status && query.status !== 'Semua') {
      q = q.eq('status', query.status)
    }

    const search = query.search?.trim().replace(/[%,()]/g, ' ').trim()
    if (search) {
      q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    q = q.order('createdAt', { ascending: false })

    const from = (page - 1) * perPage
    q = q.range(from, from + perPage - 1)

    const { data, error, count } = await q
    if (error) throw error

    const registrations = (data ?? []) as EventRegistration[]
    return {
      data: await this.attachRegistrationEvents(registrations),
      total: count ?? 0,
      meta: this.buildMeta(count ?? 0, { page, perPage }),
    }
  }

  async findRegistrationById(id: string): Promise<EventRegistrationWithEvent | null> {
    const { data, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    const registration = data as EventRegistration
    const event = await this.findEventById(registration.eventId)
    if (!event) return null
    if (event.category === 'LK1') {
      throw new AppError(LK1_REGISTRATION_MESSAGE, 400, 'LK1_REGISTRATION_SEPARATE')
    }

    return {
      ...registration,
      event: this.registrationEventSummary(event),
    }
  }

  async updateRegistrationStatus(
    id: string,
    status: EventRegistrationStatus,
  ): Promise<EventRegistrationWithEvent> {
    if (!REGISTRATION_STATUSES.includes(status)) {
      throw new AppError('Status pendaftaran tidak valid.', 422, 'VALIDATION_ERROR')
    }

    const existing = await this.findRegistrationById(id)
    if (!existing) throw new AppError('Pendaftaran agenda tidak ditemukan.', 404, 'NOT_FOUND')

    const { data, error } = await supabase
      .from('event_registrations')
      .update({ status })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) throw new AppError('Pendaftaran agenda tidak ditemukan.', 404, 'NOT_FOUND')

    return {
      ...(data as EventRegistration),
      event: existing.event,
    }
  }

  async deleteRegistration(id: string) {
    const existing = await this.findRegistrationById(id)
    if (!existing) throw new AppError('Pendaftaran agenda tidak ditemukan.', 404, 'NOT_FOUND')

    const { data, error } = await supabase
      .from('event_registrations')
      .delete()
      .eq('id', id)
      .select('id')

    if (error) throw error
    if (!data || data.length === 0) {
      throw new AppError('Pendaftaran agenda tidak ditemukan.', 404, 'NOT_FOUND')
    }

    return { message: 'Pendaftaran agenda berhasil dihapus' }
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