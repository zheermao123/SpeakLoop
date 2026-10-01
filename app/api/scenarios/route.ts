import { NextRequest, NextResponse } from "next/server"
import { createScenario, listScenarios } from "@/lib/services/scenario"

export async function GET() {
  return NextResponse.json(await listScenarios())
}

export async function POST(req: NextRequest) {
  const { title, persona, goals, difficulty } = await req.json()
  if (!title || !persona || !Array.isArray(goals) || goals.length === 0) {
    return NextResponse.json({ error: "title, persona, non-empty goals required" }, { status: 400 })
  }
  return NextResponse.json(await createScenario({ title, persona, goals, difficulty: difficulty ?? "medium" }))
}
