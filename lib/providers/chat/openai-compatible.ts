import { ChatProvider } from "@/lib/providers/types"

interface ChatCfg {
  baseUrl: string
  apiKey: string
  model: string
  fetchImpl?: typeof fetch
}

export class OpenAICompatibleChatProvider implements ChatProvider {
  private f: typeof fetch
  constructor(private cfg: ChatCfg) {
    this.f = cfg.fetchImpl ?? fetch
  }

  private request(system: string, messages: { role: string; content: string }[], stream: boolean): Promise<Response> {
    return this.f(`${this.cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: this.cfg.model,
        stream,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    })
  }

  async chat(
    system: string,
    messages: { role: "user" | "assistant"; content: string }[]
  ): Promise<string> {
    const r = await this.request(system, messages, false)
    if (!r.ok) throw new Error(`chat ${r.status}: ${await r.text()}`)
    const j = await r.json()
    return j.choices?.[0]?.message?.content ?? ""
  }

  async chatStream(
    system: string,
    messages: { role: "user" | "assistant"; content: string }[],
    onDelta: (delta: string) => void
  ): Promise<string> {
    const r = await this.request(system, messages, true)
    if (!r.ok || !r.body) throw new Error(`chat stream ${r.status}: ${await r.text()}`)
    const reader = (r.body as ReadableStream<Uint8Array>).getReader()
    const dec = new TextDecoder()
    let buf = ""
    let full = ""
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split("\n")
      buf = lines.pop() ?? ""
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith("data:")) continue
        const payload = t.slice(5).trim()
        if (payload === "[DONE]") continue
        try {
          const j = JSON.parse(payload)
          const d = j.choices?.[0]?.delta?.content
          if (d) {
            full += d
            onDelta(d)
          }
        } catch {
          continue
        }
      }
    }
    return full
  }
}
