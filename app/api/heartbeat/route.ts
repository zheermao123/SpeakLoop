import { NextResponse } from "next/server"
import { getWatchdog } from "@/lib/auto-stop"

export async function POST() {
  getWatchdog().beat()
  return NextResponse.json({ ok: true })
}
