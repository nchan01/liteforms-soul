import type { NextApiRequest, NextApiResponse } from "next"
import { prisma } from "lib/prisma"
import { getAuth0Instance, safeGetSession } from "lib/auth0"
import type { Auth0User } from "types"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end()

  const { liteformId, reason } = req.body
  if (!liteformId || !reason) return res.status(400).json({ error: "liteformId and reason are required" })

  const instance = getAuth0Instance(req)
  const session = await safeGetSession(instance, req, res)
  let reporterId: string | null = null
  if (session?.user) {
    const auth0User = session.user as Auth0User
    const dbUser = await prisma.user.findUnique({ where: { auth0Id: auth0User.sub } })
    reporterId = dbUser?.id ?? null
  }

  await prisma.report.create({ data: { liteformId, reporterId, reason } })
  return res.status(201).json({ ok: true })
}
