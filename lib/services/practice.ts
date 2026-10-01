import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import { Report, Session, Turn } from "@/lib/domain/types"
import { read, update } from "@/lib/store/json-store"

export function newId(): string {
  return randomUUID()
}

export async function createSession(scenarioId: string): Promise<Session> {
  const session: Session = {
    id: newId(),
    scenarioId,
    startedAt: new Date().toISOString(),
    turns: [],
  }
  await update<Session>("sessions", d => [...d, session])
  return session
}

export async function getSession(id: string): Promise<Session | undefined> {
  return (await read<Session>("sessions")).find(s => s.id === id)
}

export async function listSessions(): Promise<Session[]> {
  return (await read<Session>("sessions")).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export async function appendTurn(sessionId: string, turn: Turn, goalsDone: number[] = []): Promise<Session> {
  const result = await update<Session>("sessions", list =>
    list.map(s => {
      if (s.id !== sessionId) return s
      const turns = [...s.turns.filter(t => t.id !== turn.id), turn].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      )
      const goalProgress = Array.from(new Set([...(s.goalProgress ?? []), ...goalsDone]))
      return { ...s, turns, goalProgress }
    })
  )
  const session = result.find(s => s.id === sessionId)
  if (!session) throw new Error("session not found")
  return session
}

export async function endSession(id: string): Promise<void> {
  await update<Session>("sessions", list =>
    list.map(s => (s.id === id ? { ...s, endedAt: new Date().toISOString() } : s))
  )
}

export async function saveReport(sessionId: string, report: Report): Promise<void> {
  await update<Session>("sessions", list =>
    list.map(s => (s.id === sessionId ? { ...s, report } : s))
  )
}

export async function saveAudio(sessionId: string, turnId: string, buf: Buffer): Promise<string> {
  const dir = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "audio", sessionId)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, `${turnId}.webm`), buf)
  return `/api/audio/${sessionId}/${turnId}.webm`
}
