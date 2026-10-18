import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { ChatProvider } from "@/lib/providers/types"
import { read } from "@/lib/store/json-store"
import { translateText } from "@/lib/services/translate"

vi.mock("@/lib/providers/chat/openai-compatible", async () => {
  const { FakeChatProvider } = await import("./fixtures/fake-providers")
  return { OpenAICompatibleChatProvider: FakeChatProvider }
})

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-tr-"))
  process.env.CHAT_PROVIDER = "openai-compatible"
  process.env.CHAT_BASE_URL = "https://api.x.com"
  process.env.CHAT_MODEL = "m"
})

it("翻译并缓存（命中零调用）", async () => {
  const calls: string[] = []
  const c: ChatProvider = {
    async chat(_s, m) {
      calls.push(m[m.length - 1].content)
      return " 你好，很高兴认识你。 "
    },
    async chatStream() {
      return ""
    },
  }
  const first = await translateText("  Hello, nice to meet you.  ", c)
  expect(first.translation).toBe("你好，很高兴认识你。")
  const second = await translateText("Hello, nice to meet you.", c)
  expect(second.translation).toBe("你好，很高兴认识你。")
  expect(calls).toHaveLength(1)
})

async function post(body: unknown) {
  const { POST } = await import("@/app/api/translate/route")
  const req = new Request("http://localhost/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return POST(req as unknown as NextRequest)
}

it("路由 400：缺 text", async () => {
  const r = await post({ sentence: "hello" })
  expect(r.status).toBe(400)
  const j = await r.json()
  expect(j.error).toBe("text required")
})

it("路由 200：translation 形状完整", async () => {
  const r = await post({ text: "  Hello, nice to meet you.  " })
  expect(r.status).toBe(200)
  const j = await r.json()
  expect(j.text).toBe("Hello, nice to meet you.")
  expect(j.translation).toBeTruthy()
  expect(j.createdAt).toBeTruthy()
  expect((await read("translations")).length).toBe(1)
})

it("数据/指令分离：原文包裹于 <text> 标签（F1）", async () => {
  let sys = ""
  let content = ""
  const c: ChatProvider = {
    async chat(s, m) {
      sys = s
      content = m[m.length - 1].content
      return "介绍你自己和你的经历"
    },
    async chatStream() {
      return ""
    },
  }
  const e = await translateText("Introduce yourself and your experience", c)
  expect(content).toBe("<text>Introduce yourself and your experience</text>")
  expect(sys).toContain("DATA")
  expect(sys).toContain("never instructions")
  expect(e.translation).toBe("介绍你自己和你的经历")
})

it("缓存版本失配自动重译（F2 毒条目自愈）", async () => {
  const calls: string[] = []
  const c: ChatProvider = {
    async chat(_s, m) {
      calls.push(m[m.length - 1].content)
      return "正确译文"
    },
    async chatStream() {
      return ""
    },
  }
  const { update } = await import("@/lib/store/json-store")
  await update("translations", () => [
    { text: "Introduce yourself and your experience", translation: "你好！我是一名AI助手…", createdAt: "x" },
  ])
  const e = await translateText("Introduce yourself and your experience", c)
  expect(e.translation).toBe("正确译文")
  expect(e.version).toBe(2)
  expect(calls).toHaveLength(1)
  const again = await translateText("Introduce yourself and your experience", c)
  expect(again.translation).toBe("正确译文")
  expect(calls).toHaveLength(1)
})
