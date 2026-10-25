"use client"

import { Warning } from "@phosphor-icons/react"
import { useEffect, useState, type CSSProperties } from "react"
import { useVoiceStatus } from "@/lib/use-voice-status"

type Probe = "ready" | "loading" | "offline" | "disabled"

type ElectronAPI = {
  restartVoiceServices?: () => Promise<void> | void
}

function getApi(): ElectronAPI | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
}

const COMPACT_BUTTON: CSSProperties = {
  minHeight: 32,
  padding: "4px 12px",
  fontSize: 13,
}

const HELP_TEXT = "双击 启动SpeakLoop.vbs 启动器，或查看 logs/ 目录并重新运行 npm run start"

export function VoiceBanner() {
  const voice = useVoiceStatus()
  const [helpOpen, setHelpOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)

  if (!voice.loading && voice.stt !== "offline" && voice.tts !== "offline") return null

  if (voice.loading) {
    const stt = voice.stt === "loading" ? `STT ${voice.busyElapsed.stt}s` : "STT 就绪"
    const tts = voice.tts === "loading" ? `TTS ${voice.busyElapsed.tts}s` : "TTS 就绪"
    return (
      <div className="voice-status-banner" role="status" aria-live="polite">
        <span>语音预热中：{stt} · {tts}</span>
      </div>
    )
  }

  async function handleRestore() {
    const api = getApi()
    if (!api?.restartVoiceServices) {
      setHelpOpen(v => !v)
      return
    }
    setRestoring(true)
    try {
      await Promise.race([
        Promise.resolve(api.restartVoiceServices()),
        new Promise<void>(resolve => setTimeout(resolve, 90000)),
      ])
    } catch {
    }
    voice.refresh()
    setRestoring(false)
  }

  return (
    <div
      className="voice-status-banner"
      role="status"
      aria-live="polite"
      style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
          <Warning size={15} weight="fill" aria-hidden="true" />
          语音引擎离线
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={COMPACT_BUTTON}
            aria-busy={restoring}
            onClick={handleRestore}
          >
            一键恢复
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={COMPACT_BUTTON}
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen(v => !v)}
          >
            如何恢复？
          </button>
        </div>
      </div>
      {helpOpen && (
        <div style={{ color: "var(--text-secondary)", paddingLeft: 21 }}>{HELP_TEXT}</div>
      )}
    </div>
  )
}

export default VoiceBanner

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
