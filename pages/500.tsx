import Link from "next/link"
import Head from "next/head"

export default function ServerError() {
  return (
    <>
      <Head><title>500 — Liteforms</title></Head>
      <div style={{ maxWidth: 500, margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#bbb", marginBottom: 8 }}>500</p>
        <h1 style={{ fontSize: 16, fontWeight: 500, marginBottom: 10 }}>Something went wrong</h1>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>The server encountered an error.</p>
        <Link href="/" className="btn">← Back to gallery</Link>
      </div>
    </>
  )
}
