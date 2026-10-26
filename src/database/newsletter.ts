import { BaseRepository, supabase } from './base'
import type { NewsletterSubscription } from '../types'

export class NewsletterRepository extends BaseRepository {
  constructor() {
    super('newsletter_subscriptions')
  }

  async subscribe(input: { email: string; source?: string }): Promise<NewsletterSubscription> {
    const record = {
      email: input.email.trim().toLowerCase(),
      source: input.source || 'website',
      createdAt: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .upsert([record], { onConflict: 'email' })
      .select()
      .single()

    if (error) throw error
    return data as NewsletterSubscription
  }
}
