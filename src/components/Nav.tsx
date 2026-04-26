import Link from "next/link"
import { useEffect, useState } from "react"

interface NavProps {
  username?: string | null
}

export default function Nav({ username }: NavProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const saved = (localStorage.getItem("lf-theme") as "light" | "dark") || "light"
    setTheme(saved)
  }, [])

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light"
    setTheme(next)
    localStorage.setItem("lf-theme", next)
    document.documentElement.setAttribute("data-theme", next)
  }

  return (
    <nav style={{
      borderBottom: "1px solid var(--border)",
      padding: "10px 20px",
      display: "flex",
      alignItems: "center",
      gap: 20,
      background: "var(--nav-bg)",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      <Link href="/" style={{ fontWeight: 600, fontSize: 13, letterSpacing: "-0.01em", color: "var(--text)" }}>
        Liteforms
      </Link>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13 }}>
        <Link href="/" style={{ color: "var(--text-2)" }}>Gallery</Link>
        {username ? (
          <>
            <Link href="/library" style={{ color: "var(--text-2)" }}>My Agents</Link>
            <Link href="/upload" className="btn-solid" style={{ padding: "4px 12px", fontSize: 12 }}>
              + Upload
            </Link>
            <Link href="/settings" style={{ color: "var(--text-2)" }}>Settings</Link>
            <Link href="/api/auth/logout" style={{ color: "var(--text-3)", fontSize: 12 }}>Sign out</Link>
          </>
        ) : (
          <>
            <Link href="/api/auth/login?signup=1" style={{ color: "var(--text-2)" }}>Sign up</Link>
            <Link href="/api/auth/login" className="btn-solid" style={{ padding: "4px 12px", fontSize: 12 }}>
              Sign in
            </Link>
          </>
        )}
        <button onClick={toggleTheme} className="theme-toggle" title="Toggle theme">
          {theme === "light" ? "Dark" : "Light"}
        </button>
      </div>
    </nav>
  )
}
