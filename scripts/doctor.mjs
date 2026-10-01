import { access, writeFile, unlink, mkdir } from "node:fs/promises"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const run = promisify(execFile)
const results = []
const check = (name, ok, detail = "") => results.push({ name, ok, detail })

const [major] = process.versions.node.split(".").map(Number)
check("Node >= 20", major >= 20, `v${process.versions.node}`)

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data")
try {
  await mkdir(path.join(dataDir, "audio"), { recursive: true })
  const probe = path.join(dataDir, ".write-probe")
  await writeFile(probe, "ok")
  await unlink(probe)
  check("数据目录可写", true, dataDir)
} catch (e) {
  check("数据目录可写", false, String(e))
}

const services = [
  { name: "asr-server /health", base: process.env.STT_BASE_URL ?? "http://127.0.0.1:8100" },
  { name: "tts-server /health", base: process.env.TTS_BASE_URL ?? "http://127.0.0.1:8101" },
]
for (const s of services) {
  try {
    const r = await fetch(`${s.base}/health`)
    check(s.name, r.ok, `${s.base} -> ${r.status}`)
  } catch {
    check(s.name, false, `${s.base} 不可达（文字模式仍可用）`)
  }
}

try {
  const { stdout } = await run("nvidia-smi", ["--query-gpu=name,memory.total,memory.used", "--format=csv,noheader"])
  check("GPU", true, stdout.trim())
} catch {
  check("GPU", false, "nvidia-smi 不可用")
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name} ${r.detail}`)
process.exit(results.every(r => r.ok) ? 0 : 1)
