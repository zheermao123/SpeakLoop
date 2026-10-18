import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { createServer } from "node:http"
import { afterEach, beforeEach, expect, it } from "vitest"

let srv: ReturnType<typeof createServer> | null = null
let port = 0

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-vs-"))
  for (const k of ["STT_PROVIDER", "STT_BASE_URL", "TTS_PROVIDER", "TTS_BASE_URL"]) delete process.env[k]
})

afterEach(async () => {
  await new Promise<void>(r => srv?.close(() => r()) ?? r())
  srv = null
})

function fakeHealth(loaded: boolean) {
  srv = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ status: "ok", role: "asr", model_loaded: loaded }))
  })
  return new Promise<void>(resolve => srv!.listen(0, "127.0.0.1", () => resolve()))
}

async function get() {
  const { GET } = await import("@/app/api/voice-status/route")
  return GET()
}

it("health 可达且已载 → ready", async () => {
  await fakeHealth(true)
  const addr = srv!.address() as { port: number }
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({
    stt: { provider: "qwen3-local", baseUrl: `http://127.0.0.1:${addr.port}` },
  }))
  const j = await (await get()).json()
  expect(j.stt).toBe("ready")
})

it("health 可达未载 → loading", async () => {
  await fakeHealth(false)
  const addr = srv!.address() as { port: number }
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({
    stt: { provider: "qwen3-local", baseUrl: `http://127.0.0.1:${addr.port}` },
  }))
  const j = await (await get()).json()
  expect(j.stt).toBe("loading")
})

it("health 不可达 → offline（失败可见）", async () => {
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({
    tts: { provider: "qwen3-local", baseUrl: "http://127.0.0.1:9" },
  }))
  const j = await (await get()).json()
  expect(j.tts).toBe("offline")
})

it("provider 非 qwen3-local → disabled", async () => {
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({
    stt: { provider: "future-provider", baseUrl: "http://127.0.0.1:1" },
  }))
  const j = await (await get()).json()
  expect(j.stt).toBe("disabled")
})
