import { promises as fs } from "node:fs"
import path from "node:path"

export type Collection = "scenarios" | "sessions" | "vocab"

function dataDir() {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data")
}

function fileOf(c: Collection) {
  return path.join(dataDir(), `${c}.json`)
}

export async function read<T>(c: Collection): Promise<T[]> {
  await fs.mkdir(dataDir(), { recursive: true })
  try {
    return JSON.parse(await fs.readFile(fileOf(c), "utf-8")) as T[]
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return []
    throw e
  }
}

const queues = new Map<Collection, Promise<unknown>>()

export async function update<T>(c: Collection, fn: (data: T[]) => T[]): Promise<T[]> {
  const prev = queues.get(c) ?? Promise.resolve()
  const job = prev.then(async () => {
    const data = await read<T>(c)
    const next = fn(data)
    const tmp = `${fileOf(c)}.${process.pid}.tmp`
    await fs.mkdir(dataDir(), { recursive: true })
    await fs.writeFile(tmp, JSON.stringify(next, null, 2), "utf-8")
    await fs.rename(tmp, fileOf(c))
    return next
  })
  queues.set(c, job.catch(() => undefined))
  return job
}
