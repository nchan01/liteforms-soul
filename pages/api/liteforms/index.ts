import type { NextApiRequest, NextApiResponse } from "next"
import { getAuth0Instance, safeGetSession } from "lib/auth0"
import { prisma } from "lib/prisma"
import { listLiteforms, upsertLiteformTags, slugify } from "lib/liteforms"
import type { Auth0User } from "types"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { q, hasVrm, userId, sort, page } = req.query
    const result = await listLiteforms(
      {
        query: q as string | undefined,
        hasVrm: hasVrm === "true" ? true : hasVrm === "false" ? false : undefined,
        userId: userId as string | undefined,
        sort: sort as any,
      },
      page ? Number(page) : 1
    )
    return res.status(200).json(result)
  }

  if (req.method === "POST") {
    const instance = getAuth0Instance(req)
    const session = await safeGetSession(instance, req, res)
    if (!session?.user) return res.status(401).json({ error: "Unauthorized" })

    const auth0User = session.user as Auth0User
    const dbUser = await prisma.user.findUnique({ where: { auth0Id: auth0User.sub } })
    if (!dbUser) return res.status(401).json({ error: "User not found" })

    const {
      title, description, tags, isPublic,
      soulContent, manifestJson,
      hasVrm, vrmFilename, coverFilename, markdownFiles,
      vrmUrl, coverUrl,
    } = req.body

    if (!title || !soulContent) return res.status(400).json({ error: "title and soulContent are required" })

    const id = crypto.randomUUID()
    const bundlePrefix = `liteforms/${dbUser.id}/${id}/`

    const liteform = await prisma.liteform.create({
      data: {
        id,
        userId: dbUser.id,
        title,
        slug: slugify(title),
        description: description ?? null,
        bundlePrefix,
        manifestJson: manifestJson ?? JSON.stringify({ schema_version: "1.0", title, has_vrm: !!hasVrm }),
        soulContent,
        markdownFiles: JSON.stringify(markdownFiles ?? ["SOUL.md"]),
        hasVrm: !!hasVrm,
        vrmFilename: vrmFilename ?? null,
        coverFilename: coverFilename ?? null,
        vrmUrl: vrmUrl || null,
        coverUrl: coverUrl || null,
        isPublic: isPublic ?? true,
      },
    })

    if (tags?.length) await upsertLiteformTags(liteform.id, tags)

    return res.status(201).json({ liteform })
  }

  return res.status(405).end()
}
