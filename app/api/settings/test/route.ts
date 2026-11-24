import { NextRequest, NextResponse } from "next/server"
import { resolveConfig } from "@/lib/config"
import { OpenAICompatibleChatProvider } from "@/lib/providers/chat/openai-compatible"

type TestBody = {
  target?: string
  chat?: { baseUrl?: string; model?: string; apiKey?: string }
  stt?: { baseUrl?: string }
  tts?: { baseUrl?: string }
}

const validUrl = (u?: string) => (u && /^https?:\/\//.test(u.trim()) ? u.trim() : undefined)

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as TestBody
  const target = body.target ?? "chat"
  const t0 = Date.now()
  try {
    const cfg = await resolveConfig()
    if (target === "chat") {
      const baseUrl = validUrl(body.chat?.baseUrl) ?? cfg.chat.baseUrl
      const model = body.chat?.model?.trim() || cfg.chat.model
      const apiKey = body.chat?.apiKey || cfg.chat.apiKey
      if (!baseUrl || !model) {
        return NextResponse.json({ ok: false, detail: "openai-compatible 需要 BaseURL 与 Model", ms: Date.now() - t0 })
      }
      const chat = new OpenAICompatibleChatProvider({ baseUrl, apiKey, model, headers: cfg.chat.headers })
      const reply = await chat.chat("You are a health probe. Reply with the single word: pong.", [
        { role: "user", content: "ping" },
      ])
      return NextResponse.json({ ok: true, detail: reply.slice(0, 80), ms: Date.now() - t0 })
    }
    if (target === "stt" || target === "tts") {
      const override = validUrl(target === "stt" ? body.stt?.baseUrl : body.tts?.baseUrl)
      const base = (override ?? (target === "stt" ? cfg.stt.baseUrl : cfg.tts.baseUrl)).replace(/\/$/, "")
      const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) })
      const j = await r.json().catch(() => ({}) as Record<string, unknown>)
      return NextResponse.json({
        ok: r.ok,
        detail: `health ${r.status} model_loaded=${String(j.model_loaded ?? "?")}`,
        ms: Date.now() - t0,
      })
    }
    return NextResponse.json({ ok: false, detail: "unknown target", ms: Date.now() - t0 })
  } catch (e) {
    return NextResponse.json({ ok: false, detail: (e as Error).message, ms: Date.now() - t0 })
  }
}
