import { expect, it } from "vitest"
import { FakeChatProvider } from "./fixtures/fake-providers"

it("chatStream 分块回调且拼接等于全文", async () => {
  const c = new FakeChatProvider()
  const chunks: string[] = []
  const full = await c.chatStream(
    "You are an English speaking coach.",
    [{ role: "user", content: "hi" }],
    d => chunks.push(d)
  )
  expect(chunks.length).toBeGreaterThanOrEqual(2)
  expect(chunks.join("")).toBe(full)
  expect(full).toContain("Nice to meet you")
})

it("report 分支经流式返回合法 JSON", async () => {
  const c = new FakeChatProvider()
  const full = await c.chatStream(
    "You are a spoken-English report analyzer.",
    [{ role: "user", content: "[abc-123] I go yesterday" }],
    () => {}
  )
  const parsed = JSON.parse(full)
  expect(parsed.corrections[0].turnId).toBe("abc-123")
})
