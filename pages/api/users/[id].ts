import type { NextApiRequest, NextApiResponse } from "next"
import { getAuth0Instance, safeGetSession } from "lib/auth0"
import { prisma } from "lib/prisma"
import type { Auth0User } from "types"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") return res.status(405).end()

  const { id } = req.query as { id: string }
  const instance = getAuth0Instance(req)
  const session = await safeGetSession(instance, req, res)
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" })

  const auth0User = session.user as Auth0User
  const dbUser = await prisma.user.findUnique({ where: { auth0Id: auth0User.sub } })
  if (!dbUser || dbUser.id !== id) return res.status(403).json({ error: "Forbidden" })

  const { username, displayName, bio } = req.body
  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(username !== undefined && { username }),
      ...(displayName !== undefined && { displayName }),
      ...(bio !== undefined && { bio }),
    },
  })
  return res.status(200).json({ user: updated })
}
