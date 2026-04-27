/**
 * File storage via S3-compatible API.
 * Works with Supabase Storage (default) or AWS S3 — swap endpoint + credentials.
 *
 * Supabase Storage env vars:
 *   S3_ENDPOINT      = https://[project-ref].supabase.co/storage/v1/s3
 *   S3_REGION        = auto
 *   AWS_ACCESS_KEY_ID     = <supabase storage access key>
 *   AWS_SECRET_ACCESS_KEY = <supabase storage secret key>
 *   S3_BUCKET_NAME   = liteforms-files
 *   S3_PUBLIC_URL    = https://[project-ref].supabase.co/storage/v1/object/public/liteforms-files
 *
 * To migrate to AWS S3: remove S3_ENDPOINT + S3_PUBLIC_URL, point credentials at AWS.
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { createPresignedPost } from "@aws-sdk/s3-presigned-post"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

export const IS_PROTOTYPE = !process.env.S3_BUCKET_NAME || process.env.S3_BUCKET_NAME === "placeholder"

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT,           // undefined = use AWS default
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
  forcePathStyle: !!process.env.S3_ENDPOINT,   // required for Supabase / MinIO
})

const BUCKET = process.env.S3_BUCKET_NAME!

export function liteformBundlePrefix(userId: string, liteformId: string) {
  return `liteforms/${userId}/${liteformId}`
}

/** Presigned POST — lets the browser upload directly to storage (avoids routing through our server). */
export async function s3PresignedPost(key: string, mimeType: string, maxBytes: number) {
  if (IS_PROTOTYPE) throw new Error("Storage not configured in prototype mode")
  return createPresignedPost(s3, {
    Bucket: BUCKET,
    Key: key,
    Conditions: [
      ["content-length-range", 0, maxBytes],
      ["eq", "$Content-Type", mimeType],
    ],
    Fields: { "Content-Type": mimeType },
    Expires: 600,
  })
}

/** Server-side put (used when we have the bytes in memory, e.g. seed scripts). */
export async function s3Put(key: string, body: Buffer | string, contentType: string): Promise<string> {
  if (IS_PROTOTYPE) return ""
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }))
  return s3PublicUrl(key)
}

/** Public URL for a key. Uses S3_PUBLIC_URL base if set (Supabase), otherwise falls back to AWS path. */
export function s3PublicUrl(key: string) {
  if (IS_PROTOTYPE) return ""
  if (process.env.S3_PUBLIC_URL) return `${process.env.S3_PUBLIC_URL}/${key}`
  return `https://${BUCKET}.s3.amazonaws.com/${key}`
}

/** For private files — generates a time-limited signed read URL. Public files don't need this. */
export async function s3PresignedReadUrl(key: string, expiresIn = 3600) {
  if (IS_PROTOTYPE) return ""
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn })
}

export const MAX_COVER_BYTES = 5 * 1024 * 1024   // 5 MB
export const MAX_VRM_BYTES   = 50 * 1024 * 1024  // 50 MB
export const MAX_MD_BYTES    = 1 * 1024 * 1024   // 1 MB
