"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { VoiceProbe } from "@/lib/voice-status"

export interface VoiceStatus {
  stt: VoiceProbe
  tts: VoiceProbe
  ready: boolean
  loading: boolean
  busyElapsed: { stt: number; tts: number }
  refresh: () => void
}

export function useVoiceStatus(): VoiceStatus {
  const [probes, setProbes] = useState<{ stt: VoiceProbe; tts: VoiceProbe }>({
    stt: "loading",
    tts: "loading",
  })
  const [now, setNow] = useState(() => Date.now())
  const [refreshKey, setRefreshKey] = useState(0)
  const since = useRef<{ stt?: number; tts?: number }>({})

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    let stopped = false
    let quick = 2
    let quickTimer: ReturnType<typeof setTimeout> | null = null
    const poll = async () => {
      try {
        const r = await fetch("/api/voice-status")
        if (!r.ok) return
        const j: { stt: VoiceProbe; tts: VoiceProbe } = await r.json()
        if (stopped) return
        setProbes(j)
        setNow(Date.now())
        const allOff = (j.stt === "offline" || j.stt === "disabled") && (j.tts === "offline" || j.tts === "disabled")
        if (allOff && quick > 0) {
          quick -= 1
          quickTimer = setTimeout(poll, 1500)
        }
        for (const k of ["stt", "tts"] as const) {
          if (j[k] === "loading" && !since.current[k]) since.current[k] = Date.now()
          if (j[k] !== "loading") since.current[k] = undefined
        }
      } catch {
        if (stopped) return
        setProbes({ stt: "offline", tts: "offline" })
        since.current = {}
      }
    }
    poll()
    const timer = setInterval(poll, 10000)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      stopped = true
      clearInterval(timer)
      clearInterval(tick)
      if (quickTimer) clearTimeout(quickTimer)
    }
  }, [refreshKey])

  const elapsed = (key: "stt" | "tts") =>
    since.current[key] ? Math.floor((now - since.current[key]!) / 1000) : 0

  return {
    stt: probes.stt,
    tts: probes.tts,
    ready: probes.stt === "ready" && probes.tts === "ready",
    loading: probes.stt === "loading" || probes.tts === "loading",
    busyElapsed: { stt: elapsed("stt"), tts: elapsed("tts") },
    refresh,
  }
}
