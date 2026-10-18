import { NextRequest, NextResponse } from "next/server"
import { lookupWord } from "@/lib/services/dictionary"

export async function POST(req: NextRequest) {
  const { word, sentence } = await req.json()
  if (!word?.trim()) return NextResponse.json({ error: "word required" }, { status: 400 })
  try {
    return NextResponse.json(await lookupWord(word, sentence ?? ""))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
