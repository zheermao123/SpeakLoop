import { NextRequest } from "next/server"
import { resolveConfig } from "@/lib/config"
import { getTTS } from "@/lib/providers/types"

export async function POST(req: NextRequest) {
  const { text, speaker } = await req.json()
  if (!text) return new Response("text required", { status: 400 })
  const cfg = await resolveConfig()
  const tts = await getTTS()
  const wav = await tts.synthesize(text, { speaker: speaker ?? cfg.tts.speaker })
  return new Response(wav, { headers: { "Content-Type": "audio/wav" } })
}
