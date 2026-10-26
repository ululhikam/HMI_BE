import { BaseRepository, supabase } from './base'
import { AppError } from '../middleware/error'
import type { ArticleInput } from '../types'
import slugify from 'slugify'

export class ArticleRepository extends BaseRepository {
  constructor() {
    super('articles')
  }

  /** List articles with filters matching frontend ArticleListQuery */
  async list(query: {
    page?: number
    perPage?: number
    category?: string
    tag?: string
    search?: string
    status?: string
    sort?: string
    featured?: boolean
  }) {
    const page = query.page ?? 1
    const perPage = query.perPage ?? 20

    let q = supabase.from('articles').select('*', { count: 'exact' })

    // Status filter
    if (query.status && query.status !== 'all') {
      q = q.eq('status', query.status)
    }

    // Category filter
    if (query.category) {
      q = q.eq('category', query.category)
    }

    // Tag filter
    if (query.tag) {
      q = q.contains('tags', [query.tag])
    }

    // Search filter
    if (query.search) {
      q = q.or(`title.ilike.%${query.search}%,excerpt.ilike.%${query.search}%`)
    }

    // Featured filter
    if (query.featured) {
      q = q.eq('featured', true)
    }

    // Sorting
    if (query.sort === 'popular') {
      q = q.order('views', { ascending: false })
    } else {
      q = q.order('publishedAt', { ascending: false })
    }

    // Pagination
    const from = (page - 1) * perPage
    const to = from + perPage - 1
    q = q.range(from, to)

    const { data, error, count } = await q
    if (error) throw error

    return {
      data: data ?? [],
      total: count ?? 0,
      meta: this.buildMeta(count ?? 0, { page, perPage }),
    }
  }

  async findBySlug(slug: string) {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()

    if (error) throw error
    return data
  }

  async findByIdSingle(id: string) {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data
  }

  async createArticle(input: ArticleInput) {
    const slug = input.slug || slugify(input.title, { lower: true, strict: true })
    const now = new Date().toISOString()

    const record = {
      ...input,
      slug,
      views: 0,
      likes: 0,
      publishedAt: input.publishedAt || (input.status === 'published' ? now : null),
      updatedAt: now,
      createdAt: now,
    }

    const { data, error } = await supabase
      .from('articles')
      .insert([record])
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateArticle(id: string, input: Partial<ArticleInput>) {
    const record = {
      ...input,
      updatedAt: new Date().toISOString(),
    }

    if (input.title && !input.slug) {
      (record as any).slug = slugify(input.title, { lower: true, strict: true })
    }

    // Tetapkan tanggal publikasi saat artikel pertama kali dipublikasikan.
    if (input.status === 'published' && !input.publishedAt) {
      const existing = await this.findByIdSingle(id)
      if (existing && !existing.publishedAt) {
        Object.assign(record, { publishedAt: new Date().toISOString() })
      }
    }

    const { data, error } = await supabase
      .from('articles')
      .update(record)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) throw new AppError('Artikel tidak ditemukan', 404, 'NOT_FOUND')
    return data
  }

  async updateArticleBySlug(slug: string, input: Partial<ArticleInput>) {
    const record = {
      ...input,
      updatedAt: new Date().toISOString(),
    }

    if (input.title && !input.slug) {
      (record as any).slug = slugify(input.title, { lower: true, strict: true })
    }

    // Tetapkan tanggal publikasi saat artikel pertama kali dipublikasikan.
    if (input.status === 'published' && !input.publishedAt) {
      const existing = await this.findBySlug(slug)
      if (existing && !existing.publishedAt) {
        Object.assign(record, { publishedAt: new Date().toISOString() })
      }
    }

    const { data, error } = await supabase
      .from('articles')
      .update(record)
      .eq('slug', slug)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) throw new AppError('Artikel tidak ditemukan', 404, 'NOT_FOUND')
    return data
  }

  async deleteArticle(id: string) {
    const { data, error } = await supabase.from('articles').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data || data.length === 0) {
      throw new AppError('Artikel tidak ditemukan', 404, 'NOT_FOUND')
    }
    return { message: 'Artikel berhasil dihapus' }
  }

  async deleteArticleBySlug(slug: string) {
    const { data, error } = await supabase.from('articles').delete().eq('slug', slug).select('id')
    if (error) throw error
    if (!data || data.length === 0) {
      throw new AppError('Artikel tidak ditemukan', 404, 'NOT_FOUND')
    }
    return { message: 'Artikel berhasil dihapus' }
  }

  async likeArticle(slug: string, userId: string) {
    const article = await this.findBySlug(slug)
    if (!article) throw new AppError('Artikel tidak ditemukan', 404, 'NOT_FOUND')

    const { data: existing } = await supabase
      .from('article_likes')
      .select('id')
      .eq('article_slug', slug)
      .eq('user_id', userId)
      .maybeSingle()

    // Idempotent: klik like berulang tidak mengurangi jumlah like.
    if (existing) return { likes: article.likes ?? 0, liked: true }

    const { error: insertError } = await supabase
      .from('article_likes')
      .insert([{ article_slug: slug, user_id: userId }])
    if (insertError) throw insertError

    const newLikes = (article.likes || 0) + 1
    const { error: updateError } = await supabase
      .from('articles')
      .update({ likes: newLikes })
      .eq('slug', slug)
    if (updateError) throw updateError

    return { likes: newLikes, liked: true }
  }

  async unlikeArticle(slug: string, userId: string) {
    const { data: existing } = await supabase
      .from('article_likes')
      .select('id')
      .eq('article_slug', slug)
      .eq('user_id', userId)
      .maybeSingle()

    const article = await this.findBySlug(slug)
    if (!article) throw new AppError('Artikel tidak ditemukan', 404, 'NOT_FOUND')

    if (!existing) return { likes: article.likes ?? 0, liked: false }

    await supabase.from('article_likes').delete().eq('id', existing.id)

    const newLikes = Math.max(0, (article.likes || 0) - 1)
    await supabase.from('articles').update({ likes: newLikes }).eq('slug', slug)

    return { likes: newLikes, liked: false }
  }

  async incrementViews(slug: string) {
    const article = await this.findBySlug(slug)
    if (!article) throw new AppError('Artikel tidak ditemukan', 404, 'NOT_FOUND')

    const { data, error } = await supabase
      .from('articles')
      .update({ views: (article.views || 0) + 1 })
      .eq('slug', slug)
      .select('views')
      .single()

    if (error) throw error
    return { views: data.views }
  }

  async bookmarkArticle(slug: string, userId: string) {
    const { data: existing } = await supabase
      .from('article_bookmarks')
      .select('*')
      .eq('article_slug', slug)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) return { bookmarked: true }

    await supabase.from('article_bookmarks').insert([{ article_slug: slug, user_id: userId }])
    return { bookmarked: true }
  }

  async unbookmarkArticle(slug: string, userId: string) {
    await supabase
      .from('article_bookmarks')
      .delete()
      .eq('article_slug', slug)
      .eq('user_id', userId)

    return { bookmarked: false }
  }

  /** Get recent articles for dashboard */
  async getRecentArticles(limit = 5) {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data ?? []
  }
}

export const articleRepository = new ArticleRepository()