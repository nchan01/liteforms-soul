import Link from "next/link"
import Head from "next/head"
import Nav from "../src/components/Nav"

export default function NotFound() {
  return (
    <>
      <Head><title>404 — Liteforms</title></Head>
      <Nav username={null} />
      <div style={{ maxWidth: 500, margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8 }}>404</p>
        <h1 style={{ fontSize: 16, fontWeight: 500, marginBottom: 10 }}>Page not found</h1>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginBottom: 20 }}>This soul doesn't exist or has been removed.</p>
        <Link href="/" className="btn">← Back to gallery</Link>
      </div>
    </>
  )
}
