"use client"

import { SpeakerHigh } from "@phosphor-icons/react"

export default function SpeakButton({ onSpeak, label = "朗读", disabled }: { onSpeak: () => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" className="icon-btn" onClick={onSpeak} disabled={disabled} aria-label={label} title={label}>
      <SpeakerHigh size={16} weight="regular" aria-hidden="true" />
    </button>
  )
}
