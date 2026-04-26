import { getAuth0Instance, getAuth0Urls } from "lib/auth0"
import type { NextApiHandler } from "next"

// Auth0 handles four routes automatically:
//   /api/auth/login    — start login flow
//   /api/auth/logout   — log the user out
//   /api/auth/callback — Auth0 redirects here after login
//   /api/auth/me       — fetch the current session profile

const handler: NextApiHandler = (req, res) => {
  const instance = getAuth0Instance(req)
  const instanceHandler = instance.handleAuth({
    login: async (req, res) => {
      const { redirectUri, returnTo, signup } = getAuth0Urls(req)
      await instance.handleLogin(req, res, {
        authorizationParams: {
          redirect_uri: redirectUri,
          screen_hint: signup ? "signup" : undefined,
        },
        returnTo,
      })
    },
    callback: async (req, res) => {
      const { redirectUri } = getAuth0Urls(req)
      await instance.handleCallback(req, res, {
        authorizationParams: { redirect_uri: redirectUri },
        afterCallback: async (_req, _res, session) => {
          // Post-login: ensure user exists in DB via the hook endpoint
          return session
        },
      })
    },
    logout: async (req, res) => {
      const { returnTo } = getAuth0Urls(req)
      await instance.handleLogout(req, res, { returnTo })
    },
    profile: async (req, res) => {
      await instance.handleProfile(req, res)
    },
  })
  return instanceHandler(req, res)
}

export default handler
