import { TTSProvider } from "@/lib/providers/types"

export class Qwen3LocalTts implements TTSProvider {
  private f: typeof fetch
  constructor(private baseUrl: string, fetchImpl?: typeof fetch) {
    this.f = fetchImpl ?? fetch
  }

  async synthesize(text: string, options?: { speaker?: string }): Promise<ArrayBuffer> {
    const r = await this.f(`${this.baseUrl.replace(/\/$/, "")}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speaker: options?.speaker ?? "Aiden" }),
    })
    if (!r.ok) throw new Error(`tts failed: ${r.status}`)
    return r.arrayBuffer()
  }
}
