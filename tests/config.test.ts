import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const KEYS = ["CHAT_PROVIDER", "CHAT_BASE_URL", "CHAT_API_KEY", "CHAT_MODEL", "STT_PROVIDER", "STT_BASE_URL", "TTS_PROVIDER", "TTS_BASE_URL", "TTS_SPEAKER"] as const

beforeEach(() => {
  vi.resetModules()
  for (const k of KEYS) delete process.env[k]
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-cfg-"))
})
afterEach(() => {
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true })
  for (const k of KEYS) delete process.env[k]
})

it("无 env 无存储：返回默认值", async () => {
  const { resolveConfig } = await import("@/lib/config")
  const cfg = await resolveConfig()
  expect(cfg.chat.provider).toBe("openai-compatible")
  expect(cfg.stt.baseUrl).toBe("http://127.0.0.1:8100")
  expect(cfg.tts.speaker).toBe("Aiden")
})

it("env 层生效", async () => {
  process.env.CHAT_BASE_URL = "https://api.example.com"
  process.env.TTS_SPEAKER = "Serena"
  const { resolveConfig } = await import("@/lib/config")
  const cfg = await resolveConfig()
  expect(cfg.chat.baseUrl).toBe("https://api.example.com")
  expect(cfg.tts.speaker).toBe("Serena")
})

it("存储层覆盖 env 层（设置页优先）", async () => {
  process.env.CHAT_MODEL = "env-model"
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({ chat: { model: "stored-model" } }))
  const { resolveConfig } = await import("@/lib/config")
  expect((await resolveConfig()).chat.model).toBe("stored-model")
})

it("saveConfig 合并落盘且原子", async () => {
  const { saveConfig, resolveConfig } = await import("@/lib/config")
  await saveConfig({ chat: { model: "m2" }, tts: { speaker: "Ryan" } })
  const raw = JSON.parse(readFileSync(path.join(process.env.DATA_DIR!, "config.json"), "utf-8"))
  expect(raw.chat.model).toBe("m2")
  expect(raw.tts.speaker).toBe("Ryan")
  expect((await resolveConfig()).chat.model).toBe("m2")
})

it("saveConfig 未触及的 env 值仍在解析结果中", async () => {
  process.env.CHAT_BASE_URL = "https://from-env"
  const { saveConfig, resolveConfig } = await import("@/lib/config")
  await saveConfig({ chat: { model: "only-model" } })
  const cfg = await resolveConfig()
  expect(cfg.chat.baseUrl).toBe("https://from-env")
  expect(cfg.chat.model).toBe("only-model")
})

it("maskKey 脱敏", async () => {
  const { maskKey } = await import("@/lib/config")
  expect(maskKey("sk-abcdef1234")).toEqual({ configured: true, tail: "1234" })
  expect(maskKey("")).toEqual({ configured: false, tail: "" })
})
