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
-- 6. TESTIMONIALS & PAST HIGHLIGHTS
-- =============================================================================
-- Tabel speakers lama tidak dipakai lagi. Narasumber kini melekat langsung
-- pada masing-masing agenda melalui kolom events.speaker/speakerRole.
DROP TABLE IF EXISTS public.speakers CASCADE;

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
        'members', 'events', 'event_registrations',
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

-- Pastikan kolom statistik tersedia pada database yang sudah ada.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS "yearFounded" INTEGER NOT NULL DEFAULT 1947,
  ADD COLUMN IF NOT EXISTS "totalKomisariat" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "totalAlumni" INTEGER NOT NULL DEFAULT 0;

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
-- =============================================================================
-- Site pages (CMS content) + organisation stats
-- =============================================================================

-- Statistik organisasi disimpan di database agar tidak di-hardcode di kode.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS "yearFounded" INTEGER NOT NULL DEFAULT 1947,
  ADD COLUMN IF NOT EXISTS "totalKomisariat" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "totalAlumni" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.site_pages (
  key TEXT PRIMARY KEY,
  content JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read site pages" ON public.site_pages;
CREATE POLICY "Public read site pages"
  ON public.site_pages FOR SELECT
  USING (true);

GRANT SELECT ON public.site_pages TO anon, authenticated;
GRANT ALL ON public.site_pages TO service_role;

-- Konten awal halaman. Nilai ini adalah konten CMS yang dapat diubah
-- langsung di database tanpa mengubah kode aplikasi.
INSERT INTO public.site_pages (key, content)
VALUES
  (
    'home',
    $json$
    {
      "hero": {
        "backgroundImage": "",
        "eyebrow": "Himpunan Mahasiswa Islam",
        "title": "HMI Komisariat Insan Cita",
        "tagline": "Yakin Usaha Sampai — Mencetak Kader Beriman, Berilmu, dan Beramal untuk Indonesia",
        "description": "Portal resmi HMI Komisariat Insan Cita: informasi perkaderan, agenda, berita, dan pengabdian kader."
      },
      "about": {
        "imageUrl": "",
        "badge": "Est. 1947",
        "sectionLabel": "Tentang Kami",
        "title": "HMI Insan Cita —",
        "highlight": "Organisasi Kemahasiswaan Islam Terbesar",
        "paragraphs": [
          "Himpunan Mahasiswa Islam (HMI) didirikan oleh Lafran Pane pada 5 Februari 1947 di Yogyakarta. Sebagai organisasi kemahasiswaan Islam tertua dan terbesar di Indonesia, HMI telah melahirkan ribuan kader pemimpin bangsa yang berkontribusi di berbagai bidang kehidupan.",
          "HMI Insan Cita hadir sebagai representasi gerakan kaderisasi yang terstruktur, berbasis Nilai Dasar Perjuangan (NDP), dan berkomitmen mencetak generasi Indonesia yang beriman, berilmu, dan beramal untuk kemashlahatan umat."
        ]
      },
      "vision": {
        "quote": "Terbinanya insan akademis, pencipta, pengabdi yang bernafaskan Islam dan bertanggung jawab atas terwujudnya masyarakat adil dan makmur yang diridhoi Allah SWT.",
        "description": "Visi HMI bukan sekadar pernyataan — ini adalah kompas yang mengarahkan setiap langkah kaderisasi, advokasi, dan pengabdian kader HMI di seluruh penjuru Indonesia. Setiap program dan kegiatan dirancang untuk mewujudkan manusia seutuhnya yang berkontribusi pada peradaban bangsa.",
        "photos": []
      },
      "mission": {
        "intro": "HMI hadir untuk menghimpun dan membina mahasiswa Islam Indonesia agar menjadi insan yang beriman, berilmu, dan beramal. Misi organisasi mencakup empat pilar utama yang saling menguatkan:",
        "pillars": [
          {
            "title": "Pendalaman Nilai Islam",
            "description": "Membangun landasan aqidah yang kokoh melalui kajian NDP dan pemahaman Islam yang komprehensif."
          },
          {
            "title": "Pengembangan Intelektual",
            "description": "Mendorong tradisi berpikir kritis, ilmiah, dan bertanggung jawab dalam menghadapi persoalan bangsa."
          },
          {
            "title": "Pengabdian Masyarakat",
            "description": "Aksi nyata kader HMI untuk kemashlahatan umat melalui program sosial dan advokasi kebijakan publik."
          },
          {
            "title": "Pembangunan Karakter",
            "description": "Membentuk pemimpin yang berintegritas, amanah, dan mampu berkontribusi pada kemajuan Indonesia."
          }
        ]
      },
      "activities": [],
      "committees": [
        { "name": "Bid. Pembinaan Anggota", "abbreviation": "PA", "color": "#009246" },
        { "name": "Bid. Intelektual", "abbreviation": "PI", "color": "#006837" },
        { "name": "Bid. Kewirausahaan", "abbreviation": "BK", "color": "#014421" },
        { "name": "Bid. Sosial & Pol.", "abbreviation": "SP", "color": "#009246" },
        { "name": "KOHATI", "abbreviation": "KT", "color": "#006837" },
        { "name": "Bid. Komunikasi", "abbreviation": "KM", "color": "#014421" }
      ],
      "galleryPreview": []
    }
    $json$::jsonb
  ),
  (
    'about',
    $json$
    {
      "hero": {
        "badge": "Mengenal HMI",
        "title": "Tentang",
        "highlight": "HMI Komisariat Insan Cita",
        "description": "Berdiri sejak 1947, HMI adalah organisasi kemahasiswaan Islam terbesar di Indonesia yang telah melahirkan ribuan pemimpin bangsa."
      },
      "history": {
        "heading": "Sejarah Panjang Perjuangan",
        "paragraphs": [
          "HMI didirikan oleh Lafran Pane pada tanggal 5 Februari 1947 di Universitas Islam Indonesia (UII), Yogyakarta. Lahir di masa perjuangan kemerdekaan, HMI sejak awal hadir sebagai kekuatan moral mahasiswa Islam yang berkomitmen pada agama, bangsa, dan negara.",
          "Selama lebih dari tujuh dekade, HMI telah melahirkan ribuan pemimpin bangsa yang berkiprah di berbagai bidang — mulai dari politik, akademik, militer, hingga wirausaha."
        ],
        "quote": "\"Yakin Usaha Sampai\" — moto yang mencerminkan semangat pantang menyerah setiap kader HMI.",
        "imageUrl": "",
        "sinceBadge": "Berdiri sejak 1947"
      },
      "timeline": [
        { "year": "1947", "event": "HMI didirikan oleh Lafran Pane di Yogyakarta pada 5 Februari 1947." },
        { "year": "1966", "event": "HMI memainkan peran strategis dalam peristiwa G30S dan transisi kepemimpinan nasional." },
        { "year": "1985", "event": "Asas tunggal Pancasila diadopsi, uji kedewasaan organisasi di tengah tekanan Orde Baru." },
        { "year": "1998", "event": "Kader HMI aktif berperan dalam gerakan Reformasi dan demokratisasi Indonesia." },
        { "year": "2010", "event": "Ekspansi komisariat ke seluruh penjuru Indonesia, lebih dari 200 cabang aktif." },
        { "year": "2024", "event": "HMI Insan Cita terus mencetak kader berkualitas menyongsong Indonesia Emas 2045." }
      ],
      "ndp": {
        "title": "Nilai-Nilai Dasar Perjuangan",
        "description": "NDP HMI adalah landasan filosofis dan ideologis yang menjadi kompas perjuangan setiap kader HMI. Disusun dari sintesis nilai-nilai Islam dan kebangsaan Indonesia.",
        "points": [
          { "number": "I", "title": "Dasar Aqidah", "description": "Keimanan kepada Allah SWT sebagai fondasi utama kehidupan." },
          { "number": "II", "title": "Kemanusiaan", "description": "Menghargai harkat dan martabat manusia tanpa diskriminasi." },
          { "number": "III", "title": "Intelektualisme", "description": "Menjunjung tinggi akal dan ilmu dalam setiap tindakan." },
          { "number": "IV", "title": "Kemasyarakatan", "description": "Berdedikasi untuk kesejahteraan umat dan bangsa." }
        ],
        "quote": "\"NDP bukan sekadar naskah — ia adalah jiwa yang mengalir dalam setiap gerak langkah kader HMI untuk mewujudkan masyarakat yang diridhoi Allah SWT.\"",
        "quoteAuthor": "— Lafran Pane, Pendiri HMI"
      }
    }
    $json$::jsonb
  )
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- ADMIN USERS
-- Profil dan otorisasi admin. Kredensial tetap dikelola Supabase Auth
-- (auth.users); tabel ini tidak menyimpan password.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin')),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users("isActive");

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages admin users" ON public.admin_users;
CREATE POLICY "Service role manages admin users"
    ON public.admin_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

REVOKE ALL ON public.admin_users FROM anon, authenticated;
GRANT ALL ON public.admin_users TO service_role;

-- Backfill akun admin yang sudah ada di Supabase Auth.
INSERT INTO public.admin_users (id, email, name, role, "createdAt", "updatedAt")
SELECT
    u.id,
    u.email,
    COALESCE(
        u.raw_user_meta_data->>'name',
        u.raw_user_meta_data->>'full_name',
        split_part(u.email, '@', 1)
    ),
    CASE
        WHEN u.raw_app_meta_data->>'role' = 'superadmin' THEN 'superadmin'
        ELSE 'admin'
    END,
    COALESCE(u.created_at, now()),
    now()
FROM auth.users u
WHERE u.email IS NOT NULL
  AND COALESCE(u.raw_app_meta_data->>'role', '') IN ('admin', 'superadmin')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    "updatedAt" = now();
