import { expect, it } from "vitest"
import { OpenAICompatibleChatProvider } from "@/lib/providers/chat/openai-compatible"

const CFG = { baseUrl: "https://api.example.com/v1", apiKey: "sk-test", model: "test-model" }

it("非流式：请求形状正确并返回内容", async () => {
  let url = ""
  let init: RequestInit = {}
  const p = new OpenAICompatibleChatProvider({
    ...CFG,
    fetchImpl: async (u, i) => {
      url = String(u)
      init = i as RequestInit
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "hello there" } }] }),
        text: async () => "",
      } as unknown as Response
    },
  })
  const out = await p.chat("SYS", [{ role: "user", content: "hi" }])
  expect(out).toBe("hello there")
  expect(url).toBe("https://api.example.com/v1/chat/completions")
  expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test")
  const body = JSON.parse(String(init.body))
  expect(body.stream).toBe(false)
  expect(body.messages[0]).toEqual({ role: "system", content: "SYS" })
})

it("流式：解析 SSE 分块并回调增量", async () => {
  const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(
        new TextEncoder().encode(
          sse({ choices: [{ delta: { content: "Hel" } }] }) +
            sse({ choices: [{ delta: { content: "lo." } }] }) +
            "data: [DONE]\n\n"
        )
      )
      c.close()
    },
  })
  const p = new OpenAICompatibleChatProvider({
    ...CFG,
    fetchImpl: async () => ({ ok: true, body, text: async () => "" }) as unknown as Response,
  })
  const deltas: string[] = []
  const full = await p.chatStream("SYS", [{ role: "user", content: "hi" }], d => deltas.push(d))
  expect(deltas).toEqual(["Hel", "lo."])
  expect(full).toBe("Hello.")
})

it("HTTP 错误抛出含状态码", async () => {
  const p = new OpenAICompatibleChatProvider({
    ...CFG,
    fetchImpl: async () => ({ ok: false, status: 401, text: async () => "unauthorized" }) as unknown as Response,
  })
  await expect(p.chat("SYS", [])).rejects.toThrow("401")
})
