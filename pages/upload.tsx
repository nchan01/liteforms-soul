import type { GetServerSideProps } from "next"
import { useState, useRef } from "react"
import Head from "next/head"
import { useRouter } from "next/router"
import toast from "react-hot-toast"
import Nav from "../src/components/Nav"
import { getAuthPropsFromContext } from "lib/auth0"
import type { AuthProps, LiteformManifest } from "types"
import { BLOCKED_FILENAMES, BLOCKED_PATTERNS } from "types"

interface UploadProps extends AuthProps {}

export const getServerSideProps: GetServerSideProps<UploadProps> = async (ctx) => {
  const authProps = await getAuthPropsFromContext(ctx)
  if (!authProps) return { redirect: { permanent: false, destination: "/api/auth/login?returnTo=/upload" } }
  return { props: { ...authProps } }
}

interface BundleState {
  manifest: LiteformManifest | null
  soulContent: string
  otherMarkdown: string[]
  hasCover: boolean
  hasVrm: boolean
  vrmFilename: string
  coverFilename: string
  rawFiles: { [name: string]: Uint8Array }
}

export default function Upload({ dbUser }: UploadProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [bundle, setBundle] = useState<BundleState | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [parsing, setParsing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  async function handleZipSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true); setError(""); setBundle(null)

    try {
      const JSZip = (await import("jszip")).default
      const zip = await JSZip.loadAsync(file)
      const rawFiles: { [name: string]: Uint8Array } = {}

      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue
        const basename = path.split("/").pop()!
        rawFiles[basename] = await entry.async("uint8array")
      }

      const blockedFound = Object.keys(rawFiles).find(
        name => BLOCKED_FILENAMES.includes(name) || BLOCKED_PATTERNS.some(p => p.test(name))
      )
      if (blockedFound) { setError(`"${blockedFound}" is not allowed in bundles.`); setParsing(false); return }
      if (!rawFiles["liteform.json"]) { setError("Bundle must contain liteform.json."); setParsing(false); return }

      const soulKey = Object.keys(rawFiles).find(n => n.toLowerCase() === "soul.md")
      if (!soulKey) { setError("Bundle must contain SOUL.md."); setParsing(false); return }

      const decoder = new TextDecoder()
      const manifest = JSON.parse(decoder.decode(rawFiles["liteform.json"])) as LiteformManifest
      const soulContent = decoder.decode(rawFiles[soulKey])
      const vrmKey = Object.keys(rawFiles).find(n => n.toLowerCase().endsWith(".vrm")) ?? ""
      const coverKey = Object.keys(rawFiles).find(n => /\.(png|jpg|jpeg|gif|webp)$/i.test(n)) ?? ""
      const otherMd = Object.keys(rawFiles).filter(n => n.toLowerCase().endsWith(".md") && n.toLowerCase() !== "soul.md")

      setBundle({ manifest, soulContent, otherMarkdown: otherMd, hasVrm: !!vrmKey, hasCover: !!coverKey, vrmFilename: vrmKey, coverFilename: coverKey, rawFiles })
      setTitle(manifest.title || "")
      setDescription(manifest.description || "")
      setTags((manifest.tags || []).join(", "))
    } catch (err: any) {
      setError(`Failed to parse bundle: ${err.message}`)
    } finally {
      setParsing(false)
    }
  }

  async function generateMeta() {
    if (!bundle) return
    setGenerating(true)
    try {
      const res = await fetch("/api/generate-meta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ soulContent: bundle.soulContent }) })
      const data = await res.json()
      if (data.title) setTitle(data.title)
      if (data.description) setDescription(data.description)
      if (data.tags) setTags(data.tags.join(", "))
    } catch { toast.error("Failed to generate metadata") } finally { setGenerating(false) }
  }

  async function uploadBlobFile(filename: string, bytes: Uint8Array): Promise<string> {
    const { upload } = await import("@vercel/blob/client")
    const blob = new Blob([bytes.buffer as ArrayBuffer])
    const result = await upload(filename, blob, {
      access: "public",
      handleUploadUrl: "/api/upload",
    })
    return result.url
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault()
    if (!bundle || !title.trim()) return
    setUploading(true)
    const t = toast.loading("Publishing…")
    try {
      // Upload binary files to Vercel Blob (no-op in prototype — returns "")
      let vrmUrl: string | null = null
      let coverUrl: string | null = null
      const blobEnabled = !!(window as any).__VERCEL_BLOB__ || process.env.NODE_ENV === "production"

      if (bundle.hasVrm && bundle.vrmFilename && bundle.rawFiles[bundle.vrmFilename]) {
        toast.loading("Uploading VRM…", { id: t })
        try { vrmUrl = await uploadBlobFile(bundle.vrmFilename, bundle.rawFiles[bundle.vrmFilename]) }
        catch { /* blob not configured — continue without VRM URL */ }
      }
      if (bundle.hasCover && bundle.coverFilename && bundle.rawFiles[bundle.coverFilename]) {
        toast.loading("Uploading cover…", { id: t })
        try { coverUrl = await uploadBlobFile(bundle.coverFilename, bundle.rawFiles[bundle.coverFilename]) }
        catch { /* blob not configured — continue without cover URL */ }
      }

      toast.loading("Publishing…", { id: t })
      const res = await fetch("/api/liteforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), description: description.trim() || null,
          tags: tags.split(",").map(t => t.trim()).filter(Boolean), isPublic,
          soulContent: bundle.soulContent, manifestJson: JSON.stringify(bundle.manifest),
          hasVrm: bundle.hasVrm, vrmFilename: bundle.vrmFilename || null,
          coverFilename: bundle.coverFilename || null,
          vrmUrl, coverUrl,
          markdownFiles: ["SOUL.md", ...bundle.otherMarkdown, ...(bundle.coverFilename ? [bundle.coverFilename] : []), ...(bundle.vrmFilename ? [bundle.vrmFilename] : []), "liteform.json"],
        }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Publish failed") }
      const { liteform } = await res.json()
      toast.success("Published!", { id: t })
      router.push(`/${dbUser.username ?? dbUser.id}/${liteform.id}`)
    } catch (err: any) {
      toast.error(err.message, { id: t })
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Head><title>Upload Soul — Liteforms</title></Head>
      <Nav username={dbUser.username} />

      <div style={{ maxWidth: 580, margin: "0 auto", padding: "24px 20px 60px" }}>
        <h1 style={{ marginBottom: 6 }}>Upload a soul</h1>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginBottom: 4, marginTop: 6 }}>
          Upload a .zip containing <code>liteform.json</code> + <code>SOUL.md</code>.
          Cover image, .vrm, and other markdown files are optional.
        </p>
        <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 20 }}>
          Not accepted: TOOLS.md, MCP server configs, connector credentials.
        </p>

        <hr />

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8, fontWeight: 500 }}>1. Choose .zip bundle</div>
          <input ref={fileRef} type="file" accept=".zip" onChange={handleZipSelect} disabled={parsing} style={{ fontSize: 13 }} />
          {parsing && <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text-3)" }}>Parsing…</span>}
        </div>

        {error && (
          <div style={{ border: "1px solid #e0a0a0", background: "rgba(200,0,0,0.04)", padding: "8px 12px", marginBottom: 16, fontSize: 12, color: "#c00" }}>
            {error}
          </div>
        )}

        {bundle && (
          <>
            <div style={{ border: "1px solid var(--border)", background: "var(--bg-subtle)", padding: "8px 12px", marginBottom: 20, fontSize: 12, color: "var(--text-2)" }}>
              Bundle OK — SOUL.md
              {bundle.otherMarkdown.length > 0 && `, ${bundle.otherMarkdown.join(", ")}`}
              {bundle.hasCover && `, ${bundle.coverFilename}`}
              {bundle.hasVrm && `, ${bundle.vrmFilename} (3D)`}
            </div>

            <form onSubmit={handlePublish}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 500 }}>2. Metadata</div>
                <button type="button" onClick={generateMeta} disabled={generating} className="btn" style={{ fontSize: 11 }}>
                  {generating ? "Generating…" : "✨ Auto-generate from SOUL.md"}
                </button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>Title *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required style={{ width: "100%" }} placeholder="e.g. Clawdia the Lobster" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>Short description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ width: "100%" }} placeholder="A brief description of this agent…" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>Tags (comma-separated)</label>
                <input type="text" value={tags} onChange={e => setTags(e.target.value)} style={{ width: "100%" }} placeholder="lobster, character, humor" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer", color: "var(--text)" }}>
                  <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
                  Make this agent public
                </label>
              </div>

              <button type="submit" disabled={uploading || !title.trim()} className="btn-solid" style={{ width: "100%", padding: "8px 0" }}>
                {uploading ? "Publishing…" : "Publish soul"}
              </button>
            </form>
          </>
        )}
      </div>
    </>
  )
}
