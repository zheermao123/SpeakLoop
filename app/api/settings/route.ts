import { NextRequest, NextResponse } from "next/server"
import { AppConfig, maskKey, resolveConfig, saveConfig } from "@/lib/config"

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

function toMasked(cfg: AppConfig) {
  return {
    chat: { provider: cfg.chat.provider, baseUrl: cfg.chat.baseUrl, model: cfg.chat.model, apiKey: maskKey(cfg.chat.apiKey) },
    stt: { provider: cfg.stt.provider, baseUrl: cfg.stt.baseUrl },
    tts: { provider: cfg.tts.provider, baseUrl: cfg.tts.baseUrl, speaker: cfg.tts.speaker },
  }
}

export async function GET() {
  return NextResponse.json(toMasked(await resolveConfig()))
}

export async function PUT(req: NextRequest) {
  const patch = (await req.json()) as DeepPartial<AppConfig>
  const errors: string[] = []
  if (patch.chat?.provider && patch.chat.provider !== "openai-compatible") errors.push("chat.provider 仅支持 openai-compatible")
  if (patch.stt?.provider && patch.stt.provider !== "qwen3-local") errors.push("stt.provider 仅支持 qwen3-local")
  if (patch.tts?.provider && patch.tts.provider !== "qwen3-local") errors.push("tts.provider 仅支持 qwen3-local")
  for (const u of [patch.chat?.baseUrl, patch.stt?.baseUrl, patch.tts?.baseUrl]) {
    if (u && !/^https?:\/\//.test(u)) errors.push("baseUrl 必须以 http:// 或 https:// 开头")
  }
  if (errors.length) return NextResponse.json({ error: errors.join("；") }, { status: 400 })
  if (patch.chat) {
    if (patch.chat.apiKey === "") delete patch.chat.apiKey
    const mergedChat = { ...(await resolveConfig()).chat, ...patch.chat }
    if (mergedChat.provider === "openai-compatible" && (!mergedChat.baseUrl || !mergedChat.model)) {
      return NextResponse.json({ error: "openai-compatible 需要 CHAT_BASE_URL 与 CHAT_MODEL" }, { status: 400 })
    }
  }
  const saved = await saveConfig(patch)
  return NextResponse.json(toMasked(saved))
}
