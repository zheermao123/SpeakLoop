import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { ChatProvider } from "@/lib/providers/types"
import { read } from "@/lib/store/json-store"
import { lookupWord } from "@/lib/services/dictionary"

vi.mock("@/lib/providers/chat/openai-compatible", async () => {
  const { FakeChatProvider } = await import("./fixtures/fake-providers")
  return { OpenAICompatibleChatProvider: FakeChatProvider }
})

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-dict-"))
  process.env.CHAT_PROVIDER = "openai-compatible"
  process.env.CHAT_BASE_URL = "https://api.x.com"
  process.env.CHAT_MODEL = "m"
})

function fakeChat(reply: string, calls: string[]): ChatProvider {
  return {
    async chat(_system, messages) {
      calls.push(messages[messages.length - 1].content)
      return reply
    },
    async chatStream() {
      return ""
    },
  }
}

it("未命中→调 LLM→解析并落盘", async () => {
  const calls: string[] = []
  const reply = "```json\n{\"phonetic\":\"/ˈniːɡoʊʃieɪt/\",\"pos\":\"v.\",\"meaning\":\"谈判；协商\",\"example\":\"We negotiated the deal.\"}\n```"
  const e = await lookupWord("Negotiate", "We negotiated the deal.", fakeChat(reply, calls))
  expect(calls).toHaveLength(1)
  expect(e.word).toBe("negotiate")
  expect(e.meaning).toBe("谈判；协商")
  expect((await read("dictionary")).length).toBe(1)
})

it("命中→零 LLM 调用", async () => {
  const calls: string[] = []
  const c = fakeChat("{}", calls)
  await lookupWord("blocker", "", c)
  await lookupWord("blocker", "", c)
  expect(calls).toHaveLength(1)
})

it("解析容错兜底", async () => {
  const e = await lookupWord("odd", "", fakeChat("not json at all", []))
  expect(e.meaning).toContain("odd")
  expect((await read("dictionary")).length).toBe(1)
})

async function post(body: unknown) {
  const { POST } = await import("@/app/api/dictionary/route")
  const req = new Request("http://localhost/api/dictionary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return POST(req as unknown as NextRequest)
}

it("路由 400：缺 word", async () => {
  const r = await post({ sentence: "hello" })
  expect(r.status).toBe(400)
  const j = await r.json()
  expect(j.error).toBe("word required")
})

it("路由 200：entry 形状完整", async () => {
  const r = await post({ word: "Blocker", sentence: "We hit a blocker." })
  expect(r.status).toBe(200)
  const j = await r.json()
  expect(j.word).toBe("blocker")
  expect(typeof j.phonetic).toBe("string")
  expect(typeof j.pos).toBe("string")
  expect(typeof j.meaning).toBe("string")
  expect(typeof j.example).toBe("string")
  expect(j.createdAt).toBeTruthy()
  expect((await read("dictionary")).length).toBe(1)
})
