import type { GetServerSideProps } from "next"
import Link from "next/link"
import Head from "next/head"
import Image from "next/image"
import Nav from "../src/components/Nav"
import { prisma } from "lib/prisma"
import { liteformSelect } from "lib/liteforms"
import { getAuth0Instance, safeGetSession } from "lib/auth0"
import type { Auth0User, LiteformWithAuthor } from "types"

interface ProfileProps {
  profileUser: { id: string; username: string | null; displayName: string | null; avatar: string | null; bio: string | null }
  liteforms: LiteformWithAuthor[]
  sessionUsername: string | null
}

export const getServerSideProps: GetServerSideProps<ProfileProps> = async (ctx) => {
  const { username } = ctx.params as { username: string }

  const profileUser = await prisma.user.findFirst({
    where: { OR: [{ username }, { id: username }] },
    select: { id: true, username: true, displayName: true, avatar: true, bio: true },
  })
  if (!profileUser) return { notFound: true }

  const liteforms = await prisma.liteform.findMany({
    where: { userId: profileUser.id, isPublic: true },
    orderBy: { createdAt: "desc" },
    select: liteformSelect,
  })

  const instance = getAuth0Instance(ctx.req)
  const session = await safeGetSession(instance, ctx.req, ctx.res)
  const sessionUsername = (session?.user as Auth0User | undefined)?.nickname ?? null

  return {
    props: { profileUser, liteforms: JSON.parse(JSON.stringify(liteforms)), sessionUsername },
  }
}

export default function Profile({ profileUser, liteforms, sessionUsername }: ProfileProps) {
  const slug = profileUser.username ?? profileUser.id
  const name = profileUser.displayName ?? profileUser.username ?? "Anonymous"

  return (
    <>
      <Head><title>{name} — Liteforms</title></Head>
      <Nav username={sessionUsername} />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
          {profileUser.avatar ? (
            <Image src={profileUser.avatar} alt={name} width={44} height={44} style={{ borderRadius: "50%", border: "1px solid var(--border)" }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--bg-subtle)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "var(--text-3)", fontFamily: "Georgia, serif" }}>◈</div>
          )}
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 500 }}>{name}</h1>
            {profileUser.username && <div style={{ color: "var(--text-3)", fontSize: 12, marginTop: 1 }}>@{profileUser.username}</div>}
            {profileUser.bio && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>{profileUser.bio}</div>}
          </div>
        </div>

        <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 12 }}>
          {liteforms.length} soul{liteforms.length !== 1 ? "s" : ""}
        </div>

        {liteforms.length === 0 ? (
          <p style={{ color: "var(--text-3)", fontSize: 13 }}>No public souls yet.</p>
        ) : (
          <div>
            {liteforms.map((lf, i) => (
              <div key={lf.id} style={{ borderTop: i === 0 ? "1px solid var(--border)" : undefined, borderBottom: "1px solid var(--border-light)" }}>
                <Link href={`/${slug}/${lf.id}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13, color: "var(--text)", marginBottom: 2 }}>
                      {lf.title}
                      {lf.hasVrm && <span className="holo-badge" style={{ marginLeft: 8, fontSize: 9 }}>3D</span>}
                    </div>
                    {lf.description && <div style={{ fontSize: 12, color: "var(--text-2)" }}>{lf.description}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>
                    {new Date(lf.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
