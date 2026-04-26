/**
 * POST /api/upload — issue a Vercel Blob client-upload token.
 * Client uses this token to upload VRM / cover files directly to Blob storage.
 * In prototype mode (no BLOB_READ_WRITE_TOKEN), returns a stub response.
 */
import type { NextApiRequest, NextApiResponse } from "next"
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { getAuth0Instance, safeGetSession } from "lib/auth0"

const IS_PROTOTYPE = !process.env.BLOB_READ_WRITE_TOKEN

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end()

  if (IS_PROTOTYPE) {
    return res.status(200).json({ url: "" })
  }

  try {
    const instance = getAuth0Instance(req)
    const session = await safeGetSession(instance, req, res)
    if (!session?.user) return res.status(401).json({ error: "Unauthorized" })

    const body = req.body as HandleUploadBody

    const jsonResponse = await handleUpload({
      body,
      request: req as any,
      onBeforeGenerateToken: async (pathname) => {
        // Only allow VRM and image files
        const allowed = /\.(vrm|png|jpg|jpeg|gif|webp)$/i.test(pathname)
        if (!allowed) throw new Error("File type not allowed")
        return {
          allowedContentTypes: [
            "model/gltf-binary",
            "application/octet-stream",
            "image/png",
            "image/jpeg",
            "image/gif",
            "image/webp",
          ],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB max
        }
      },
      onUploadCompleted: async ({ blob }) => {
        // No-op — caller stores the URL in the liteform record
        console.log("blob upload complete:", blob.url)
      },
    })

    return res.status(200).json(jsonResponse)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
