import { promises as fs } from "node:fs"
import path from "node:path"

export interface AppConfig {
  chat: { provider: string; baseUrl: string; apiKey: string; model: string }
  stt: { provider: string; baseUrl: string }
  tts: { provider: string; baseUrl: string; speaker: string }
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

const DEFAULTS: AppConfig = {
  chat: { provider: "openai-compatible", baseUrl: "", apiKey: "", model: "" },
  stt: { provider: "qwen3-local", baseUrl: "http://127.0.0.1:8100" },
  tts: { provider: "qwen3-local", baseUrl: "http://127.0.0.1:8101", speaker: "Aiden" },
}

function file() {
  return path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "config.json")
}

async function readStored(): Promise<DeepPartial<AppConfig>> {
  try {
    return JSON.parse(await fs.readFile(file(), "utf-8"))
  } catch {
    return {}
  }
}

function merge(base: AppConfig, patch: DeepPartial<AppConfig>): AppConfig {
  const out = structuredClone(base)
  if (patch.chat) Object.assign(out.chat, patch.chat)
  if (patch.stt) Object.assign(out.stt, patch.stt)
  if (patch.tts) Object.assign(out.tts, patch.tts)
  return out
}

export async function resolveConfig(): Promise<AppConfig> {
  const fromEnv: AppConfig = {
    chat: {
      provider: process.env.CHAT_PROVIDER ?? DEFAULTS.chat.provider,
      baseUrl: process.env.CHAT_BASE_URL ?? "",
      apiKey: process.env.CHAT_API_KEY ?? "",
      model: process.env.CHAT_MODEL ?? "",
    },
    stt: {
      provider: process.env.STT_PROVIDER ?? DEFAULTS.stt.provider,
      baseUrl: process.env.STT_BASE_URL ?? DEFAULTS.stt.baseUrl,
    },
    tts: {
      provider: process.env.TTS_PROVIDER ?? DEFAULTS.tts.provider,
      baseUrl: process.env.TTS_BASE_URL ?? DEFAULTS.tts.baseUrl,
      speaker: process.env.TTS_SPEAKER ?? DEFAULTS.tts.speaker,
    },
  }
  return merge(fromEnv, await readStored())
}

let queue: Promise<unknown> = Promise.resolve()

export async function saveConfig(patch: DeepPartial<AppConfig>): Promise<AppConfig> {
  const job = queue.then(async () => {
    const merged = merge(await resolveConfig(), patch)
    const target = file()
    const tmp = `${target}.${process.pid}.tmp`
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(tmp, JSON.stringify(merged, null, 2), "utf-8")
    await fs.rename(tmp, target)
    return merged
  })
  queue = job.catch(() => undefined)
  return job
}

export function maskKey(key: string): { configured: boolean; tail: string } {
  if (!key) return { configured: false, tail: "" }
  return { configured: true, tail: key.slice(-4) }
}
