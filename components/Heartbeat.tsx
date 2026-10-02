"use client"

import { useEffect } from "react"

export default function Heartbeat() {
  useEffect(() => {
    const beat = () => fetch("/api/heartbeat", { method: "POST", keepalive: true }).catch(() => {})
    beat()
    const id = setInterval(beat, 5000)
    return () => clearInterval(id)
  }, [])
  return null
}
