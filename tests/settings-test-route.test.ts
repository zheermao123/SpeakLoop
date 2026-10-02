import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/providers/chat/openai-compatible", async () => {
  const { FakeChatProvider } = await import("./fixtures/fake-providers")
  return { OpenAICompatibleChatProvider: FakeChatProvider }
})

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-tst-"))
  for (const k of ["CHAT_PROVIDER", "CHAT_BASE_URL", "CHAT_API_KEY", "CHAT_MODEL", "STT_BASE_URL", "TTS_BASE_URL"]) delete process.env[k]
})

async function post(body: unknown) {
  const { POST } = await import("@/app/api/settings/test/route")
  const req = new Request("http://localhost/api/settings/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return POST(req as unknown as NextRequest)
}

it("chat 未配置：ok=false 且带指引消息", async () => {
  const r = await post({ target: "chat" })
  expect(r.status).toBe(200)
  const j = await r.json()
  expect(j.ok).toBe(false)
  expect(j.detail).toContain("openai-compatible")
})

it("chat 已配置（vi.mock 假件）：ok=true 带 detail 与耗时", async () => {
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({
    chat: { provider: "openai-compatible", baseUrl: "https://api.x.com", apiKey: "sk-1", model: "m" },
  }))
  const r = await post({ target: "chat" })
  const j = await r.json()
  expect(j.ok).toBe(true)
  expect(j.detail.length).toBeGreaterThan(0)
  expect(j.ms).toBeGreaterThanOrEqual(0)
})

it("stt 不可达：ok=false", async () => {
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({
    stt: { provider: "qwen3-local", baseUrl: "http://127.0.0.1:9" },
  }))
  const r = await post({ target: "stt" })
  const j = await r.json()
  expect(j.ok).toBe(false)
})
