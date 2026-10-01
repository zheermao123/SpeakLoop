import { STTProvider, STTResult } from "@/lib/providers/types"

export class Qwen3LocalStt implements STTProvider {
  private f: typeof fetch
  constructor(private baseUrl: string, fetchImpl?: typeof fetch) {
    this.f = fetchImpl ?? fetch
  }

  async transcribe(audio: Blob, _options?: { language?: string }): Promise<STTResult> {
    const fd = new FormData()
    fd.set("file", audio, "turn.webm")
    const r = await this.f(`${this.baseUrl.replace(/\/$/, "")}/stt`, { method: "POST", body: fd })
    if (!r.ok) throw new Error(`stt failed: ${r.status}`)
    const j = await r.json()
    return { text: String(j.text ?? "") }
  }
}
