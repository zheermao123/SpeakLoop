import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { NextRequest } from "next/server"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-set-"))
  for (const k of ["CHAT_PROVIDER", "CHAT_BASE_URL", "CHAT_API_KEY", "CHAT_MODEL"]) delete process.env[k]
})

async function get() {
  const { GET } = await import("@/app/api/settings/route")
  return GET()
}

async function put(body: unknown) {
  const { PUT } = await import("@/app/api/settings/route")
  const req = new Request("http://localhost/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return PUT(req as unknown as NextRequest)
}

it("GET 默认脱敏：无 Key 时 configured=false", async () => {
  const r = await get()
  const j = await r.json()
  expect(j.chat.apiKey).toEqual({ configured: false, tail: "" })
  expect(j.tts.speaker).toBe("Aiden")
})

it("PUT 保存并回显脱敏", async () => {
  const r = await put({ chat: { baseUrl: "https://api.x.com", apiKey: "sk-abcd9999", model: "m" }, tts: { speaker: "Ryan" } })
  const j = await r.json()
  expect(j.chat.apiKey).toEqual({ configured: true, tail: "9999" })
  expect(j.tts.speaker).toBe("Ryan")
  expect(JSON.stringify(j)).not.toContain("sk-abcd9999")
})

it("PUT apiKey 留空保持原值", async () => {
  await put({ chat: { baseUrl: "https://api.x.com", apiKey: "sk-keep123", model: "m" } })
  const r = await put({ chat: { model: "m2", apiKey: "" } })
  const j = await r.json()
  expect(j.chat.model).toBe("m2")
  expect(j.chat.apiKey).toEqual({ configured: true, tail: "p123" })
})

it("非法 provider 返回 400", async () => {
  const r = await put({ chat: { provider: "gpt4all" } })
  expect(r.status).toBe(400)
  expect((await r.json()).error).toBeTruthy()
})
