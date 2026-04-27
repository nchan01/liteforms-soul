// GET /api/liteforms/:id/download — serves a ZIP of the bundle
import type { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "lib/prisma"
import path from "path"
import fs from "fs/promises"

const IS_PROTOTYPE = !process.env.S3_BUCKET_NAME || process.env.S3_BUCKET_NAME === "placeholder"

async function fetchFileBytes(url: string): Promise<Buffer | null> {
  if (!url) return null

  // Local public/ file (prototype mode — vrmUrl starts with "/")
  if (url.startsWith("/") && IS_PROTOTYPE) {
    try {
      const localPath = path.join(process.cwd(), "public", url)
      return await fs.readFile(localPath)
    } catch {
      return null
    }
  }

  // Remote URL (S3 or CDN)
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end()

  const { id } = req.query as { id: string }
  const lf = await prisma.liteform.findUnique({ where: { id } })
  if (!lf || !lf.isPublic) return res.status(404).json({ error: "Not found" })

  const JSZip = (await import("jszip")).default
  const zip = new JSZip()
  const folder = zip.folder(lf.slug ?? lf.id)!

  // Always included
  folder.file("SOUL.md", lf.soulContent)
  folder.file("liteform.json", lf.manifestJson)

  // VRM — fetch and bundle if present
  if (lf.hasVrm && lf.vrmFilename && lf.vrmUrl) {
    const vrmBytes = await fetchFileBytes(lf.vrmUrl)
    if (vrmBytes) {
      folder.file(lf.vrmFilename, vrmBytes)
    }
  }

  // Cover image — bundle if present
  if (lf.coverFilename && lf.coverUrl) {
    const coverBytes = await fetchFileBytes(lf.coverUrl)
    if (coverBytes) {
      folder.file(lf.coverFilename, coverBytes)
    }
  }

  const content = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })

  prisma.liteform.update({ where: { id }, data: { downloadCount: { increment: 1 } } }).catch(() => {})

  const filename = `${lf.slug ?? lf.id}.zip`
  res.setHeader("Content-Type", "application/zip")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
  res.send(content)
}
