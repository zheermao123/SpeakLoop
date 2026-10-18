import { NextRequest, NextResponse } from "next/server"
import { translateText } from "@/lib/services/translate"

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 })
  try {
    return NextResponse.json(await translateText(text))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
