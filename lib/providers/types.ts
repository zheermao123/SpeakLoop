import { resolveConfig } from "@/lib/config"

export interface STTResult {
  text: string
  confidence?: number
  segments?: unknown[]
}

export interface STTProvider {
  transcribe(audio: Blob, options?: { language?: string }): Promise<STTResult>
}

export interface ChatProvider {
  chat(
    system: string,
    messages: { role: "user" | "assistant"; content: string }[]
  ): Promise<string>
  chatStream(
    system: string,
    messages: { role: "user" | "assistant"; content: string }[],
    onDelta: (delta: string) => void
  ): Promise<string>
}

export interface TTSProvider {
  synthesize(text: string, options?: { speaker?: string }): Promise<ArrayBuffer>
}

export async function getSTT(): Promise<STTProvider> {
  const cfg = await resolveConfig()
  if (cfg.stt.provider !== "qwen3-local") {
    throw new Error("语音识别未配置：请在 .env 或设置页配置 STT_PROVIDER=qwen3-local")
  }
  const { Qwen3LocalStt } = await import("@/lib/providers/stt/qwen3-local")
  return new Qwen3LocalStt(cfg.stt.baseUrl)
}

export async function getChat(): Promise<ChatProvider> {
  const cfg = await resolveConfig()
  if (cfg.chat.provider !== "openai-compatible") {
    throw new Error("对话未配置：请在 .env 或设置页配置 CHAT_PROVIDER=openai-compatible")
  }
  if (!cfg.chat.baseUrl || !cfg.chat.model) {
    throw new Error("openai-compatible 需要 CHAT_BASE_URL 与 CHAT_MODEL（apiKey 可空）")
  }
  const { OpenAICompatibleChatProvider } = await import("@/lib/providers/chat/openai-compatible")
  return new OpenAICompatibleChatProvider({ baseUrl: cfg.chat.baseUrl, apiKey: cfg.chat.apiKey, model: cfg.chat.model })
}

export async function getTTS(): Promise<TTSProvider> {
  const cfg = await resolveConfig()
  if (cfg.tts.provider !== "qwen3-local") {
    throw new Error("语音合成未配置：请在 .env 或设置页配置 TTS_PROVIDER=qwen3-local")
  }
  const { Qwen3LocalTts } = await import("@/lib/providers/tts/qwen3-local")
  return new Qwen3LocalTts(cfg.tts.baseUrl)
}
