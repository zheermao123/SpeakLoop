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
  if ((process.env.STT_PROVIDER ?? "") !== "qwen3-local") {
    throw new Error("请在 .env 配置 STT_PROVIDER=qwen3-local（本地语音识别服务，Mock 模式已移除）")
  }
  const { Qwen3LocalStt } = await import("@/lib/providers/stt/qwen3-local")
  return new Qwen3LocalStt(process.env.STT_BASE_URL ?? "http://127.0.0.1:8100")
}

export async function getChat(): Promise<ChatProvider> {
  if ((process.env.CHAT_PROVIDER ?? "") !== "openai-compatible") {
    throw new Error("请在 .env 配置 CHAT_PROVIDER=openai-compatible 及 CHAT_BASE_URL / CHAT_API_KEY / CHAT_MODEL（Mock 模式已移除）")
  }
  const baseUrl = process.env.CHAT_BASE_URL
  const apiKey = process.env.CHAT_API_KEY
  const model = process.env.CHAT_MODEL
  if (!baseUrl || !apiKey || !model) {
    throw new Error("CHAT_PROVIDER=openai-compatible 需要 CHAT_BASE_URL / CHAT_API_KEY / CHAT_MODEL 全部配置")
  }
  const { OpenAICompatibleChatProvider } = await import("@/lib/providers/chat/openai-compatible")
  return new OpenAICompatibleChatProvider({ baseUrl, apiKey, model })
}

export async function getTTS(): Promise<TTSProvider> {
  if ((process.env.TTS_PROVIDER ?? "") !== "qwen3-local") {
    throw new Error("请在 .env 配置 TTS_PROVIDER=qwen3-local（本地语音合成服务，Mock 模式已移除）")
  }
  const { Qwen3LocalTts } = await import("@/lib/providers/tts/qwen3-local")
  return new Qwen3LocalTts(process.env.TTS_BASE_URL ?? "http://127.0.0.1:8101")
}
