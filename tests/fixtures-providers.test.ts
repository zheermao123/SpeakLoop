import { expect, it } from "vitest"
import { FakeChatProvider, FakeSttProvider, FakeTtsProvider } from "./fixtures/fake-providers"

it("mock STT 返回固定文本", async () => {
  const r = await new FakeSttProvider().transcribe(new Blob(["x"]))
  expect(r.text).toContain("mock")
})

it("mock Chat 对话流带 GOAL_DONE 标记", async () => {
  const c = new FakeChatProvider()
  const sys = "You are an English speaking coach."
  const m1 = await c.chat(sys, [{ role: "user", content: "hi" }])
  expect(m1).not.toContain("[GOAL_DONE")
  const m2 = await c.chat(sys, [
    { role: "user", content: "hi" }, { role: "assistant", content: m1 },
    { role: "user", content: "second" },
  ])
  expect(m2).toContain("[GOAL_DONE:0]")
})

it("mock Chat 报告流返回合法 JSON 且引用 turnId", async () => {
  const out = await new FakeChatProvider().chat("You are a spoken-English report analyzer.", [
    { role: "user", content: "[abc-123] I go yesterday" },
  ])
  const parsed = JSON.parse(out)
  expect(parsed.corrections[0].turnId).toBe("abc-123")
  expect(parsed.corrections[0].original).toBe("I go yesterday")
  expect(Array.isArray(parsed.highlights)).toBe(true)
})

it("mock TTS 返回 WAV 头", async () => {
  const buf = await new FakeTtsProvider().synthesize("hello")
  const v = new DataView(buf)
  expect(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3))).toBe("RIFF")
  expect(buf.byteLength).toBeGreaterThan(44)
})
