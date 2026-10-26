// Error Handler Middleware
// Centralized error handling for all routes

export class AppError extends Error {
  public statusCode: number
  public code: string

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message)
    this.statusCode = statusCode
    this.code = code
    Error.captureStackTrace(this, this.constructor)
  }
}

export function errorHandler(
  err: any,
  req: any,
  res: any,
  next: Function
) {
  console.error('⚠️ Error:', err)

  let statusCode = err.statusCode || 500
  let message = err.message || 'Terjadi kesalahan server'
  let code = err.code || 'INTERNAL_ERROR'

  // Supabase unique constraint violation
  if (err.code === '23505') {
    statusCode = 409
    message = 'Data sudah ada'
    code = 'DUPLICATE_ENTRY'
  }

  // Supabase: no rows returned for a single-row operation
  if (err.code === 'PGRST116') {
    statusCode = 404
    message = 'Data tidak ditemukan'
    code = 'NOT_FOUND'
  }

  // PostgreSQL invalid input syntax (mis. UUID tidak valid)
  if (err.code === '22P02') {
    statusCode = 400
    message = 'Format data tidak valid'
    code = 'INVALID_INPUT'
  }

  // Validation error
  if (err.status && err.status === 422) {
    statusCode = 422
    message = err.message || 'Validasi gagal'
    code = 'VALIDATION_ERROR'
  }

  res.status(statusCode).json({
    success: false,
    error: { code, message },
  })
}

export function notFoundHandler(req: any, res: any) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route tidak ditemukan' },
  })
}