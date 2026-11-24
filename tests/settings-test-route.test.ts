import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const captured = vi.hoisted(() => [] as Record<string, unknown>[])

vi.mock("@/lib/providers/chat/openai-compatible", () => {
  class FakeProbe {
    cfg: Record<string, unknown>
    constructor(cfg: Record<string, unknown>) {
      this.cfg = cfg
      captured.push(cfg)
    }
    async chat() {
      return "pong"
    }
  }
  return { OpenAICompatibleChatProvider: FakeProbe }
})

beforeEach(() => {
  captured.length = 0
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-test-"))
  process.env.CHAT_PROVIDER = "openai-compatible"
  process.env.CHAT_BASE_URL = "http://saved.local"
  process.env.CHAT_API_KEY = "saved-key"
  process.env.CHAT_MODEL = "saved-model"
})

async function post(payload: Record<string, unknown>) {
  const { POST } = await import("@/app/api/settings/test/route")
  const req = new Request("http://localhost/api/settings/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return POST(req as unknown as NextRequest)
}

it("chat 测试使用表单覆盖值，Key 留空回退已保存值", async () => {
  const res = await post({
    target: "chat",
    chat: { baseUrl: "http://form.local/v1", model: "form-model" },
  })
  const j = await res.json()
  expect(j.ok).toBe(true)
  expect(j.detail).toBe("pong")
  expect(captured[0].baseUrl).toBe("http://form.local/v1")
  expect(captured[0].model).toBe("form-model")
  expect(captured[0].apiKey).toBe("saved-key")
})

it("表单传了 Key 则用表单 Key", async () => {
  await post({
    target: "chat",
    chat: { baseUrl: "http://form.local/v1", model: "form-model", apiKey: "form-key" },
  })
  expect(captured[0].apiKey).toBe("form-key")
})

it("无覆盖时回退已保存配置", async () => {
  const res = await post({ target: "chat" })
  const j = await res.json()
  expect(j.ok).toBe(true)
  expect(captured[0].baseUrl).toBe("http://saved.local")
  expect(captured[0].model).toBe("saved-model")
  expect(captured[0].apiKey).toBe("saved-key")
})

it("非法表单 URL 回退已保存配置", async () => {
  await post({ target: "chat", chat: { baseUrl: "ftp://bad", model: "m" } })
  expect(captured[0].baseUrl).toBe("http://saved.local")
})

it("stt 测试使用表单 baseUrl", async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ model_loaded: true }),
  }))
  vi.stubGlobal("fetch", fetchMock)
  try {
    const res = await post({ target: "stt", stt: { baseUrl: "http://127.0.0.1:9999" } })
    const j = await res.json()
    expect(j.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:9999/health", expect.anything())
  } finally {
    vi.unstubAllGlobals()
  }
})
