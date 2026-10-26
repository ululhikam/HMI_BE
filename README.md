# HMI Backend API

REST API untuk website HMI Komisariat Insan Cita. Dibangun dengan TypeScript, Express, dan Supabase (PostgreSQL + Auth).

Kontrak lengkap ada di [`../apicontract.yaml`](../apicontract.yaml). Dokumen ini fokus pada cara menjalankan dan merawat backend.

## Struktur

```text
backend/
├── src/
│   ├── config/supabase.ts    # Klien Supabase
│   ├── database/             # Repository per entitas
│   ├── middleware/           # authMiddleware, CORS, errorHandler
│   ├── services/             # mediaStorage (Supabase Storage / lokal)
│   ├── scripts/              # migrate, create-admin, verify-db
│   ├── types/                # Tipe domain
│   └── index.ts              # Entry point & semua route
├── supabase/migrations/      # Riwayat migrasi
├── schema.sql                # Skema lengkap
├── vercel.json               # Konfigurasi deploy Vercel
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
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

CORS_ORIGINS=http://localhost:5173
MEDIA_STORAGE=auto
SUPABASE_STORAGE_BUCKET=media
MAX_UPLOAD_MB=3

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

- `SUPABASE_SERVICE_ROLE_KEY` wajib untuk Supabase Storage dan sangat disarankan untuk operasi database server. Key ini tidak boleh dikirim ke frontend.
- `DB_HOST`, `DB_USER`, dan `DB_PASSWORD` hanya dipakai oleh script (`migrate`, `create-admin`). API runtime memakai Supabase client, jadi variabel DB tidak wajib di Vercel.
- `CORS_ORIGINS` berisi origin frontend yang diizinkan, dipisahkan koma. Request tanpa `Origin` (health check/server-to-server) tetap diizinkan.
- `MEDIA_STORAGE=auto` memakai Supabase Storage bila service role tersedia atau saat berjalan di Vercel. Gunakan `local` hanya untuk development.
- `PUBLIC_BASE_URL` opsional, hanya dipakai untuk membentuk URL absolut upload lokal. Jika kosong, URL diambil dari request.

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
| Pendaftar agenda (non-LK1) | `GET /event-registrations`, `GET/PATCH/DELETE /event-registrations/:id` |
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
- Ukuran maksimal 3 MB setelah decode agar payload base64 tetap di bawah batas body Vercel Functions.
- Nama file dibersihkan dan diberi prefix timestamp.
- Response: `{ url, filename, size, storage }`.
- Dengan service role, file diunggah ke bucket Supabase Storage `SUPABASE_STORAGE_BUCKET` dan URL publik dikembalikan. Bucket publik dibuat otomatis bila belum ada.
- Tanpa service role di local, file disimpan di `uploads/` dan disajikan lewat `GET /uploads/<filename>`.
- Filesystem Vercel tidak persisten, sehingga upload produksi selalu memakai Supabase Storage.
- URL `http(s)://...` dapat dikirim langsung dan akan dikembalikan apa adanya.

Buat bucket `media` dengan akses publik di Supabase Dashboard sebelum produksi, atau biarkan service role membuatnya otomatis pada upload pertama.

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

## Deploy ke Vercel

Backend disiapkan sebagai project Vercel terpisah dari frontend. Saat mengimpor repository, pilih **Root Directory** `backend` (jika memakai repository ini) atau root repository backend. `vercel.json` menetapkan framework Express; Vercel menjalankan `src/index.ts` sebagai satu Vercel Function dan meneruskan seluruh path API tanpa prefix tambahan.

### 1. Sebelum deploy

1. Buat project Supabase dan isi `backend/.env` secara lokal.
2. Jalankan migrasi dan buat admin dari komputer/CI, bukan dari build Vercel:

   ```bash
   cd backend
   npm run migrate
   npm run create-admin
   ```

3. Siapkan origin frontend produksi, mis. `https://hmi-insan-cita.vercel.app`.
4. Pastikan bucket Supabase Storage publik bernama `media` tersedia. Service role juga dapat membuatnya otomatis saat upload pertama.

### 2. Environment variables Vercel

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `SUPABASE_URL` | Ya | URL project Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya | Operasi database server dan upload Supabase Storage. Jangan pernah diekspos ke frontend. |
| `SUPABASE_ANON_KEY` | Tidak | Cadangan bila service role tidak dipakai. Salah satu key Supabase wajib ada. |
| `CORS_ORIGINS` | Ya | Origin frontend, dipisahkan koma. Bisa memakai pola `*.vercel.app` untuk preview. |
| `SUPABASE_STORAGE_BUCKET` | Tidak | Default `media`. |
| `MEDIA_STORAGE` | Tidak | Gunakan `supabase` atau biarkan `auto`. |
| `MAX_UPLOAD_MB` | Tidak | Default dan batas maksimum 3 MB. |
| `PUBLIC_BASE_URL` | Tidak | Hanya relevan untuk upload lokal. |
| `DB_*` / `DATABASE_URL` | Tidak | Hanya untuk script migrasi lokal/CI. Tidak diperlukan runtime Vercel. |
| `ADMIN_*` | Tidak | Hanya untuk `npm run create-admin`, bukan runtime. |
| `PORT` | Tidak | Diatur otomatis oleh Vercel. |

Jangan mengisi `MEDIA_STORAGE=local` di Vercel: filesystem Function bersifat sementara dan tidak dapat menyajikan file lama. Folder `uploads/` juga dikecualikan melalui `.vercelignore`.

### 3. Deploy

Lewat dashboard Vercel:

1. **Add New Project** lalu impor repository.
2. Set **Root Directory** ke `backend`.
3. Biarkan framework terdeteksi sebagai Express; `vercel.json` sudah menetapkannya.
4. Masukkan environment variable di atas untuk Production (dan Preview bila diperlukan).
5. Deploy.

Lewat CLI, dari folder `backend`:

```bash
npx vercel
npx vercel --prod
```

Tidak ada perintah build atau output directory yang perlu di-override. Node.js dikunci ke versi `22.x` melalui `package.json`.

### 4. Verifikasi

```bash
curl https://<nama-backend>.vercel.app/
curl https://<nama-backend>.vercel.app/health
```

Response `/health` menampilkan `storage: "supabase"` bila konfigurasi benar. Setelah itu, arahkan `VITE_API_BASE_URL` di project frontend ke `https://<nama-backend>.vercel.app` (tanpa trailing slash), lalu redeploy frontend.

### 5. Batasan Vercel

- Body request Vercel Functions dibatasi sekitar 4,5 MB. Karena API menerima base64, ukuran file maksimum dijaga 3 MB agar payload tetap aman.
- Upload produksi memakai Supabase Storage; `express.static('/uploads')` hanya aktif untuk development lokal.
- Migrasi database tidak dijalankan otomatis saat deploy. Jalankan `npm run migrate` secara terkontrol dari lokal/CI.
- Gunakan origin CORS yang eksplisit di produksi. Jika `CORS_ORIGINS` kosong, backend mengizinkan semua origin dan menulis peringatan di log.

## Catatan produksi

- Batasi CORS ke origin frontend Anda melalui `CORS_ORIGINS`.
- Aktifkan dan uji RLS Supabase. Kebijakan bawaan `schema.sql` masih permisif untuk kemudahan pengembangan.
- Jangan commit `.env`, `uploads/`, atau `dist/`.
- Gunakan HTTPS dan simpan `SUPABASE_SERVICE_ROLE_KEY` hanya di server/Vercel Environment Variables.
- Buat bucket Supabase Storage dengan akses publik hanya untuk media yang memang boleh diakses publik.
