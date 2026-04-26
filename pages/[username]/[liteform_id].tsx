import type { GetServerSideProps } from "next"
import dynamic from "next/dynamic"
import Link from "next/link"
import Head from "next/head"
import ReactMarkdown from "react-markdown"
import { useState, useRef, useEffect } from "react"
import Nav from "../../src/components/Nav"
import WiggleBlock from "../../src/components/WiggleBlock"
import { prisma } from "lib/prisma"
import { getLiteformById } from "lib/liteforms"
import { getAuth0Instance, safeGetSession } from "lib/auth0"
import type { Auth0User, LiteformWithAuthor } from "types"

const VrmViewer = dynamic(() => import("../../src/components/VrmViewer"), { ssr: false })

interface DetailProps {
  lf: LiteformWithAuthor
  username: string | null
  viewerIsAuthor: boolean
}

export const getServerSideProps: GetServerSideProps<DetailProps> = async (ctx) => {
  const { username, liteform_id } = ctx.params as { username: string; liteform_id: string }

  const lf = await getLiteformById(liteform_id)
  if (!lf || !lf.isPublic) return { notFound: true }

  const expectedSlug = lf.user.username ?? lf.user.id
  if (expectedSlug !== username) {
    return { redirect: { permanent: true, destination: `/${expectedSlug}/${liteform_id}` } }
  }

  const instance = getAuth0Instance(ctx.req)
  const session = await safeGetSession(instance, ctx.req, ctx.res)
  const auth0User = session?.user as Auth0User | undefined
  const sessionUsername = auth0User?.nickname ?? null

  let viewerIsAuthor = false
  if (auth0User) {
    const dbViewer = await prisma.user.findUnique({ where: { auth0Id: auth0User.sub } })
    viewerIsAuthor = dbViewer?.id === lf.user.id
  }

  prisma.liteform.update({ where: { id: liteform_id }, data: { viewCount: { increment: 1 } } }).catch(() => {})

  return { props: { lf: JSON.parse(JSON.stringify(lf)), username: sessionUsername, viewerIsAuthor } }
}

interface Message { role: "user" | "assistant"; content: string }

function ChatSection({ lf }: { lf: LiteformWithAuthor }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return
    const userMsg: Message = { role: "user", content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)
    try {
      const res = await fetch(`/api/liteforms/${lf.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, history: messages }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }])
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }])
    } finally { setLoading(false) }
  }

  return (
    <div style={{ border: "1px solid var(--border)" }}>
      <div style={{ maxHeight: 380, overflowY: "auto", padding: "16px 16px 0" }}>
        {messages.length === 0 ? (
          <p style={{ color: "var(--text-3)", fontSize: 12, textAlign: "center", padding: "24px 0" }}>
            Start a conversation. {lf.title} will respond in character.
          </p>
        ) : messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4, fontWeight: 500 }}>
              {m.role === "user" ? "You" : lf.title}
            </div>
            <div style={{
              fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
              color: m.role === "user" ? "var(--text-2)" : "var(--text)",
              background: m.role === "user" ? "var(--bg-subtle)" : "var(--bg)",
              border: "1px solid var(--border)", padding: "8px 12px",
            }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4, fontWeight: 500 }}>{lf.title}</div>
            <div style={{ fontSize: 13, color: "var(--text-3)", border: "1px solid var(--border)", padding: "8px 12px" }}>…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} style={{ display: "flex", borderTop: "1px solid var(--border)", padding: "10px 12px", background: "var(--bg-subtle)" }}>
        <input
          type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder={`Message ${lf.title}…`} disabled={loading}
          style={{ flex: 1, border: "1px solid var(--border)", borderRight: "none", borderRadius: "2px 0 0 2px", padding: "6px 10px", fontSize: 13 }}
        />
        <button type="submit" disabled={loading || !input.trim()} style={{
          border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-fg)",
          padding: "6px 16px", fontSize: 12, borderRadius: "0 2px 2px 0",
          cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1,
        }}>Send</button>
      </form>
    </div>
  )
}

// Inline SVG clipboard icon
function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export default function LiteformDetail({ lf, username, viewerIsAuthor }: DetailProps) {
  const authorSlug = lf.user.username ?? lf.user.id
  const authorName = lf.user.displayName ?? lf.user.username ?? "anonymous"
  const [copied, setCopied] = useState(false)
  const [showChat, setShowChat] = useState(false)

  const recommendedModel: string | undefined = (() => {
    try { return JSON.parse(lf.manifestJson)?.recommended_model } catch { return undefined }
  })()

  // Bundle contents label for zip button
  const zipContents = ["SOUL.md", "liteform.json", lf.vrmFilename].filter(Boolean).join(" + ")

  async function handleCopy() {
    await navigator.clipboard.writeText(lf.soulContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadBlob(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${lf.title}"? Cannot be undone.`)) return
    await fetch(`/api/liteforms/${lf.id}`, { method: "DELETE" })
    window.location.href = "/library"
  }

  async function handleReport() {
    const reason = prompt("Reason for report:")
    if (!reason) return
    await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liteformId: lf.id, reason }),
    })
    alert("Report submitted. Thank you.")
  }

  return (
    <>
      <Head>
        <title>{lf.title} — Liteforms</title>
        <meta name="description" content={lf.description ?? ""} />
      </Head>
      <Nav username={username} />

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 60px" }}>

        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 24 }}>
          <Link href="/">Gallery</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <Link href={`/${authorSlug}`}>@{lf.user.username ?? authorName}</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span>{lf.title}</span>
        </div>

        {/* ── Two-column layout ── */}
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap", alignItems: "flex-start" }}>

          {/* Left: square visual — always shown */}
          <div style={{ flexShrink: 0 }}>
            {lf.hasVrm && lf.vrmUrl ? (
              <>
                <VrmViewer vrmUrl={lf.vrmUrl} width={280} height={280} />
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 5, textAlign: "center" }}>drag to rotate</div>
              </>
            ) : lf.coverUrl ? (
              <div style={{ width: 280, height: 280, border: "1px solid var(--border)", overflow: "hidden" }}>
                <WiggleBlock imageUrl={lf.coverUrl} alt={lf.title} />
              </div>
            ) : (
              /* No image or VRM — text placeholder */
              <div style={{
                width: 280, height: 280,
                border: "1px solid var(--border)",
                background: "var(--bg-subtle)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 8, padding: 24,
              }}>
                <span style={{
                  fontFamily: "'Fraunces', Georgia, serif",
                  fontStyle: "italic",
                  fontSize: 20,
                  color: "var(--text-2)",
                  textAlign: "center",
                  lineHeight: 1.3,
                }}>{lf.title}</span>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>image not available</span>
              </div>
            )}
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-3)" }}>
              {lf.viewCount} views · {lf.downloadCount} downloads
            </div>
          </div>

          {/* Right: everything else */}
          <div style={{ flex: 1, minWidth: 260 }}>

            {/* Title */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <h1 style={{ fontSize: 22, lineHeight: 1.15 }}>{lf.title}</h1>
              {lf.hasVrm && <span className="holo-badge" style={{ marginTop: 6, flexShrink: 0 }}>3D</span>}
            </div>

            {/* Author · date */}
            <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>
              by <Link href={`/${authorSlug}`}>@{lf.user.username ?? authorName}</Link>
              <span style={{ margin: "0 8px" }}>·</span>
              {new Date(lf.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            </div>

            {/* Tags */}
            {lf.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
                {lf.tags.map(({ tag }) => <span key={tag.id} className="tag">{tag.name}</span>)}
              </div>
            )}

            {/* Recommended model */}
            {recommendedModel && (
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>
                Recommended for <span style={{ color: "var(--text-2)", fontWeight: 500 }}>{recommendedModel}</span>
              </div>
            )}

            {/* AI-generated summary / description */}
            {lf.description && (
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-2)", margin: "0 0 24px" }}>
                {lf.description}
              </p>
            )}

            <hr style={{ margin: "0 0 20px" }} />

            {/* ── Downloads ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 10, fontWeight: 600 }}>
                Download
              </div>

              {/* Primary zip button */}
              <a
                href={`/api/liteforms/${lf.id}/download`}
                style={{
                  display: "block",
                  border: "1px solid var(--accent)",
                  background: "var(--accent)",
                  color: "var(--accent-fg)",
                  padding: "9px 14px",
                  fontSize: 13,
                  textAlign: "center",
                  textDecoration: "none",
                  marginBottom: 8,
                }}
              >
                ↓ Download bundle .zip
              </a>
              <div style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", marginBottom: 14 }}>
                Contains: {zipContents}
              </div>

              {/* Individual files */}
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>Individual files:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button
                  onClick={() => downloadBlob(lf.soulContent, "SOUL.md", "text/markdown")}
                  className="btn" style={{ fontSize: 11 }}
                >
                  SOUL.md
                </button>
                <button
                  onClick={() => downloadBlob(lf.manifestJson, "liteform.json", "application/json")}
                  className="btn" style={{ fontSize: 11 }}
                >
                  liteform.json
                </button>
                {lf.hasVrm && lf.vrmUrl && lf.vrmFilename && (
                  <a href={lf.vrmUrl} download={lf.vrmFilename} className="btn" style={{ fontSize: 11 }}>
                    {lf.vrmFilename}
                  </a>
                )}
              </div>
            </div>

            <hr style={{ margin: "0 0 20px" }} />

            {/* Guide link */}
            <div style={{ marginBottom: 20 }}>
              <Link href="/guide" style={{ fontSize: 12, color: "var(--text-2)" }}>
                How to install this soul in OpenClaw →
              </Link>
            </div>

            {/* Try conversation */}
            <button
              onClick={() => setShowChat(v => !v)}
              className="btn"
              style={{ width: "100%", fontSize: 12, marginBottom: 16, textAlign: "center" }}
            >
              {showChat ? "Hide conversation" : "↗ Try a conversation"}
            </button>

            {/* Author controls */}
            {viewerIsAuthor && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <Link href={`/edit/${lf.id}`} className="btn" style={{ fontSize: 12 }}>Edit</Link>
                <button onClick={handleDelete} style={{
                  border: "1px solid #e0a0a0", background: "var(--bg)", color: "#c00",
                  padding: "4px 12px", borderRadius: 2, cursor: "pointer", fontSize: 12,
                }}>Delete</button>
              </div>
            )}

            {!viewerIsAuthor && (
              <button onClick={handleReport} style={{
                background: "none", border: "none", color: "var(--text-3)",
                fontSize: 11, cursor: "pointer", padding: 0, textDecoration: "underline",
              }}>Report this soul</button>
            )}
          </div>
        </div>

        {/* ── Inline chat (full width, below columns) ── */}
        {showChat && (
          <div style={{ marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 24 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>
              Conversation with {lf.title}
            </div>
            <ChatSection lf={lf} />
          </div>
        )}

        {/* ── SOUL.md (full width, below columns) ── */}
        <div style={{ marginTop: 48, borderTop: "1px solid var(--border)", paddingTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)", fontWeight: 600 }}>
              SOUL.md
            </div>
            <button
              onClick={handleCopy}
              title="Copy to clipboard"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "none", border: "1px solid var(--border)",
                color: copied ? "var(--text-2)" : "var(--text-3)",
                padding: "4px 8px", borderRadius: 2, cursor: "pointer", fontSize: 11,
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              <CopyIcon />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="soul-prose">
            <ReactMarkdown>{lf.soulContent}</ReactMarkdown>
          </div>
        </div>

        {/* ── liteform.json (collapsed) ── */}
        <div style={{ marginTop: 32 }}>
          <details>
            <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", userSelect: "none" }}>
              liteform.json
            </summary>
            <pre style={{ marginTop: 10, background: "var(--bg-subtle)", border: "1px solid var(--border)", padding: 12, fontSize: 11, color: "var(--text-2)", overflowX: "auto", fontFamily: "'Courier New', monospace" }}>
              {JSON.stringify(JSON.parse(lf.manifestJson), null, 2)}
            </pre>
          </details>
        </div>

      </div>
    </>
  )
}
