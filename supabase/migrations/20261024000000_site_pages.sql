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
