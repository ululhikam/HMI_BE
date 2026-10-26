import { BaseRepository, supabase } from './base'
import { AppError } from '../middleware/error'
import type { CommentInput } from '../types'

export class CommentRepository extends BaseRepository {
  constructor() {
    super('comments')
  }

  async listByArticleSlug(slug: string, page = 1, perPage = 50) {
    // First get article ID from slug
    const { data: article } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!article) throw new AppError('Artikel tidak ditemukan', 404, 'NOT_FOUND')

    const from = (page - 1) * perPage
    const to = from + perPage - 1

    const { data, error, count } = await supabase
      .from('comments')
      .select('*', { count: 'exact' })
      .eq('articleId', article.id)
      .order('createdAt', { ascending: false })
      .range(from, to)

    if (error) throw error
    return {
      data: data ?? [],
      total: count ?? 0,
      meta: this.buildMeta(count ?? 0, { page, perPage }),
    }
  }

  async createComment(slug: string, input: CommentInput) {
    // Get article ID from slug
    const { data: article } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!article) throw new AppError('Artikel tidak ditemukan', 404, 'NOT_FOUND')

    const record = {
      articleId: article.id,
      author: input.author,
      email: input.email || null,
      text: input.text,
      createdAt: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('comments')
      .insert([record])
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteComment(id: string) {
    const { data, error } = await supabase.from('comments').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data || data.length === 0) {
      throw new AppError('Komentar tidak ditemukan', 404, 'NOT_FOUND')
    }
    return { message: 'Komentar berhasil dihapus' }
  }
}

export const commentRepository = new CommentRepository()
