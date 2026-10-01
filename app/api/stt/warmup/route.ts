import { NextResponse } from "next/server"

export async function POST() {
  if ((process.env.STT_PROVIDER ?? "mock") !== "qwen3-local") {
    return NextResponse.json({ ok: true })
  }
  try {
    const base = process.env.STT_BASE_URL ?? "http://127.0.0.1:8100"
    const r = await fetch(`${base}/warmup`, { method: "POST", signal: AbortSignal.timeout(90000) })
    return NextResponse.json({ ok: r.ok })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
