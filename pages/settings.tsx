import type { GetServerSideProps } from "next"
import { useState } from "react"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import toast from "react-hot-toast"
import Nav from "../src/components/Nav"
import { getAuth0Instance, getUserFromContext } from "lib/auth0"
import type { User } from "types"

interface SettingsProps { user: User }

export const getServerSideProps: GetServerSideProps<SettingsProps> = async (ctx) => {
  const instance = getAuth0Instance(ctx.req)
  const session = await instance.getSession(ctx.req, ctx.res).catch(() => null)
  if (!session?.user) return { redirect: { permanent: false, destination: "/api/auth/login?returnTo=/settings" } }

  const user = await getUserFromContext(ctx)
  if (!user) return { redirect: { permanent: false, destination: "/" } }

  return { props: { user: JSON.parse(JSON.stringify(user)) } }
}

export default function Settings({ user }: SettingsProps) {
  const router = useRouter()
  const [username, setUsername] = useState(user.username ?? "")
  const [displayName, setDisplayName] = useState(user.displayName ?? "")
  const [bio, setBio] = useState(user.bio ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username || undefined, displayName: displayName || undefined, bio: bio || undefined }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast.success("Saved")
      router.replace(router.asPath)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Head><title>Settings — Liteforms</title></Head>
      <Nav username={user.username} />

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 20px 60px" }}>
        <h1 style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>Settings</h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 5 }}>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="your-handle" style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 5 }}>Display name</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 5 }}>Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} style={{ width: "100%" }} />
          </div>
          <button type="submit" disabled={saving} className="btn-solid">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        <hr />
        <Link href="/api/auth/logout" style={{ fontSize: 12, color: "var(--text-3)" }}>Sign out</Link>
      </div>
    </>
  )
}
