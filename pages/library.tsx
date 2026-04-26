import type { GetServerSideProps } from "next"
import Link from "next/link"
import Head from "next/head"
import Nav from "../src/components/Nav"
import { getAuthPropsFromContext } from "lib/auth0"
import { prisma } from "lib/prisma"
import { liteformSelect } from "lib/liteforms"
import type { AuthProps, LiteformWithAuthor } from "types"

interface LibraryProps extends AuthProps {
  liteforms: LiteformWithAuthor[]
}

export const getServerSideProps: GetServerSideProps<LibraryProps> = async (ctx) => {
  const authProps = await getAuthPropsFromContext(ctx)
  if (!authProps) return { redirect: { permanent: false, destination: "/api/auth/login?returnTo=/library" } }

  const liteforms = await prisma.liteform.findMany({
    where: { userId: authProps.dbUser.id },
    orderBy: { createdAt: "desc" },
    select: liteformSelect,
  })

  return { props: { ...authProps, liteforms: JSON.parse(JSON.stringify(liteforms)) } }
}

export default function Library({ dbUser, liteforms }: LibraryProps) {
  const slug = dbUser.username ?? dbUser.id

  return (
    <>
      <Head><title>My Souls — Liteforms</title></Head>
      <Nav username={dbUser.username} />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
          <h1>My Souls</h1>
          <Link href="/upload" className="btn-solid">+ Upload soul</Link>
        </div>

        {liteforms.length === 0 ? (
          <p style={{ color: "var(--text-3)", fontSize: 13 }}>
            No souls yet. <Link href="/upload">Upload your first one.</Link>
          </p>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "6px 10px", fontWeight: 500, color: "var(--text-2)", fontSize: 12 }}>Title</th>
                <th style={{ padding: "6px 10px", fontWeight: 500, color: "var(--text-2)", fontSize: 12 }}>Status</th>
                <th style={{ padding: "6px 10px", fontWeight: 500, color: "var(--text-2)", fontSize: 12 }}>Views</th>
                <th style={{ padding: "6px 10px", fontWeight: 500, color: "var(--text-2)", fontSize: 12 }}>Downloads</th>
                <th style={{ padding: "6px 10px", fontWeight: 500, color: "var(--text-2)", fontSize: 12 }}>Date</th>
                <th style={{ padding: "6px 10px" }}></th>
              </tr>
            </thead>
            <tbody>
              {liteforms.map(lf => (
                <tr key={lf.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "8px 10px" }}>
                    <Link href={`/${slug}/${lf.id}`}>{lf.title}</Link>
                    {lf.hasVrm && <span className="holo-badge" style={{ marginLeft: 6, fontSize: 9 }}>3D</span>}
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--text-2)", fontSize: 12 }}>
                    {lf.isPublic ? "public" : "private"}
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--text-3)" }}>{lf.viewCount}</td>
                  <td style={{ padding: "8px 10px", color: "var(--text-3)" }}>{lf.downloadCount}</td>
                  <td style={{ padding: "8px 10px", color: "var(--text-3)", fontSize: 12 }}>
                    {new Date(lf.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <Link href={`/edit/${lf.id}`} style={{ fontSize: 12, color: "var(--text-2)" }}>edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
