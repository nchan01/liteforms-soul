import type { User, Liteform, Tag } from "@prisma/client"

export type { User, Liteform, Tag }

export interface Auth0User {
  sub: string
  email: string
  name?: string
  picture?: string
  nickname?: string
}

export interface AuthProps {
  dbUser: User
  auth0User: Auth0User
}

export type LiteformWithAuthor = Liteform & {
  user: Pick<User, "id" | "username" | "displayName" | "avatar">
  tags: { tag: Pick<Tag, "id" | "name"> }[]
}

// The liteform.json manifest schema
export interface LiteformManifest {
  schema_version: "1.0"
  title: string
  description?: string
  author?: string
  tags?: string[]
  has_vrm: boolean
  soul_path: string           // filename of SOUL.md in the bundle
  markdown_files: string[]    // all included .md files
  cover_image?: string        // filename of cover image
  vrm_file?: string           // filename of .vrm file
  recommended_model?: string  // e.g. "OpenClaw", "Claude Code", "Claude API"
  created_at: string          // ISO 8601
}

// Files extracted from an uploaded zip/folder
export interface ParsedBundle {
  manifest: LiteformManifest
  soulContent: string
  markdownFiles: { name: string; content: string }[]
  coverFile?: { name: string; data: Uint8Array; mimeType: string }
  vrmFile?: { name: string; data: Uint8Array }
}

export type LiteformFilter = {
  query?: string
  hasVrm?: boolean
  userId?: string
  sort?: "newest" | "popular" | "downloads"
}

// Blocked filenames per PRD
export const BLOCKED_FILENAMES = ["TOOLS.md", "tools.md"]
export const BLOCKED_PATTERNS = [/\.mcp\./i, /connector/i]
