// POST /api/generate-meta — call Claude to suggest title, description, and tags from SOUL.md
import type { NextApiRequest, NextApiResponse } from "next"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end()

  const { soulContent } = req.body as { soulContent: string }
  if (!soulContent) return res.status(400).json({ error: "soulContent is required" })

  // Stub for prototype (no API key)
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "placeholder") {
    return res.status(200).json({
      title: "My AI Agent",
      description: "An AI agent with a unique personality.",
      tags: ["agent", "ai"],
    })
  }

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `You are helping catalog AI agents on a public gallery site called Liteforms.

Here is the agent's SOUL.md:

<soul>
${soulContent.slice(0, 3000)}
</soul>

Return a JSON object with these keys:
- title: short catchy name for the agent (max 60 chars)
- description: one or two sentence description of the agent's personality (max 160 chars)
- tags: array of 3-5 lowercase tag strings

Return only valid JSON, no markdown, no explanation.`,
        },
      ],
    })

    const text = message.content[0].type === "text" ? message.content[0].text : ""
    const parsed = JSON.parse(text.trim())
    return res.status(200).json(parsed)
  } catch (err: any) {
    console.error("generate-meta error:", err)
    return res.status(500).json({ error: "Failed to generate metadata" })
  }
}
