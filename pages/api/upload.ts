/**
 * POST /api/upload — returns a presigned POST so the browser can upload
 * VRM / cover files directly to Supabase Storage (or S3) without routing
 * the bytes through our server.
 *
 * Body: { filename: string, contentType: string }
 * Response: { url: string, fields: Record<string, string>, publicUrl: string }
 */
import type { NextApiRequest, NextApiResponse } from "next"
import { getAuth0Instance, safeGetSession } from "lib/auth0"
import { s3PresignedPost, s3PublicUrl, IS_PROTOTYPE, MAX_VRM_BYTES, MAX_COVER_BYTES } from "lib/s3"

const ALLOWED = /\.(vrm|png|jpg|jpeg|gif|webp)$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end()

  // Prototype mode — no storage configured, return empty so upload.tsx silently skips
  if (IS_PROTOTYPE) return res.status(200).json({ url: "", fields: {}, publicUrl: "" })

  const instance = getAuth0Instance(req)
  const session = await safeGetSession(instance, req, res)
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" })

  const { filename, contentType } = req.body as { filename: string; contentType: string }
  if (!filename || !ALLOWED.test(filename)) {
    return res.status(400).json({ error: "Only .vrm, .png, .jpg, .gif, .webp files are allowed" })
  }

  const isVrm = filename.toLowerCase().endsWith(".vrm")
  const maxBytes = isVrm ? MAX_VRM_BYTES : MAX_COVER_BYTES
  const key = `uploads/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`

  try {
    const { url, fields } = await s3PresignedPost(key, contentType, maxBytes)
    return res.status(200).json({ url, fields, publicUrl: s3PublicUrl(key) })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
