import { NextRequest, NextResponse } from "next/server"
import { createSession, listSessions } from "@/lib/services/practice"

export async function GET() {
  return NextResponse.json(await listSessions())
}

export async function POST(req: NextRequest) {
  const { scenarioId } = await req.json()
  if (!scenarioId) return NextResponse.json({ error: "scenarioId required" }, { status: 400 })
  return NextResponse.json(await createSession(scenarioId))
}
