import fs from 'fs'
import path from 'path'
import {
  supabase,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_STORAGE_BUCKET,
} from '../config/supabase'
import { AppError } from '../middleware/error'

const configuredMaxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 3)

/**
 * Vercel membatasi body request Functions (4.5 MB). Karena API menerima
 * base64, batas file dijaga di 3 MB agar payload tetap aman.
 */
export const MAX_UPLOAD_MB =
  Number.isFinite(configuredMaxUploadMb) && configuredMaxUploadMb > 0
    ? Math.min(configuredMaxUploadMb, 3)
    : 3

export const MAX_UPLOAD_BYTES = Math.floor(MAX_UPLOAD_MB * 1024 * 1024)

const storageMode = (process.env.MEDIA_STORAGE ?? 'auto').toLowerCase()
const useObjectStorage =
  storageMode === 'supabase' ||
  (storageMode !== 'local' &&
    (Boolean(SUPABASE_SERVICE_ROLE_KEY) || Boolean(process.env.VERCEL)))

export const LOCAL_UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
)

export function usesObjectStorage() {
  return useObjectStorage
}

export interface StoredImage {
  url: string
  filename: string
  size: number
  storage: 'supabase' | 'local'
}

let bucketReady: Promise<void> | null = null

async function verifyBucketIsPublic() {
  const { data, error } = await supabase.storage.getBucket(SUPABASE_STORAGE_BUCKET)
  if (error || !data) return false
  if (data.public === false) {
    throw new AppError(
      `Bucket Supabase Storage "${SUPABASE_STORAGE_BUCKET}" harus bersifat public agar URL gambar dapat diakses.`,
      500,
      'STORAGE_NOT_READY',
    )
  }
  return true
}

async function ensureStorageBucket() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError(
      'SUPABASE_SERVICE_ROLE_KEY wajib diisi untuk upload media ke Supabase Storage.',
      500,
      'STORAGE_NOT_CONFIGURED',
    )
  }

  if (await verifyBucketIsPublic()) return

  const { error: createError } = await supabase.storage.createBucket(SUPABASE_STORAGE_BUCKET, {
    public: true,
    fileSizeLimit: MAX_UPLOAD_BYTES,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  })

  if (createError) {
    // Bisa terjadi race condition saat dua request membuat bucket bersamaan.
    if (await verifyBucketIsPublic()) return
    throw new AppError(
      `Gagal menyiapkan bucket Supabase Storage "${SUPABASE_STORAGE_BUCKET}": ${createError.message}`,
      500,
      'STORAGE_NOT_READY',
    )
  }
}

function ensureBucketOnce() {
  if (!bucketReady) {
    bucketReady = ensureStorageBucket().catch((error) => {
      bucketReady = null
      throw error
    })
  }
  return bucketReady
}

function storagePath(filename: string) {
  const now = new Date()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `uploads/${now.getUTCFullYear()}/${month}/${filename}`
}

export async function storeImage(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  publicBaseUrl: string,
): Promise<StoredImage> {
  if (useObjectStorage) {
    await ensureBucketOnce()

    const objectPath = storagePath(filename)
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(objectPath, buffer, {
        contentType: mimeType,
        cacheControl: '31536000',
        upsert: false,
      })

    if (uploadError) {
      throw new AppError(
        `Gagal mengunggah gambar ke Supabase Storage: ${uploadError.message}`,
        502,
        'UPLOAD_FAILED',
      )
    }

    const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(objectPath)
    if (!data.publicUrl) {
      throw new AppError('Supabase Storage tidak mengembalikan URL publik.', 500, 'UPLOAD_FAILED')
    }

    return {
      url: data.publicUrl,
      filename,
      size: buffer.length,
      storage: 'supabase',
    }
  }

  // Fallback lokal untuk development. Filesystem Vercel tidak persisten.
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true })
  fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, filename), buffer)

  return {
    url: `${publicBaseUrl.replace(/\/+$/, '')}/uploads/${filename}`,
    filename,
    size: buffer.length,
    storage: 'local',
  }
}
