"use client"

import { SpeakerHigh } from "@phosphor-icons/react"

export default function SpeakButton({
  onSpeak,
  label,
  disabled,
  status,
}: {
  onSpeak: () => void
  label?: string
  disabled?: boolean
  status?: { phase: "synth" | "play"; seconds: number } | null
}) {
  return (
    <span className="row" style={{ gap: "var(--space-1)" }}>
      <button type="button" className="icon-btn" onClick={onSpeak} disabled={disabled} aria-label={label ?? "朗读"}>
        <SpeakerHigh size={16} aria-hidden="true" />
      </button>
      <span className="muted" aria-live="polite" style={{ fontSize: 12 }}>
        {status?.phase === "synth" ? `合成中 ${status.seconds}s` : status?.phase === "play" ? "播放中" : ""}
      </span>
    </span>
  )
}
