import type { GetServerSideProps } from "next"
import Link from "next/link"
import Head from "next/head"
import { useRouter } from "next/router"
import WiggleBlock from "../src/components/WiggleBlock"
import dynamic from "next/dynamic"
import Nav from "../src/components/Nav"

const VrmCard = dynamic(() => import("../src/components/VrmCard"), { ssr: false })
const VrmCardMagic = dynamic(() => import("../src/components/VrmCardMagic"), { ssr: false })

// Deterministic bold color per agent
const CARD_PALETTES = [
  { bg: "#e85d3b", fg: "#fff0ec" },  // vermillion
  { bg: "#3b6fd4", fg: "#eef2ff" },  // cobalt
  { bg: "#2d8a52", fg: "#edfff4" },  // emerald
  { bg: "#8b3db8", fg: "#f8f0ff" },  // violet
  { bg: "#d4832a", fg: "#fff8ee" },  // amber
  { bg: "#2a8a8a", fg: "#eeffff" },  // teal
  { bg: "#b83d5a", fg: "#fff0f3" },  // ruby
  { bg: "#6b6b2a", fg: "#fffff0" },  // olive
  { bg: "#1a3a8a", fg: "#f0f3ff" },  // indigo
  { bg: "#8a2a2a", fg: "#fff5f0" },  // crimson
  { bg: "#2a5a2a", fg: "#f0fff0" },  // forest
  { bg: "#5a2a8a", fg: "#f8f0ff" },  // deep purple
]

function cardPalette(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CARD_PALETTES[h % CARD_PALETTES.length]
}

import { listLiteforms } from "lib/liteforms"
import { getAuth0Instance, safeGetSession } from "lib/auth0"
import type { Auth0User, LiteformWithAuthor } from "types"

interface HomeProps {
  liteforms: LiteformWithAuthor[]
  total: number
  page: number
  totalPages: number
  query: string
  username: string | null
}

export const getServerSideProps: GetServerSideProps<HomeProps> = async (ctx) => {
  const { q = "", page = "1" } = ctx.query
  const result = await listLiteforms({ query: q as string }, Number(page))

  const instance = getAuth0Instance(ctx.req)
  const session = await safeGetSession(instance, ctx.req, ctx.res)
  const username = (session?.user as Auth0User | undefined)?.nickname ?? null

  return {
    props: {
      liteforms: JSON.parse(JSON.stringify(result.liteforms)),
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      query: q as string,
      username,
    },
  }
}

function ColorBlock({ id, title }: { id: string; title: string }) {
  const { bg, fg } = cardPalette(id)
  // Big watermark letter behind the title
  const initial = title.replace(/^The\s+/i, "")[0]?.toUpperCase() ?? "◈"
  return (
    <div style={{
      width: "100%", height: "100%",
      background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
    }}>
      {/* oversized watermark initial */}
      <span aria-hidden style={{
        position: "absolute",
        fontSize: "clamp(80px, 40%, 140px)",
        fontFamily: "'Fraunces', Georgia, serif",
        fontStyle: "italic",
        fontWeight: 700,
        color: "rgba(0,0,0,0.12)",
        lineHeight: 1,
        userSelect: "none",
        letterSpacing: "-0.04em",
      }}>{initial}</span>
      {/* agent name */}
      <span style={{
        position: "relative",
        fontFamily: "'Fraunces', Georgia, serif",
        fontStyle: "italic",
        fontWeight: 400,
        fontSize: "clamp(14px, 4.5cqi, 22px)",
        color: fg,
        textAlign: "center",
        padding: "0 12%",
        lineHeight: 1.2,
        letterSpacing: "-0.01em",
      }}>{title}</span>
    </div>
  )
}

function AgentCard({ lf }: { lf: LiteformWithAuthor }) {
  const slug = lf.user.username ?? lf.user.id
  const recommendedModel: string | undefined = (() => {
    try { return JSON.parse(lf.manifestJson)?.recommended_model } catch { return undefined }
  })()

  return (
    <Link href={`/${slug}/${lf.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div className="block-card" style={{ overflow: "hidden", cursor: "pointer" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "1/1", overflow: "hidden", background: "var(--bg-subtle)" }}>
          {lf.hasVrm && lf.vrmUrl ? (
            <VrmCardMagic vrmUrl={lf.vrmUrl} alt={lf.title} />
          ) : lf.coverUrl ? (
            <WiggleBlock imageUrl={lf.coverUrl} alt={lf.title} />
          ) : (
            <WiggleBlock>
              <ColorBlock id={lf.id} title={lf.title} />
            </WiggleBlock>
          )}
          {lf.hasVrm && (
            <span className="holo-badge" style={{ position: "absolute", top: 8, right: 8, fontSize: 9, zIndex: 2 }}>
              3D
            </span>
          )}
        </div>

        <div style={{ padding: "10px 12px 12px", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 500, fontSize: 13, color: "var(--text)", marginBottom: 3, lineHeight: 1.3 }}>
            {lf.title}
          </div>
          {lf.description && (
            <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.4, marginBottom: 6,
              overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
              {lf.description}
            </div>
          )}
          {recommendedModel && (
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 5, marginBottom: 2 }}>
              for <span style={{ color: "var(--text-2)", fontWeight: 500 }}>{recommendedModel}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
              @{lf.user.username ?? lf.user.displayName ?? "anon"}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
              {lf.viewCount} views
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function Home({ liteforms, total, page, totalPages, query, username }: HomeProps) {
  const router = useRouter()

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const q = fd.get("q") as string
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/")
  }

  return (
    <>
      <Head><title>Liteforms — Share AI Agents</title></Head>
      <Nav username={username} />

      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "32px 20px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 6, letterSpacing: "-0.02em" }}>
              Liteforms
            </h1>
            <p style={{ color: "var(--text-2)", fontSize: 13, margin: 0, maxWidth: 460 }}>
              A free gallery for OpenClaw-style AI agents. Browse, copy, share.
              Agents with .vrm files get a 3D preview.
            </p>
          </div>
          <Link href={username ? "/upload" : "/api/auth/login?signup=1&returnTo=/upload"} className="btn-solid">
            + Upload soul
          </Link>
        </div>
      </div>

      {/* Gallery */}
      <div id="gallery" style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 6 }}>
            <input name="q" type="search" defaultValue={query} placeholder="Search agents…" style={{ width: 220 }} />
            <button type="submit" className="btn">Search</button>
            {query && <Link href="/" className="btn">✕ clear</Link>}
          </form>
          <span style={{ fontSize: 12, color: "var(--text-3)", marginLeft: 4 }}>
            {total} agent{total !== 1 ? "s" : ""}{query ? ` for "${query}"` : ""}
          </span>
        </div>

        {liteforms.length === 0 ? (
          <div style={{ padding: "60px 0", color: "var(--text-3)", fontSize: 13 }}>
            {query ? `No agents matching "${query}".` : "No agents yet."}{" "}
            <Link href={username ? "/upload" : "/api/auth/login?returnTo=/upload"}>Upload the first soul.</Link>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 1,
            border: "1px solid var(--border)",
            background: "var(--border)",
          }}>
            {liteforms.map(lf => <AgentCard key={lf.id} lf={lf} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ marginTop: 24, display: "flex", gap: 4 }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Link
                key={p}
                href={query ? `/?q=${encodeURIComponent(query)}&page=${p}` : `/?page=${p}`}
                className="btn"
                style={{ fontWeight: p === page ? 600 : 400, borderColor: p === page ? "var(--text)" : undefined }}
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "16px 20px", fontSize: 12, color: "var(--text-3)", display: "flex", gap: 16 }}>
        <span style={{ fontWeight: 500, color: "var(--text-2)" }}>Liteforms</span>
        <a href="https://lookingglassfactory.com" style={{ color: "var(--text-3)" }}>Looking Glass Factory</a>
        <Link href="https://liteforms.ai" style={{ color: "var(--text-3)" }}>liteforms.ai</Link>
      </div>
    </>
  )
}
