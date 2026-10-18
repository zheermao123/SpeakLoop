"use client"

import { useEffect } from "react"

export default function Heartbeat() {
  useEffect(() => {
    const beat = () => fetch("/api/heartbeat", { method: "POST", keepalive: true }).catch(() => {})
    const leave = () => {
      navigator.sendBeacon("/api/heartbeat/leave")
    }
    beat()
    const id = setInterval(beat, 5000)
    window.addEventListener("pagehide", leave)
    return () => {
      clearInterval(id)
      window.removeEventListener("pagehide", leave)
    }
  }, [])
  return null
}
