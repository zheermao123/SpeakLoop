import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { getSTT } from "@/lib/providers/types"
import { saveAudio } from "@/lib/services/practice"

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const sessionId = String(form.get("sessionId") ?? "")
  const file = form.get("audio") as File | null
  if (!sessionId || !file) return NextResponse.json({ error: "sessionId and audio required" }, { status: 400 })
  const buf = Buffer.from(await file.arrayBuffer())
  const turnId = randomUUID()
  let audioUrl: string | undefined
  try {
    audioUrl = await saveAudio(sessionId, turnId, buf)
  } catch {
    audioUrl = undefined
  }
  const stt = await getSTT()
  const result = await stt.transcribe(new Blob([buf]))
  return NextResponse.json({
    turnId,
    text: result.text,
    audioUrl,
    sttProvider: process.env.STT_PROVIDER ?? "mock",
  })
}
