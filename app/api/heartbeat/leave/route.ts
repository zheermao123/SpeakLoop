import { NextResponse } from "next/server"
import { getWatchdog, LEAVE_GRACE_MS } from "@/lib/auto-stop"

export async function POST() {
  getWatchdog().leave(LEAVE_GRACE_MS)
  return NextResponse.json({ ok: true })
}
