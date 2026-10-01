import { MockChatProvider } from "@/lib/providers/chat/mock"
import { MockSttProvider } from "@/lib/providers/stt/mock"
import { MockTtsProvider } from "@/lib/providers/tts/mock"

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
}

export interface TTSProvider {
  synthesize(text: string, options?: { speaker?: string }): Promise<ArrayBuffer>
}

export function getSTT(): STTProvider {
  return new MockSttProvider()
}

export function getChat(): ChatProvider {
  return new MockChatProvider()
}

export function getTTS(): TTSProvider {
  return new MockTtsProvider()
}
