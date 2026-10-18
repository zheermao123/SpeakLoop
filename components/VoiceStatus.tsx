"use client"

import { CheckCircle, CircleNotch, SpeakerSlash, Warning } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import { lineStatus } from "@/lib/voice-status"

type Probe = "ready" | "loading" | "offline" | "disabled"

const HINTS: Record<string, string> = {
  offline: "——双击启动器恢复，或查 logs/",
  error: "——建议停止后重启",
}

function Row({ name, probe, elapsed }: { name: string; probe: Probe; elapsed: number }) {
  const s = lineStatus(probe, elapsed)
  const hint = HINTS[s.level] ?? ""
  const icon =
    s.level === "ready" ? <CheckCircle size={16} weight="fill" aria-hidden="true" /> :
    s.level === "offline" || s.level === "error" ? (
      s.level === "error" ? <Warning size={16} weight="fill" aria-hidden="true" /> : <SpeakerSlash size={16} aria-hidden="true" />
    ) : <CircleNotch size={16} aria-hidden="true" />
  return (
    <div className={`row ${s.level === "ready" ? "goal-done" : "muted"}`}>
      {icon} {name}：{s.label}{hint}
    </div>
  )
}

export default function VoiceStatus() {
  const [probes, setProbes] = useState<{ stt: Probe; tts: Probe } | null>(null)
  const since = useRef<{ stt?: number; tts?: number }>({})
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let stopped = false
    const poll = async () => {
      try {
        const r = await fetch("/api/voice-status")
        if (!r.ok) return
        const j: { stt: Probe; tts: Probe } = await r.json()
        if (stopped) return
        setProbes(j)
        for (const k of ["stt", "tts"] as const) {
          if (j[k] === "loading" && !since.current[k]) since.current[k] = Date.now()
          if (j[k] !== "loading") since.current[k] = undefined
        }
        if (j.stt !== "loading" && j.tts !== "loading") {
          stopped = true
          return
        }
      } catch {
        if (!stopped && !probes) setProbes({ stt: "offline", tts: "offline" })
      }
    }
    const tick = setInterval(() => setNow(Date.now()), 10000)
    const timer = setInterval(poll, 10000)
    poll()
    return () => {
      stopped = true
      clearInterval(timer)
      clearInterval(tick)
    }
  }, [])

  if (!probes) return null
  const elapsed = (k: "stt" | "tts") =>
    since.current[k] ? Math.floor((now - since.current[k]!) / 1000) : 0
  return (
    <div aria-live="polite">
      <Row name="STT" probe={probes.stt} elapsed={elapsed("stt")} />
      <Row name="TTS" probe={probes.tts} elapsed={elapsed("tts")} />
    </div>
  )
}

export function useVoiceProbes() {
  const [loading, setLoading] = useState({ stt: false, tts: false })

  useEffect(() => {
    let stopped = false
    const poll = async () => {
      try {
        const r = await fetch("/api/voice-status")
        if (!r.ok) return
        const j: { stt: Probe; tts: Probe } = await r.json()
        if (stopped) return
        setLoading({ stt: j.stt === "loading", tts: j.tts === "loading" })
      } catch {
        return
      }
    }
    const timer = setInterval(poll, 10000)
    poll()
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [])

  return { sttLoading: loading.stt, ttsLoading: loading.tts }
}
