import { NextRequest } from "next/server"
import { buildSystemPrompt } from "@/lib/prompts"
import { getChat } from "@/lib/providers/types"
import { SentenceStream, stripGoalMarkers, trailingMarkerPrefix } from "@/lib/sentence-stream"
import { getScenario } from "@/lib/services/scenario"
import { listWords, selectForInjection } from "@/lib/services/vocab"

export async function POST(req: NextRequest) {
  const { scenarioId, messages } = await req.json()
  const scenario = await getScenario(scenarioId)
  if (!scenario) return new Response("scenario not found", { status: 404 })
  const vocab = selectForInjection(await listWords())
  const system = buildSystemPrompt(scenario, vocab)
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      const ss = new SentenceStream(s => {
        if (s) send({ type: "sentence", text: s })
      })
      let displayBuf = ""
      let displaySent = 0
      const displayGoals: number[] = []
      try {
        const chat = await getChat()
        const full = await chat.chatStream(system, messages ?? [], d => {
          ss.push(d)
          displayBuf = stripGoalMarkers(displayBuf + d, displayGoals)
          const hold = trailingMarkerPrefix(displayBuf)
          const safe = hold ? displayBuf.slice(0, displayBuf.length - hold) : displayBuf
          if (safe.length > displaySent) {
            send({ type: "delta", text: safe.slice(displaySent) })
            displaySent = safe.length
          }
        })
        ss.flush()
        const reply = full
          .replace(/\[GOAL_DONE:\d+\]/g, "")
          .replace(/ {2,}/g, " ")
          .trim()
        send({ type: "done", goalsDone: ss.goals, reply })
      } catch (e) {
        send({ type: "error", message: (e as Error).message })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  })
}
