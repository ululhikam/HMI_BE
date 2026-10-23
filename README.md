# HMI Backend API

REST API untuk website HMI Komisariat Insan Cita. Dibangun dengan TypeScript, Express, dan Supabase (PostgreSQL + Auth).

Kontrak lengkap ada di [`../apicontract.yaml`](../apicontract.yaml). Dokumen ini fokus pada cara menjalankan dan merawat backend.

## Struktur

```text
backend/
├── src/
│   ├── config/supabase.ts    # Klien Supabase
│   ├── database/             # Repository per entitas
│   ├── middleware/           # authMiddleware, errorHandler
│   ├── scripts/              # migrate, create-admin, verify-db
│   ├── types/                # Tipe domain
│   └── index.ts              # Entry point & semua route
├── supabase/migrations/      # Riwayat migrasi
├── schema.sql                # Skema lengkap
├── .env.example
└── package.json
```

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Isi environment sesuai proyek Supabase Anda:

```env
PORT=3001
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>

# Pilih salah satu koneksi database:
DB_HOST=aws-0-<region>.pooler.supabase.com
DB_USER=postgres.<project-ref>
DB_PASSWORD=<password>
DB_NAME=postgres
# DATABASE_URL=postgresql://...

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<minimal-8-karakter>
ADMIN_NAME=Administrator
```

Catatan:

- `SUPABASE_SERVICE_ROLE_KEY` opsional. Jika diisi, backend memakainya untuk operasi database. Key ini tidak boleh dikirim ke frontend.
- `DB_HOST`, `DB_USER`, dan `DB_PASSWORD` hanya dipakai oleh script (`migrate`, `create-admin`). API runtime memakai Supabase client.
- `PUBLIC_BASE_URL` opsional, dipakai untuk membentuk URL absolut file upload. Jika kosong, URL diambil dari request.

## Menyiapkan database & admin

```bash
npm run migrate       # menjalankan schema.sql
npm run create-admin  # membuat/memperbarui akun Supabase Auth
npm run verify-db     # memeriksa koneksi dan tabel
```

`create-admin` bersifat idempotent: jika email sudah ada, password dan metadata admin diperbarui. Tidak ada kredensial admin yang ditulis di source code.

## Menjalankan server

```bash
# development
npm run dev

# production
npm run build
npm start
```

Default: `http://localhost:3001`.

Cek kesehatan:

```bash
curl http://localhost:3001/health
```

## Autentikasi

- Login: `POST /auth/login` dengan `{ "email", "password" }`.
- Backend memvalidasi kredensial melalui `supabase.auth.signInWithPassword`.
- Hanya user dengan `app_metadata.role` bernilai `admin` atau `superadmin` yang diizinkan masuk. Role dibaca dari metadata server, bukan metadata yang dapat diubah user.
- `npm run create-admin` menulis role `superadmin` ke `app_metadata`.
- Response login berisi `user`, `accessToken`, `refreshToken`, `tokenType`, dan `expiresAt`.
- Route terproteksi memerlukan header `Authorization: Bearer <accessToken>`.
- Token divalidasi ulang ke Supabase Auth pada setiap request melalui `authMiddleware`.
- Refresh: `POST /auth/refresh` dengan `{ "refreshToken" }`.
- Logout: `POST /auth/logout` (frontend menghapus sesi lokal).
- Profil sesi: `GET /auth/me`.

## Route utama

| Grup | Endpoint |
| --- | --- |
| Health | `GET /health` |
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/refresh` |
| Artikel | `GET/POST /articles`, `GET /articles/:slug`, `GET/PATCH/DELETE /articles/id/:id`, `PATCH/DELETE /articles/:slug` |
| Interaksi artikel | `POST /articles/:slug/views`, `POST/DELETE /articles/:slug/like`, `POST/DELETE /articles/:slug/bookmark` |
| Komentar | `GET/POST /articles/:slug/comments`, `DELETE /comments/:id` |
| Pengurus | `GET/POST /members`, `GET/PATCH/DELETE /members/:id` |
| Agenda | `GET/POST /events`, `GET/PATCH/DELETE /events/:id`, `GET /events/summary`, `GET /events/featured`, `GET /events/past-highlights`, `POST /events/:id/registrations` |
| Narasumber & testimoni | `GET /speakers`, `GET /testimonials` |
| Pendaftar LK 1 | `GET/POST /lk1-applications`, `GET/PATCH /lk1-applications/:id`, `GET /lk1-applications/stats` |
| Galeri | `GET/POST /gallery`, `GET/PATCH/DELETE /gallery/:id` |
| Kontak | `POST /contact-messages`, `GET /contact-messages`, `GET /contact-messages/new` |
| Newsletter | `POST /newsletter/subscribe`, `GET /newsletter` |
| Konten situs | `GET /site/settings`, `GET /site/stats`, `GET /site/home`, `GET /site/about`, `GET /site/live-streams` |
| Dashboard | `GET /admin/dashboard` |
| Upload | `POST /upload` |

Detail body, query, dan response ada di `apicontract.yaml`.

## Upload media

`POST /upload` memerlukan autentikasi dan menerima JSON:

```json
{ "data": "data:image/png;base64,...", "filename": "foto.png" }
```

Aturan:

- Hanya `image/png`, `image/jpeg`, `image/jpg`, `image/webp`, `image/gif`.
- Ukuran maksimal 5 MB setelah decode.
- Nama file dibersihkan dan diberi prefix timestamp.
- Response: `{ url, filename, size }`.
- File disimpan di `uploads/` dan disajikan lewat `GET /uploads/<filename>`.
- URL `http(s)://...` dapat dikirim langsung dan akan dikembalikan apa adanya.

Gunakan volume persisten saat deploy, atau ganti implementasi ke object storage.

## Format response & error

Sukses:

```json
{ "success": true, "data": {} }
```

Dengan paginasi:

```json
{ "success": true, "data": [], "meta": { "page": 1, "perPage": 20, "total": 0, "totalPages": 0 } }
```

Gagal:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

Error handler memetakan beberapa kode PostgreSQL/Supabase:

- `PGRST116` → `404 NOT_FOUND`
- `22P02` → `400 VALIDATION_ERROR`
- Error tak terduga → `500 INTERNAL_ERROR`

## Data & migrasi

- `schema.sql` adalah skema lengkap dan aman dijalankan berulang (`CREATE TABLE IF NOT EXISTS`, seed `ON CONFLICT DO NOTHING`).
- `supabase/migrations/` menyimpan riwayat perubahan. Migrasi terbaru menambahkan tabel `site_pages` dan kolom statistik di `site_settings`.
- Tidak ada seed artikel, agenda, pengurus, galeri, atau testimoni dummy. Database produksi mulai dari konten yang diisi admin.
- Konten Beranda dan Tentang Kami disimpan sebagai JSONB di `site_pages`; identitas organisasi dan statistik di `site_settings`.

## Catatan produksi

- Batasi CORS ke origin frontend Anda.
- Aktifkan dan uji RLS Supabase. Kebijakan bawaan `schema.sql` masih permisif untuk kemudahan pengembangan.
- Jangan commit `.env`, `uploads/`, atau `dist/`.
- Gunakan HTTPS dan simpan `SUPABASE_SERVICE_ROLE_KEY` hanya di server.
