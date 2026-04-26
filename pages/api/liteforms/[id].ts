import type { NextApiRequest, NextApiResponse } from "next"
import { getAuth0Instance, safeGetSession } from "lib/auth0"
import { prisma } from "lib/prisma"
import { getLiteformById, upsertLiteformTags } from "lib/liteforms"
import type { Auth0User } from "types"

async function getSessionUser(req: NextApiRequest, res: NextApiResponse) {
  const instance = getAuth0Instance(req)
  const session = await safeGetSession(instance, req, res)
  if (!session?.user) return null
  const auth0User = session.user as Auth0User
  return prisma.user.findUnique({ where: { auth0Id: auth0User.sub } })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string }

  if (req.method === "GET") {
    const lf = await getLiteformById(id)
    if (!lf) return res.status(404).json({ error: "Not found" })
    return res.status(200).json({ liteform: lf })
  }

  if (req.method === "PATCH") {
    const user = await getSessionUser(req, res)
    if (!user) return res.status(401).json({ error: "Unauthorized" })

    const lf = await prisma.liteform.findUnique({ where: { id }, select: { userId: true } })
    if (!lf) return res.status(404).json({ error: "Not found" })
    if (lf.userId !== user.id) return res.status(403).json({ error: "Forbidden" })

    const { title, description, isPublic, tags } = req.body
    const updated = await prisma.liteform.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic }),
      },
    })
    if (tags) await upsertLiteformTags(id, tags)
    return res.status(200).json({ liteform: updated })
  }

  if (req.method === "DELETE") {
    const user = await getSessionUser(req, res)
    if (!user) return res.status(401).json({ error: "Unauthorized" })

    const lf = await prisma.liteform.findUnique({ where: { id }, select: { userId: true } })
    if (!lf) return res.status(404).json({ error: "Not found" })
    if (lf.userId !== user.id) return res.status(403).json({ error: "Forbidden" })

    await prisma.liteform.delete({ where: { id } })
    return res.status(204).end()
  }

  return res.status(405).end()
}
