import Head from "next/head"
import Link from "next/link"
import Nav from "../src/components/Nav"

export default function Guide() {
  return (
    <>
      <Head><title>How to install a soul — Liteforms</title></Head>
      <Nav username={null} />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 80px" }}>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 20 }}>
          <Link href="/">Gallery</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span>Guide</span>
        </div>

        <h1 style={{ marginBottom: 6 }}>How to install a soul</h1>
        <p style={{ color: "var(--text-3)", fontSize: 13, marginTop: 8, marginBottom: 32 }}>
          A liteform is a bundle of files that defines an AI character. Here's how to bring one into your OpenClaw instance.
        </p>

        <hr />

        {/* Step 1 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
            Step 1 — Download the bundle
          </div>
          <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.7 }}>
            On any soul's page, click <strong style={{ color: "var(--text)" }}>Download bundle .zip</strong>. The zip contains everything you need:
          </p>
          <ul style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 2, paddingLeft: "1.4em" }}>
            <li><code>SOUL.md</code> — the character definition the AI reads</li>
            <li><code>liteform.json</code> — manifest with metadata</li>
            <li><code>*.vrm</code> — 3D avatar file, if the soul includes one</li>
          </ul>
        </div>

        {/* Step 2 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
            Step 2 — Add to your project
          </div>
          <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.7, marginBottom: 12 }}>
            Unzip the bundle and place the files in your project root:
          </p>
          <pre style={{ fontFamily: "'Courier New', monospace", fontSize: 12, background: "var(--bg-subtle)", border: "1px solid var(--border)", padding: "12px 14px", color: "var(--text-2)", lineHeight: 1.9 }}>{`your-project/
├── SOUL.md            ← character definition
├── liteform.json      ← manifest
├── character.vrm      ← 3D avatar (if included)
├── CLAUDE.md          ← your existing instructions
└── ... your other files`}</pre>
        </div>

        {/* Step 3 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
            Step 3 — Tell your AI to read it
          </div>
          <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.7, marginBottom: 12 }}>
            Add one line to your <code>CLAUDE.md</code> so the AI loads the character on every session:
          </p>
          <pre style={{ fontFamily: "'Courier New', monospace", fontSize: 12, background: "var(--bg-subtle)", border: "1px solid var(--border)", padding: "12px 14px", color: "var(--text-2)", lineHeight: 1.7 }}>{`Read SOUL.md and adopt the persona described there.`}</pre>
        </div>

        {/* Step 4 — OpenClaw specific */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
            Step 4 — Load in OpenClaw (if using a 3D soul)
          </div>
          <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.7 }}>
            If the soul includes a <code>.vrm</code> file, OpenClaw can render the character in 3D alongside your conversation.
            Open OpenClaw, go to <strong style={{ color: "var(--text)" }}>Settings → Avatar</strong>, and point it at the <code>.vrm</code> file in your project folder.
            The character will appear as soon as OpenClaw reads the SOUL.md.
          </p>
        </div>

        <hr />

        {/* Tips */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>
            Tips
          </div>
          <ul style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 2.1, paddingLeft: "1.4em" }}>
            <li>You can edit <code>SOUL.md</code> to customise the character for your project.</li>
            <li>Different LLMs interpret souls differently — check the <strong style={{ color: "var(--text)" }}>Recommended for</strong> label on each soul's page.</li>
            <li>Souls work with Claude Code, the Claude API, and any Anthropic-powered app that can read files.</li>
            <li>Keep <code>SOUL.md</code> in the root of your project so your AI tool finds it automatically.</li>
          </ul>
        </div>

        <hr />

        <div style={{ fontSize: 12, color: "var(--text-3)" }}>
          Questions or issues?{" "}
          <a href="https://lookingglassfactory.com" style={{ color: "var(--text-2)" }}>
            Get in touch with Looking Glass Factory
          </a>
          {" · "}
          <Link href="/" style={{ color: "var(--text-2)" }}>Back to gallery</Link>
        </div>
      </div>
    </>
  )
}
