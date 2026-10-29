import { NextRequest } from "next/server"
import { resolveConfig } from "@/lib/config"
import { ttsCache } from "@/lib/services/tts-cache"
import { getTTS } from "@/lib/providers/types"

export async function POST(req: NextRequest) {
  const { text, speaker, instruct } = await req.json()
  if (!text) return new Response("text required", { status: 400 })
  const cfg = await resolveConfig()
  const tts = await getTTS()
  const { buf, hit } = await ttsCache.synthesizeCached({
    text,
    speaker: speaker ?? cfg.tts.speaker,
    instruct,
    synth: () => tts.synthesize(text, { speaker: speaker ?? cfg.tts.speaker }),
  })
  return new Response(buf, { headers: { "Content-Type": "audio/wav", "X-TTS-Cache": hit ? "hit" : "miss" } })
}
