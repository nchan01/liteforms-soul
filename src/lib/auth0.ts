import { initAuth0 } from "@auth0/nextjs-auth0"
import type { IncomingMessage } from "http"
import type { NextApiRequest } from "next"
import type { GetServerSidePropsContext } from "next"
import { prisma } from "lib/prisma"
import type { Auth0User } from "types"

const IS_PROTOTYPE = process.env.AUTH0_ISSUER_BASE_URL?.includes("placeholder")

// Build per-request Auth0 instance (supports multi-tenant / preview URLs)
export function getAuth0Instance(req: IncomingMessage | NextApiRequest) {
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http"
  const baseURL = process.env.AUTH0_BASE_URL ?? `${protocol}://${req.headers.host}`

  return initAuth0({
    secret: process.env.AUTH0_SECRET!,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL!,
    baseURL,
    clientID: process.env.AUTH0_CLIENT_ID!,
    clientSecret: process.env.AUTH0_CLIENT_SECRET!,
    routes: {
      callback: "/api/auth/callback",
      login: "/api/auth/login",
      logout: "/api/auth/logout",
    },
    session: {
      absoluteDuration: 60 * 60 * 24 * 7, // 7 days
    },
  })
}

// In prototype mode, getSession always returns null (no real Auth0 tenant)
export async function safeGetSession(
  instance: ReturnType<typeof getAuth0Instance>,
  req: IncomingMessage | NextApiRequest,
  res: any
) {
  if (IS_PROTOTYPE) return null
  try {
    return await instance.getSession(req as any, res)
  } catch {
    return null
  }
}

// Return the login + callback URLs for the current request
export function getAuth0Urls(req: NextApiRequest) {
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http"
  const host = req.headers.host ?? "localhost:3000"
  const base = `${protocol}://${host}`

  const returnTo =
    (req.query?.returnTo as string) ||
    (req.headers.referer?.replace(/https?:\/\/[^/]+/, "") ?? "/")

  const signup = req.query?.signup === "1"

  return {
    redirectUri: `${base}/api/auth/callback`,
    returnTo: returnTo || "/",
    signup,
  }
}

// Look up the DB user from an Auth0 session context
export async function getUserFromContext(ctx: GetServerSidePropsContext) {
  const instance = getAuth0Instance(ctx.req)
  const session = await safeGetSession(instance, ctx.req, ctx.res)
  if (!session?.user) return null

  const auth0User = session.user as Auth0User
  return prisma.user.findUnique({ where: { auth0Id: auth0User.sub } })
}

// Full auth props (DB user + Auth0 user) — used by getServerSideProps
export async function getAuthPropsFromContext(ctx: GetServerSidePropsContext) {
  const instance = getAuth0Instance(ctx.req)
  const session = await safeGetSession(instance, ctx.req, ctx.res)
  if (!session?.user) return null

  const auth0User = session.user as Auth0User
  const dbUser = await prisma.user.findUnique({ where: { auth0Id: auth0User.sub } })
  if (!dbUser) return null

  return { dbUser, auth0User }
}
