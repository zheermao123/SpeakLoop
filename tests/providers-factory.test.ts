import { afterEach, beforeEach, expect, it, vi } from "vitest"

function freshTypes() {
  vi.resetModules()
  return import("@/lib/providers/types")
}

const KEYS = ["STT_PROVIDER", "TTS_PROVIDER", "CHAT_PROVIDER", "STT_BASE_URL", "TTS_BASE_URL", "CHAT_BASE_URL", "CHAT_API_KEY", "CHAT_MODEL"] as const

beforeEach(() => {
  vi.resetModules()
  for (const k of KEYS) delete process.env[k]
})
afterEach(() => {
  for (const k of KEYS) delete process.env[k]
})

it("默认全 mock", async () => {
  const { getSTT, getChat, getTTS } = await freshTypes()
  expect((await getSTT()).constructor.name).toBe("MockSttProvider")
  expect((await getChat()).constructor.name).toBe("MockChatProvider")
  expect((await getTTS()).constructor.name).toBe("MockTtsProvider")
})

it("qwen3-local 分流", async () => {
  process.env.STT_PROVIDER = "qwen3-local"
  process.env.TTS_PROVIDER = "qwen3-local"
  const { getSTT, getTTS } = await freshTypes()
  expect((await getSTT()).constructor.name).toBe("Qwen3LocalStt")
  expect((await getTTS()).constructor.name).toBe("Qwen3LocalTts")
})

it("openai-compatible 分流", async () => {
  process.env.CHAT_PROVIDER = "openai-compatible"
  process.env.CHAT_BASE_URL = "https://api.example.com/v1"
  process.env.CHAT_API_KEY = "sk-x"
  process.env.CHAT_MODEL = "m1"
  const { getChat } = await freshTypes()
  expect((await getChat()).constructor.name).toBe("OpenAICompatibleChatProvider")
})
