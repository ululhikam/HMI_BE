-- =============================================================================
-- HMI Insan Cita Database Schema for Supabase
-- Jalankan pada proyek Supabase Anda melalui `npm run migrate`.
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. ARTICLES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    excerpt TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Kegiatan', 'Opini', 'Press Release', 'Pengumuman')),
    author TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "authorAvatar" TEXT,
    "publishedAt" TIMESTAMPTZ,
    "updatedAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    "coverImage" TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    views INTEGER DEFAULT 0 NOT NULL,
    likes INTEGER DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('published', 'draft')),
    "readTime" TEXT,
    "isVideo" BOOLEAN DEFAULT FALSE,
    "videoDuration" TEXT,
    featured BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_articles_slug ON public.articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status ON public.articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON public.articles("publishedAt" DESC);

-- =============================================================================
-- 2. COMMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "articleId" UUID REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
    author TEXT NOT NULL,
    email TEXT,
    avatar TEXT,
    text TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_article_id ON public.comments("articleId");

-- =============================================================================
-- 3. ARTICLE LIKES & BOOKMARKS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.article_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_slug TEXT NOT NULL,
    user_id TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(article_slug, user_id)
);

CREATE TABLE IF NOT EXISTS public.article_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_slug TEXT NOT NULL,
    user_id TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(article_slug, user_id)
);

-- =============================================================================
-- 4. MEMBERS (PENGURUS & KADER)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    department TEXT NOT NULL,
    photo TEXT NOT NULL,
    period TEXT NOT NULL,
    email TEXT,
    instagram TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_members_department ON public.members(department);
CREATE INDEX IF NOT EXISTS idx_members_period ON public.members(period);

-- =============================================================================
-- 5. EVENTS & REGISTRATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ,
    location TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('LK1', 'LK2', 'Training', 'Baksos', 'Kajian', 'Rapat')),
    "coverImage" TEXT NOT NULL,
    status TEXT DEFAULT 'upcoming' NOT NULL CHECK (status IN ('upcoming', 'ongoing', 'done')),
    "registrationUrl" TEXT,
    speaker TEXT,
    "speakerRole" TEXT,
    "speakerAvatar" TEXT,
    "seatsLeft" INTEGER,
    "totalSeats" INTEGER,
    "isOnline" BOOLEAN DEFAULT FALSE,
    "meetingUrl" TEXT,
    rundown JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);

CREATE TABLE IF NOT EXISTS public.event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "eventId" UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'confirmed' NOT NULL CHECK (status IN ('confirmed', 'waitlist', 'cancelled')),
    "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_registrations_event ON public.event_registrations("eventId");

-- =============================================================================
-- 6. SPEAKERS, TESTIMONIALS & PAST HIGHLIGHTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.speakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    institution TEXT NOT NULL,
    avatar TEXT NOT NULL,
    topic TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    avatar TEXT NOT NULL,
    quote TEXT NOT NULL,
    color TEXT DEFAULT '#009246' NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.past_highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    year TEXT NOT NULL,
    url TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================================================
-- 7. LK1 APPLICATIONS (PENDAFTARAN BASIC TRAINING)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lk1_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "fullName" TEXT NOT NULL,
    nim TEXT NOT NULL,
    faculty TEXT NOT NULL,
    major TEXT NOT NULL,
    university TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    address TEXT NOT NULL,
    motivation TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    "submittedAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    "processedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lk1_status ON public.lk1_applications(status);

-- =============================================================================
-- 8. GALLERY
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.gallery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('photo', 'video')),
    url TEXT NOT NULL,
    thumbnail TEXT NOT NULL,
    event TEXT NOT NULL,
    date TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('LK1', 'LK2', 'Training', 'Baksos', 'Kajian', 'Rapat', 'Lainnya')),
    "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gallery_type ON public.gallery(type);
CREATE INDEX IF NOT EXISTS idx_gallery_category ON public.gallery(category);

-- =============================================================================
-- 9. CONTACT MESSAGES & NEWSLETTER
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new' NOT NULL CHECK (status IN ('new', 'read', 'replied')),
    "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    source TEXT DEFAULT 'website',
    "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================================================
-- 10. SITE SETTINGS & LIVE STREAMS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    "organizationName" TEXT NOT NULL,
    "organizationShortName" TEXT NOT NULL,
    "chapterName" TEXT NOT NULL,
    tagline TEXT NOT NULL,
    description TEXT NOT NULL,
    "logoUrl" TEXT NOT NULL,
    "secondaryLogoUrl" TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    website TEXT NOT NULL,
    socials JSONB DEFAULT '[]'::jsonb,
    "yearFounded" INTEGER NOT NULL DEFAULT 1947,
    "totalKomisariat" INTEGER NOT NULL DEFAULT 1,
    "totalAlumni" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.live_streams (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    "scheduledAt" TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('upcoming', 'live', 'scheduled')),
    speaker TEXT NOT NULL,
    "streamUrl" TEXT
);

CREATE TABLE IF NOT EXISTS public.site_pages (
    key TEXT PRIMARY KEY,
    content JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enable public read and write access for application operations
-- =============================================================================

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'articles', 'comments', 'article_likes', 'article_bookmarks',
        'members', 'events', 'event_registrations', 'speakers',
        'testimonials', 'past_highlights', 'lk1_applications',
        'gallery', 'contact_messages', 'newsletter_subscriptions',
        'site_settings', 'live_streams'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public select" ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY "Public select" ON public.%I FOR SELECT USING (true);', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public insert" ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY "Public insert" ON public.%I FOR INSERT WITH CHECK (true);', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public update" ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY "Public update" ON public.%I FOR UPDATE USING (true);', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public delete" ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY "Public delete" ON public.%I FOR DELETE USING (true);', tbl);
        EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated, service_role;', tbl);
    END LOOP;
END $$;

-- =============================================================================
-- INITIAL SEED DATA
-- =============================================================================

-- Site Settings (minimal baseline; contact/social values diisi lewat database)
INSERT INTO public.site_settings (
    id, "organizationName", "organizationShortName", "chapterName",
    tagline, description, "logoUrl", "secondaryLogoUrl", address, phone, email, website, socials,
    "yearFounded", "totalKomisariat", "totalAlumni"
) VALUES (
    1,
    'HMI Komisariat Insan Cita',
    'HMI',
    'Komisariat Insan Cita',
    'Yakin Usaha Sampai',
    'Himpunan Mahasiswa Islam — Menghimpun mahasiswa Islam, mencetak pemimpin bangsa berkarakter Insan Cita.',
    '/logo-komisariat.jpg',
    '/logo-hmi.jpg',
    '',
    '',
    '',
    '',
    '[]'::jsonb,
    1947,
    1,
    0
) ON CONFLICT (id) DO NOTHING;
