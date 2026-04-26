import { prisma } from "lib/prisma"
import type { LiteformFilter, LiteformWithAuthor } from "types"

export const liteformSelect = {
  id: true,
  title: true,
  description: true,
  slug: true,
  bundlePrefix: true,
  manifestJson: true,
  soulContent: true,
  markdownFiles: true,
  hasVrm: true,
  vrmFilename: true,
  coverFilename: true,
  coverUrl: true,
  vrmUrl: true,
  isPublic: true,
  viewCount: true,
  downloadCount: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, username: true, displayName: true, avatar: true } },
  tags: { select: { tag: { select: { id: true, name: true } } } },
} as const

export async function listLiteforms(filter: LiteformFilter = {}, page = 1, pageSize = 24) {
  const { query, hasVrm, userId, sort = "newest" } = filter

  const where = {
    isPublic: true,
    ...(hasVrm !== undefined && { hasVrm }),
    ...(userId && { userId }),
    ...(query && {
      OR: [
        { title: { contains: query, mode: "insensitive" as const } },
        { description: { contains: query, mode: "insensitive" as const } },
        { user: { username: { contains: query, mode: "insensitive" as const } } },
        { tags: { some: { tag: { name: { contains: query, mode: "insensitive" as const } } } } },
      ],
    }),
  }

  const orderBy =
    sort === "popular"    ? { viewCount: "desc" as const } :
    sort === "downloads"  ? { downloadCount: "desc" as const } :
    { createdAt: "desc" as const }

  const [liteforms, total] = await Promise.all([
    prisma.liteform.findMany({
      where,
      orderBy,
      select: liteformSelect,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.liteform.count({ where }),
  ])

  return { liteforms, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function getLiteformById(id: string) {
  return prisma.liteform.findUnique({ where: { id }, select: liteformSelect })
}

export async function upsertLiteformTags(liteformId: string, tagNames: string[]) {
  const normalised = tagNames.map(t => t.toLowerCase().trim()).filter(Boolean)
  await Promise.all(normalised.map(name =>
    prisma.tag.upsert({ where: { name }, update: {}, create: { name } })
  ))
  const tags = await prisma.tag.findMany({ where: { name: { in: normalised } } })
  await prisma.liteformTag.deleteMany({ where: { liteformId } })
  await prisma.liteformTag.createMany({
    data: tags.map(t => ({ liteformId, tagId: t.id })),
    skipDuplicates: true,
  })
}

// Slugify a title for URL use
export function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
}
