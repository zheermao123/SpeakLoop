import { NextResponse } from "next/server"
import { resolveConfig } from "@/lib/config"

type Probe = "ready" | "loading" | "offline" | "disabled"

async function probe(baseUrl: string, provider: string): Promise<Probe> {
  if (provider !== "qwen3-local") return "disabled"
  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!r.ok) return "offline"
    const j = (await r.json().catch(() => ({}))) as { model_loaded?: boolean }
    return j.model_loaded === true ? "ready" : "loading"
  } catch {
    return "offline"
  }
}

export async function GET() {
  const cfg = await resolveConfig()
  const [stt, tts] = await Promise.all([
    probe(cfg.stt.baseUrl, cfg.stt.provider),
    probe(cfg.tts.baseUrl, cfg.tts.provider),
  ])
  return NextResponse.json({ stt, tts })
}
