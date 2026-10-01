import { NextRequest, NextResponse } from "next/server"
import { parseGoalMarker } from "@/lib/goal-marker"
import { buildSystemPrompt, modeInstruction } from "@/lib/prompts"
import { getChat } from "@/lib/providers/types"
import { getScenario } from "@/lib/services/scenario"
import { listWords, selectForInjection } from "@/lib/services/vocab"

export async function POST(req: NextRequest) {
  const { scenarioId, messages, mode } = await req.json()
  const scenario = await getScenario(scenarioId)
  if (!scenario) return NextResponse.json({ error: "scenario not found" }, { status: 404 })
  const vocab = selectForInjection(await listWords())
  const system = buildSystemPrompt(scenario, vocab) + modeInstruction(mode)
  const chat = await getChat()
  const raw = await chat.chat(system, messages ?? [])
  const { clean, goals } = parseGoalMarker(raw)
  return NextResponse.json({ reply: clean, goalsDone: goals })
}
