import { NextResponse } from "next/server"
import { getWatchdog } from "@/lib/auto-stop"

export async function POST() {
  getWatchdog().beat()
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const wd = getWatchdog()
  const age = wd.beatAgeMs()
  return NextResponse.json({ armed: wd.armed, ageSec: age < 0 ? null : Math.floor(age / 1000) })
}
