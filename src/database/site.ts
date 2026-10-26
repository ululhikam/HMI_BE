import { BaseRepository, supabase } from './base'
import { AppError } from '../middleware/error'
import type {
  AboutPageContent,
  DashboardStats,
  HomePageContent,
  OrgStats,
  SiteSettings,
  StreamingItem,
} from '../types'

type SitePageKey = 'home' | 'about'

export class SiteRepository extends BaseRepository {
  constructor() {
    super('site_settings')
  }

  async getSettings(): Promise<SiteSettings> {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      throw new AppError('Pengaturan situs belum tersedia', 404, 'NOT_FOUND')
    }
    return data as SiteSettings
  }

  async getStats(): Promise<OrgStats> {
    const [settings, kaderCount, eventsCount] = await Promise.all([
      this.getSettings().catch(() => null),
      supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .then((r) => r.count ?? 0),
      supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .then((r) => r.count ?? 0),
    ])

    return {
      totalKader: kaderCount,
      totalKomisariat: settings?.totalKomisariat ?? 0,
      totalAlumni: settings?.totalAlumni ?? 0,
      yearFounded: settings?.yearFounded ?? 0,
      totalEvents: eventsCount,
    }
  }

  private async getPage<T>(key: SitePageKey): Promise<T> {
    const { data, error } = await supabase
      .from('site_pages')
      .select('content')
      .eq('key', key)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      throw new AppError(`Konten halaman ${key} belum tersedia`, 404, 'NOT_FOUND')
    }
    return data.content as T
  }

  async getHome(): Promise<HomePageContent> {
    return this.getPage<HomePageContent>('home')
  }

  async getAbout(): Promise<AboutPageContent> {
    return this.getPage<AboutPageContent>('about')
  }

  async getLiveStreams(): Promise<StreamingItem[]> {
    const { data, error } = await supabase.from('live_streams').select('*')
    if (error) throw error
    return (data ?? []) as StreamingItem[]
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const [
      articlesTotal,
      articlesPublished,
      articlesDraft,
      eventsTotal,
      eventsUpcoming,
      eventsOngoing,
      eventsDone,
      applicantsTotal,
      applicantsPending,
      applicantsAccepted,
      galleryTotal,
      galleryPhotos,
      galleryVideos,
      membersTotal,
      messagesTotal,
      messagesNew,
      newslettersTotal,
      recentArticlesData,
      recentEventsData,
      recentApplicantsData,
      viewsData,
    ] = await Promise.all([
      supabase.from('articles').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0),
      supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published').then(r => r.count ?? 0),
      supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'draft').then(r => r.count ?? 0),
      supabase.from('events').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'upcoming').then(r => r.count ?? 0),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'ongoing').then(r => r.count ?? 0),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'done').then(r => r.count ?? 0),
      supabase.from('lk1_applications').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0),
      supabase.from('lk1_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending').then(r => r.count ?? 0),
      supabase.from('lk1_applications').select('*', { count: 'exact', head: true }).eq('status', 'accepted').then(r => r.count ?? 0),
      supabase.from('gallery').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0),
      supabase.from('gallery').select('*', { count: 'exact', head: true }).eq('type', 'photo').then(r => r.count ?? 0),
      supabase.from('gallery').select('*', { count: 'exact', head: true }).eq('type', 'video').then(r => r.count ?? 0),
      supabase.from('members').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0),
      supabase.from('contact_messages').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0),
      supabase.from('contact_messages').select('*', { count: 'exact', head: true }).eq('status', 'new').then(r => r.count ?? 0),
      supabase.from('newsletter_subscriptions').select('*', { count: 'exact', head: true }).then(r => r.count ?? 0),
      supabase.from('articles').select('*').order('publishedAt', { ascending: false }).limit(5),
      supabase.from('events').select('*').order('date', { ascending: false }).limit(5),
      supabase.from('lk1_applications').select('*').order('submittedAt', { ascending: false }).limit(5),
      supabase.from('articles').select('views'),
    ])

    const totalViews = (viewsData.data ?? []).reduce((acc: number, item: any) => acc + (item.views || 0), 0)

    return {
      totalArticles: articlesTotal,
      publishedArticles: articlesPublished,
      draftArticles: articlesDraft,
      totalViews,
      totalApplicants: applicantsTotal,
      pendingApplicants: applicantsPending,
      acceptedApplicants: applicantsAccepted,
      totalGalleryItems: galleryTotal,
      totalPhotos: galleryPhotos,
      totalVideos: galleryVideos,
      totalMembers: membersTotal,
      totalEvents: eventsTotal,
      upcomingEvents: eventsUpcoming,
      ongoingEvents: eventsOngoing,
      doneEvents: eventsDone,
      totalMessages: messagesTotal,
      newMessages: messagesNew,
      totalNewsletters: newslettersTotal,
      recentArticles: (recentArticlesData.data ?? []) as any[],
      recentEvents: (recentEventsData.data ?? []) as any[],
      recentApplicants: (recentApplicantsData.data ?? []) as any[],
    }
  }
}
