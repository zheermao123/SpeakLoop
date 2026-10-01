import { NextRequest, NextResponse } from "next/server"
import { VocabStatus } from "@/lib/domain/types"
import { addWord, deleteWord, listWords, setStatus } from "@/lib/services/vocab"

export async function GET() {
  return NextResponse.json(await listWords())
}

export async function POST(req: NextRequest) {
  const { word, translation, example, sourceSessionId, status } = await req.json()
  if (!word?.trim()) return NextResponse.json({ error: "word required" }, { status: 400 })
  return NextResponse.json(
    await addWord({ word, translation: translation ?? "", example: example ?? "", sourceSessionId: sourceSessionId ?? "", status })
  )
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json()
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 })
  await setStatus(id, status as VocabStatus)
  return new NextResponse(null, { status: 204 })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  await deleteWord(id)
  return new NextResponse(null, { status: 204 })
}
