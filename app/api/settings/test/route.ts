import { NextRequest, NextResponse } from "next/server"
import { resolveConfig } from "@/lib/config"
import { getChat } from "@/lib/providers/types"

export async function POST(req: NextRequest) {
  const { target } = await req.json()
  const t0 = Date.now()
  try {
    if (target === "chat") {
      const chat = await getChat()
      const reply = await chat.chat(
        "You are a health probe. Reply with the single word: pong.",
        [{ role: "user", content: "ping" }]
      )
      return NextResponse.json({ ok: true, detail: reply.slice(0, 80), ms: Date.now() - t0 })
    }
    const cfg = await resolveConfig()
    const base = target === "stt" ? cfg.stt.baseUrl : cfg.tts.baseUrl
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) })
    const j = await r.json().catch(() => ({}) as Record<string, unknown>)
    return NextResponse.json({
      ok: r.ok,
      detail: `health ${r.status} model_loaded=${String(j.model_loaded ?? "?")}`,
      ms: Date.now() - t0,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, detail: (e as Error).message, ms: Date.now() - t0 })
  }
}
