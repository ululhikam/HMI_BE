import { BaseRepository, supabase } from './base'
import { AppError } from '../middleware/error'
import type { GalleryCategory, GalleryItem, GalleryItemInput } from '../types'

export interface GalleryListQuery {
  page?: number
  perPage?: number
  category?: GalleryCategory | 'Semua'
  type?: 'photo' | 'video'
  search?: string
}

export class GalleryRepository extends BaseRepository {
  constructor() {
    super('gallery')
  }

  async list(query: GalleryListQuery = {}) {
    const page = query.page ?? 1
    const perPage = query.perPage ?? 20

    let q = supabase.from('gallery').select('*', { count: 'exact' })

    if (query.category && query.category !== 'Semua') {
      q = q.eq('category', query.category)
    }

    if (query.type) {
      q = q.eq('type', query.type)
    }

    if (query.search) {
      q = q.or(`title.ilike.%${query.search}%,event.ilike.%${query.search}%`)
    }

    q = q.order('date', { ascending: false })

    const from = (page - 1) * perPage
    const to = from + perPage - 1
    q = q.range(from, to)

    const { data, error, count } = await q
    if (error) throw error

    return {
      data: (data ?? []) as GalleryItem[],
      total: count ?? 0,
      meta: this.buildMeta(count ?? 0, { page, perPage }),
    }
  }

  async findGalleryById(id: string): Promise<GalleryItem | null> {
    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data as GalleryItem | null
  }

  async createGallery(input: GalleryItemInput): Promise<GalleryItem> {
    const record = {
      ...input,
      date: (input as any).date || new Date().toISOString().split('T')[0],
      thumbnail: input.thumbnail || input.url,
    }

    const { data, error } = await supabase
      .from('gallery')
      .insert([record])
      .select()
      .single()

    if (error) throw error
    return data as GalleryItem
  }

  async updateGallery(id: string, input: Partial<GalleryItemInput>): Promise<GalleryItem> {
    const { data, error } = await supabase
      .from('gallery')
      .update(input)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) throw new AppError('Item galeri tidak ditemukan', 404, 'NOT_FOUND')
    return data as GalleryItem
  }

  async deleteGallery(id: string) {
    const { data, error } = await supabase.from('gallery').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data || data.length === 0) {
      throw new AppError('Item galeri tidak ditemukan', 404, 'NOT_FOUND')
    }
    return { message: 'Item galeri berhasil dihapus' }
  }
}