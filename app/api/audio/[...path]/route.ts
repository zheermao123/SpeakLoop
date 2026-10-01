import { promises as fs } from "node:fs"
import path from "node:path"

const TYPES: Record<string, string> = { ".webm": "audio/webm", ".wav": "audio/wav" }

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params
  const audioDir = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "audio")
  const safe = parts.map(p => path.basename(p))
  const target = path.join(audioDir, ...safe)
  if (!target.startsWith(audioDir)) return new Response("forbidden", { status: 403 })
  const ext = path.extname(target).toLowerCase()
  try {
    const buf = await fs.readFile(target)
    return new Response(buf, { headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream" } })
  } catch {
    return new Response("not found", { status: 404 })
  }
}
