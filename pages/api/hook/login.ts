// Called by Auth0 post-login action (or by our own callback) to provision
// a DB user record the first time someone signs in.
import type { NextApiRequest, NextApiResponse } from "next"
import { getAuth0Instance } from "lib/auth0"
import { prisma } from "lib/prisma"
import type { Auth0User } from "types"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end()

  // Verify the call comes from our own server via a shared secret
  const secret = req.headers["x-hook-secret"]
  if (secret !== process.env.HOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const instance = getAuth0Instance(req)
  const session = await instance.getSession(req, res)
  if (!session?.user) return res.status(401).json({ error: "No session" })

  const auth0User = session.user as Auth0User

  const user = await prisma.user.upsert({
    where: { auth0Id: auth0User.sub },
    update: {
      email: auth0User.email,
      displayName: auth0User.name ?? undefined,
      avatar: auth0User.picture ?? undefined,
    },
    create: {
      auth0Id: auth0User.sub,
      email: auth0User.email,
      displayName: auth0User.name ?? null,
      avatar: auth0User.picture ?? null,
    },
  })

  return res.status(200).json({ user: { id: user.id, username: user.username } })
}
