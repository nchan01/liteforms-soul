import type { GetServerSideProps } from "next"
import { useState } from "react"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import toast from "react-hot-toast"
import Nav from "../../src/components/Nav"
import { getAuthPropsFromContext } from "lib/auth0"
import { getLiteformById } from "lib/liteforms"
import type { AuthProps, LiteformWithAuthor } from "types"

interface EditProps extends AuthProps {
  liteform: LiteformWithAuthor
}

export const getServerSideProps: GetServerSideProps<EditProps> = async (ctx) => {
  const { id } = ctx.params as { id: string }
  const authProps = await getAuthPropsFromContext(ctx)
  if (!authProps) return { redirect: { permanent: false, destination: `/api/auth/login?returnTo=/edit/${id}` } }

  const liteform = await getLiteformById(id)
  if (!liteform) return { notFound: true }
  if (liteform.user.id !== authProps.dbUser.id) return { notFound: true }

  return { props: { ...authProps, liteform: JSON.parse(JSON.stringify(liteform)) } }
}

export default function EditSoul({ dbUser, liteform }: EditProps) {
  const router = useRouter()
  const slug = dbUser.username ?? dbUser.id

  const initialTags = (() => {
    try { return (liteform as any).tags?.map((t: any) => t.tag?.name ?? t).join(", ") ?? "" }
    catch { return "" }
  })() as string

  const [title, setTitle] = useState(liteform.title)
  const [description, setDescription] = useState(liteform.description ?? "")
  const [tags, setTags] = useState(initialTags)
  const [isPublic, setIsPublic] = useState(liteform.isPublic)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const t = toast.loading("Saving…")
    try {
      const res = await fetch(`/api/liteforms/${liteform.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          isPublic,
          tags: tags.split(",").map((s: string) => s.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Save failed") }
      toast.success("Saved!", { id: t })
      router.push(`/${slug}/${liteform.id}`)
    } catch (err: any) {
      toast.error(err.message, { id: t })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const t = toast.loading("Deleting…")
    try {
      const res = await fetch(`/api/liteforms/${liteform.id}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) { const err = await res.json(); throw new Error(err.error ?? "Delete failed") }
      toast.success("Soul deleted.", { id: t })
      router.push("/library")
    } catch (err: any) {
      toast.error(err.message, { id: t })
      setDeleting(false)
    }
  }

  return (
    <>
      <Head><title>Edit Soul — Liteforms</title></Head>
      <Nav username={dbUser.username} />

      <div style={{ maxWidth: 580, margin: "0 auto", padding: "24px 20px 60px" }}>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 20 }}>
          <Link href="/library">My Souls</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <Link href={`/${slug}/${liteform.id}`}>{liteform.title}</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span>Edit</span>
        </div>

        <h1 style={{ marginBottom: 6 }}>Edit soul</h1>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 6, marginBottom: 24 }}>
          Update your soul's metadata. To replace the SOUL.md or VRM file, delete this soul and re-upload.
        </p>

        <hr />

        <form onSubmit={handleSave} style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>Short description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ width: "100%" }} placeholder="A brief description of this soul…" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>Tags (comma-separated)</label>
            <input type="text" value={tags} onChange={e => setTags(e.target.value)} style={{ width: "100%" }} placeholder="e.g. character, humor, claude" />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer", color: "var(--text)" }}>
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
              Make this soul public
            </label>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={saving || !title.trim()} className="btn-solid">
              {saving ? "Saving…" : "Save changes"}
            </button>
            <Link href={`/${slug}/${liteform.id}`} className="btn">Cancel</Link>
          </div>
        </form>

        <hr style={{ marginTop: 40 }} />

        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>
            Danger zone
          </div>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ fontSize: 13, color: "#c00", background: "none", border: "1px solid rgba(200,0,0,0.3)", padding: "6px 14px", cursor: "pointer" }}
            >
              Delete this soul
            </button>
          ) : (
            <div style={{ border: "1px solid rgba(200,0,0,0.3)", background: "rgba(200,0,0,0.04)", padding: "14px 16px" }}>
              <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 12 }}>
                Are you sure? This permanently deletes the soul and all its files. This cannot be undone.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ fontSize: 13, color: "#fff", background: "#c00", border: "none", padding: "6px 14px", cursor: "pointer" }}
                >
                  {deleting ? "Deleting…" : "Yes, delete permanently"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="btn"
                  style={{ fontSize: 13 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
