import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

function freshTypes() {
  vi.resetModules()
  return import("@/lib/providers/types")
}

const KEYS = ["CHAT_PROVIDER", "CHAT_BASE_URL", "CHAT_API_KEY", "CHAT_MODEL", "STT_PROVIDER", "STT_BASE_URL", "TTS_PROVIDER", "TTS_BASE_URL", "TTS_SPEAKER"] as const

beforeEach(() => {
  vi.resetModules()
  for (const k of KEYS) delete process.env[k]
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-fac-"))
})

afterEach(() => {
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true })
  for (const k of KEYS) delete process.env[k]
})

it("qwen3-local 分流", async () => {
  process.env.STT_PROVIDER = "qwen3-local"
  process.env.TTS_PROVIDER = "qwen3-local"
  const { getSTT, getTTS } = await freshTypes()
  expect((await getSTT()).constructor.name).toBe("Qwen3LocalStt")
  expect((await getTTS()).constructor.name).toBe("Qwen3LocalTts")
})

it("openai-compatible 完整 env 分流", async () => {
  process.env.CHAT_PROVIDER = "openai-compatible"
  process.env.CHAT_BASE_URL = "https://api.example.com/v1"
  process.env.CHAT_API_KEY = "sk-x"
  process.env.CHAT_MODEL = "m1"
  const { getChat } = await freshTypes()
  expect((await getChat()).constructor.name).toBe("OpenAICompatibleChatProvider")
})

it("openai-compatible：缺 model 拒绝、缺 apiKey 可通过", async () => {
  process.env.CHAT_PROVIDER = "openai-compatible"
  process.env.CHAT_BASE_URL = "https://api.example.com/v1"
  const { getChat } = await freshTypes()
  await expect(getChat()).rejects.toThrow("CHAT_MODEL")
  process.env.CHAT_MODEL = "m1"
  expect((await getChat()).constructor.name).toBe("OpenAICompatibleChatProvider")
})

it("存储层覆盖 env：工厂读取设置页配置", async () => {
  process.env.STT_PROVIDER = "qwen3-local"
  process.env.STT_BASE_URL = "http://127.0.0.1:9999"
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({ stt: { baseUrl: "http://127.0.0.1:8100" } }))
  const { getSTT } = await freshTypes()
  const stt = await getSTT()
  expect((stt as unknown as { baseUrl: string }).baseUrl).toBe("http://127.0.0.1:8100")
})

it("未知 provider 抛出配置指引", async () => {
  process.env.STT_PROVIDER = "foo"
  process.env.CHAT_PROVIDER = "bar"
  process.env.TTS_PROVIDER = "baz"
  const { getSTT, getChat, getTTS } = await freshTypes()
  await expect(getSTT()).rejects.toThrow("qwen3-local")
  await expect(getChat()).rejects.toThrow("openai-compatible")
  await expect(getTTS()).rejects.toThrow("qwen3-local")
})
