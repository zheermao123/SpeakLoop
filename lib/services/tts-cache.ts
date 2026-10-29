import { createHash } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import { resolveDataDir } from "@/lib/config"

const DEFAULT_CAP_BYTES = 300 * 1024 * 1024

export interface TtsCacheEntry {
  buf: ArrayBuffer
  hit: boolean
}

export interface TtsCache {
  synthesizeCached(opts: {
    text: string
    speaker: string
    instruct?: string | null
    synth: () => Promise<ArrayBuffer>
  }): Promise<TtsCacheEntry>
}

export function cacheKey(text: string, speaker: string, instruct?: string | null) {
  return createHash("sha256").update(`${text}\u0000${speaker}\u0000${instruct ?? ""}`).digest("hex")
}

export function createTtsCache(opts?: { dataDir?: () => string; capBytes?: number }): TtsCache {
  const cap = opts?.capBytes ?? DEFAULT_CAP_BYTES
  const dir = () => path.join(opts?.dataDir?.() ?? resolveDataDir(), "tts-cache")
  const inflight = new Map<string, Promise<ArrayBuffer>>()

  async function readHit(file: string): Promise<ArrayBuffer | null> {
    try {
      const buf = await fs.readFile(file)
      if (buf.length === 0) return null
      await fs.utimes(file, new Date(), new Date()).catch(() => {})
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
    } catch {
      return null
    }
  }

  async function evictIfNeeded(d: string) {
    let entries: { file: string; size: number; mtime: number }[]
    try {
      const names = await fs.readdir(d)
      entries = []
      for (const n of names) {
        if (!n.endsWith(".wav")) continue
        const p = path.join(d, n)
        const st = await fs.stat(p)
        entries.push({ file: p, size: st.size, mtime: st.mtimeMs })
      }
    } catch {
      return
    }
    let total = entries.reduce((s, e) => s + e.size, 0)
    if (total <= cap) return
    entries.sort((a, b) => a.mtime - b.mtime)
    for (const e of entries) {
      if (total <= cap) break
      await fs.unlink(e.file).catch(() => {})
      total -= e.size
    }
  }

  return {
    synthesizeCached(req) {
      const key = cacheKey(req.text, req.speaker, req.instruct)
      const file = path.join(dir(), `${key}.wav`)
      const mapKey = file
      const run = async (): Promise<TtsCacheEntry> => {
        const hit = await readHit(file)
        if (hit) return { buf: hit, hit: true }
        let p = inflight.get(mapKey)
        if (!p) {
          p = (async () => {
            const buf = await req.synth()
            const d = dir()
            await fs.mkdir(d, { recursive: true })
            const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
            await fs.writeFile(tmp, Buffer.from(buf))
            await fs.rename(tmp, file)
            evictIfNeeded(d).catch(() => {})
            return buf
          })().finally(() => inflight.delete(mapKey))
          inflight.set(mapKey, p)
        }
        return { buf: await p, hit: false }
      }
      return run()
    },
  }
}

export const ttsCache = createTtsCache()
