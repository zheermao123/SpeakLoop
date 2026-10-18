export type VoiceProbe = "ready" | "loading" | "offline" | "disabled"

export interface LineStatus {
  level: "ready" | "loading" | "offline" | "error"
  label: string
}

export function lineStatus(probe: VoiceProbe, elapsedSec: number, timeoutSec = 240): LineStatus {
  if (probe === "ready") return { level: "ready", label: "就绪" }
  if (probe === "disabled") return { level: "loading", label: "未启用" }
  if (probe === "offline") return { level: "offline", label: "离线" }
  if (elapsedSec >= timeoutSec) return { level: "error", label: `异常（已 ${elapsedSec}s）` }
  return { level: "loading", label: `预热中 · ${elapsedSec}s` }
}
