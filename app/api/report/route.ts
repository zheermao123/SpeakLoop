import { NextRequest, NextResponse } from "next/server"
import { generateReport, ReportParseError } from "@/lib/services/report"

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json()
  try {
    const report = await generateReport(sessionId)
    return NextResponse.json(report)
  } catch (e) {
    if (e instanceof ReportParseError) return NextResponse.json({ error: "parse", raw: e.raw }, { status: 422 })
    return NextResponse.json({ error: (e as Error).message }, { status: 404 })
  }
}
