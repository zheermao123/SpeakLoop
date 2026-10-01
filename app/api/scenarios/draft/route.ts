import { NextRequest, NextResponse } from "next/server"
import { draftScenario } from "@/lib/services/scenario"

export async function POST(req: NextRequest) {
  const { description } = await req.json()
  if (!description?.trim()) return NextResponse.json({ error: "description required" }, { status: 400 })
  return NextResponse.json(await draftScenario(description))
}
