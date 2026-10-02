"use client"

import { Microphone, Stop } from "@phosphor-icons/react"
import { useRef, useState } from "react"

export default function Recorder({ onRecorded, disabled }: { onRecorded: (b: Blob) => void; disabled?: boolean }) {
  const [recording, setRecording] = useState(false)
  const [denied, setDenied] = useState(false)
  const ref = useRef<MediaRecorder | null>(null)

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : ""
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      const chunks: Blob[] = []
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        onRecorded(new Blob(chunks, { type: mime || "audio/webm" }))
      }
      ref.current = rec
      rec.start()
      setRecording(true)
      setDenied(false)
    } catch {
      setDenied(true)
    }
  }

  function toggle() {
    if (recording) {
      ref.current?.stop()
      setRecording(false)
    } else {
      start()
    }
  }

  return (
    <div>
      <button
        type="button"
        className={`btn ${recording ? "btn-danger" : ""}`}
        onClick={toggle}
        disabled={disabled}
        aria-pressed={recording}
      >
        {recording
          ? <Stop size={20} weight="fill" aria-hidden="true" />
          : <Microphone size={20} aria-hidden="true" />}
        {recording ? "停止录音" : "说话"}
      </button>
      <span aria-live="polite" className="muted" style={{ display: recording ? "block" : "none" }}>
        录音中…
      </span>
      {denied && <p className="muted">麦克风不可用，请用键盘输入。</p>}
    </div>
  )
}
