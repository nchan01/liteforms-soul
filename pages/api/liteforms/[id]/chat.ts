import type { NextApiRequest, NextApiResponse } from "next"
import { getLiteformById } from "lib/liteforms"
import Anthropic from "@anthropic-ai/sdk"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end()

  const { id } = req.query as { id: string }
  const { message, history = [] } = req.body as {
    message: string
    history: Array<{ role: "user" | "assistant"; content: string }>
  }

  if (!message?.trim()) return res.status(400).json({ error: "message required" })

  const lf = await getLiteformById(id)
  if (!lf || !lf.isPublic) return res.status(404).json({ error: "not found" })

  // Stub mode — no real API key
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "placeholder") {
    const stub = `[Test mode — Anthropic API key not configured]\n\nI'm ${lf.title}. ${lf.description ?? "Ask me anything."}`
    return res.json({ reply: stub })
  }

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: lf.soulContent,
      messages: [
        ...history,
        { role: "user", content: message },
      ],
    })

    const reply = response.content[0].type === "text" ? response.content[0].text : ""
    res.json({ reply })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
