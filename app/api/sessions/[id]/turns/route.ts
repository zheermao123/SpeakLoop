import { NextRequest, NextResponse } from "next/server"
import { appendTurn } from "@/lib/services/practice"
import { Turn } from "@/lib/domain/types"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { turn, goalsDone } = await req.json()
  if (!turn?.id || !turn?.userText) {
    return NextResponse.json({ error: "turn with id and userText required" }, { status: 400 })
  }
  try {
    return NextResponse.json(await appendTurn(id, turn as Turn, goalsDone ?? []))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 })
  }
}
