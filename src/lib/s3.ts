/**
 * File storage — uses Vercel Blob in production, no-ops in prototype mode.
 * API mirrors the old S3 helpers so call-sites don't change.
 */
import { put } from "@vercel/blob"

export const IS_PROTOTYPE = !process.env.BLOB_READ_WRITE_TOKEN

// Build the storage prefix for a liteform bundle (kept for reference)
export function liteformBundlePrefix(userId: string, liteformId: string) {
  return `liteforms/${userId}/${liteformId}`
}

/**
 * Upload a file server-side. Returns the public URL, or "" in prototype mode.
 */
export async function s3Put(key: string, body: Buffer | string, contentType: string): Promise<string> {
  if (IS_PROTOTYPE) return ""
  const { url } = await put(key, body, { access: "public", contentType })
  return url
}

/** Public URL for a blob stored at `key`. In prototype, returns "". */
export function s3PublicUrl(key: string) {
  // In production the URL is returned by s3Put and stored in the DB — this is a no-op fallback.
  if (IS_PROTOTYPE) return ""
  return ""
}

/** Read URL for a blob — Vercel Blob URLs are already public, just return the stored URL. */
export async function s3PresignedReadUrl(url: string): Promise<string> {
  return url
}

// Kept for compatibility — not used in the Blob flow
export async function s3PresignedPost(_key: string, _mimeType: string, _maxBytes: number) {
  throw new Error("s3PresignedPost not supported in Vercel Blob mode")
}

export const MAX_COVER_BYTES = 5 * 1024 * 1024   // 5MB
export const MAX_VRM_BYTES   = 50 * 1024 * 1024  // 50MB
export const MAX_MD_BYTES    = 1 * 1024 * 1024   // 1MB
