// ─────────────────────────────────────────────────────────────
// Domain types — mirrored from frontend/src/types/index.ts
// Keep aligned with apicontract.yaml at the repo root.
// ─────────────────────────────────────────────────────────────

// Article / Berita
export type ArticleCategory = 'Kegiatan' | 'Opini' | 'Press Release' | 'Pengumuman'
export type ArticleStatus = 'published' | 'draft'

export interface Article {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  category: ArticleCategory
  author: string
  authorRole: string
  authorAvatar?: string
  publishedAt: string
  updatedAt: string
  coverImage: string
  tags: string[]
  views: number
  status: ArticleStatus
  readTime?: string
  isVideo?: boolean
  videoDuration?: string
  likes?: number
}

export interface ArticleInput {
  title: string
  slug?: string
  excerpt: string
  content: string
  category: ArticleCategory
  author: string
  authorRole: string
  authorAvatar?: string
  coverImage: string
  tags: string[]
  status: ArticleStatus
  readTime?: string
  publishedAt?: string
  isVideo?: boolean
  videoDuration?: string
}

// Komentar artikel
export interface Comment {
  id: string
  articleId: string
  author: string
  email?: string
  avatar?: string
  text: string
  createdAt: string
}

export interface CommentInput {
  author: string
  email?: string
  text: string
}

// Anggota Pengurus / BPH
export interface Member {
  id: string
  name: string
  position: string
  department: string
  photo: string
  period: string
  email?: string
  instagram?: string
}

export interface MemberInput {
  name: string
  position: string
  department: string
  photo: string
  period: string
  email?: string
  instagram?: string
}

// Event / Kegiatan
export type EventCategory = 'LK1' | 'LK2' | 'Training' | 'Baksos' | 'Kajian' | 'Rapat'
export type EventStatus = 'upcoming' | 'ongoing' | 'done'

export interface Event {
  id: string
  title: string
  description: string
  date: string
  endDate?: string
  location: string
  category: EventCategory
  coverImage: string
  status: EventStatus
  registrationUrl?: string
  speaker?: string
  speakerRole?: string
  speakerAvatar?: string
  seatsLeft?: number
  totalSeats?: number
  isOnline?: boolean
  meetingUrl?: string
  rundown?: { time: string; activity: string }[]
}

export interface EventRegistrationInput {
  name: string
  email: string
  phone?: string
}

export interface EventRegistration {
  id: string
  eventId: string
  name: string
  email: string
  phone?: string
  status: 'confirmed' | 'waitlist' | 'cancelled'
  createdAt: string
}

export interface EventSummary {
  speakers: number
  participants: number
  sessions: number
  alumni: number
}

export interface Speaker {
  id: string
  name: string
  role: string
  institution: string
  avatar: string
  topic: string
}

export interface PastEventPhoto {
  id: string
  title: string
  year: string
  url: string
}

export interface Testimonial {
  id: string
  name: string
  role: string
  avatar: string
  quote: string
  color: string
}

// Galeri
export type GalleryCategory = 'LK1' | 'LK2' | 'Training' | 'Baksos' | 'Kajian' | 'Rapat' | 'Lainnya'

export interface GalleryItem {
  id: string
  title: string
  type: 'photo' | 'video'
  url: string
  thumbnail: string
  event: string
  date: string
  category: GalleryCategory
}

export interface GalleryItemInput {
  title: string
  type: 'photo' | 'video'
  url: string
  thumbnail?: string
  event: string
  date: string
  category: GalleryCategory
}

// Pendaftar LK 1
export type ApplicantStatus = 'pending' | 'accepted' | 'rejected'

export interface LK1Applicant {
  id: string
  fullName: string
  nim: string
  faculty: string
  major: string
  university: string
  phone: string
  email: string
  address: string
  motivation: string
  submittedAt: string
  status: ApplicantStatus
}

export interface LK1ApplicationInput {
  fullName: string
  nim: string
  faculty: string
  major: string
  university: string
  phone: string
  email: string
  address: string
  motivation: string
}

export interface ApplicantStats {
  total: number
  pending: number
  accepted: number
  rejected: number
}

// User Admin
export type UserRole = 'superadmin' | 'admin' | 'kader'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  createdAt: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface AuthSession {
  user: User
  accessToken: string
  refreshToken?: string
  tokenType: 'Bearer'
  expiresAt: string
}

// Kontak & newsletter
export interface ContactMessageInput {
  name: string
  email: string
  subject: string
  message: string
}

export interface ContactMessage extends ContactMessageInput {
  id: string
  status: 'new' | 'read' | 'replied'
  createdAt: string
}

export interface NewsletterSubscription {
  id: string
  email: string
  source?: string
  createdAt: string
}

// Statistik Organisasi
export interface OrgStats {
  totalKader: number
  totalKomisariat: number
  totalAlumni: number
  yearFounded: number
  totalEvents: number
}


// Site Content
export interface SocialLink {
  platform: 'instagram' | 'facebook' | 'twitter' | 'youtube' | 'tiktok'
  label: string
  url: string
}

export interface SiteSettings {
  organizationName: string
  organizationShortName: string
  chapterName: string
  tagline: string
  description: string
  logoUrl: string
  secondaryLogoUrl: string
  address: string
  phone: string
  email: string
  website: string
  socials: SocialLink[]
  yearFounded?: number
  totalKomisariat?: number
  totalAlumni?: number
}

export interface Activity {
  title: string
  description: string
  image: string
  category: string
}

export interface Committee {
  name: string
  abbreviation: string
  color: string
}

export interface MissionPillar {
  title: string
  description: string
}

export interface HomePageContent {
  hero: {
    backgroundImage: string
    eyebrow: string
    title: string
    tagline: string
    description: string
  }
  about: {
    imageUrl: string
    badge: string
    sectionLabel: string
    title: string
    highlight: string
    paragraphs: string[]
  }
  vision: {
    quote: string
    description: string
    photos: string[]
  }
  mission: {
    intro: string
    pillars: MissionPillar[]
  }
  activities: Activity[]
  committees: Committee[]
  galleryPreview: string[]
}

export interface TimelineItem {
  year: string
  event: string
}

export interface NdpPoint {
  number: string
  title: string
  description: string
}

export interface AboutPageContent {
  hero: {
    badge: string
    title: string
    highlight: string
    description: string
  }
  history: {
    heading: string
    paragraphs: string[]
    quote: string
    imageUrl: string
    sinceBadge: string
  }
  timeline: TimelineItem[]
  ndp: {
    title: string
    description: string
    points: NdpPoint[]
    quote: string
    quoteAuthor: string
  }
}

export interface StreamingItem {
  id: string
  title: string
  scheduledAt: string
  status: 'upcoming' | 'live' | 'scheduled'
  speaker: string
  streamUrl?: string
}

// Dashboard admin
export interface DashboardStats {
  totalArticles: number
  publishedArticles: number
  draftArticles: number
  totalViews: number
  totalApplicants: number
  pendingApplicants: number
  acceptedApplicants: number
  totalGalleryItems: number
  totalPhotos: number
  totalVideos: number
  totalMembers: number
  totalEvents: number
  upcomingEvents: number
  ongoingEvents: number
  doneEvents: number
  totalMessages: number
  newMessages: number
  totalNewsletters: number
  recentArticles: Article[]
  recentEvents: Event[]
  recentApplicants: any[]
}

// API envelope types
export interface PaginationMeta {
  page: number
  perPage: number
  total: number
  totalPages: number
}

export interface ApiEnvelope<T> {
  success: true
  data: T
  meta?: PaginationMeta
}

export interface ApiErrorPayload {
  code: string
  message: string
  details?: unknown
}
