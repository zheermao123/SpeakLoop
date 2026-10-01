"use client"

import { CheckCircle, Circle } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import Recorder from "@/components/Recorder"
import { Scenario, Session, Turn } from "@/lib/domain/types"

type Bubble = { role: "user" | "ai" | "coach"; text: string }
type Step = { name: "stt" | "chat"; retry: () => void }

export default function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [goalProgress, setGoalProgress] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [ttsDown, setTtsDown] = useState(false)
  const [failed, setFailed] = useState<Step | null>(null)
  const [keyboard, setKeyboard] = useState("")
  const pending = useRef<{ turnId?: string; audioUrl?: string; userText: string } | null>(null)

  useEffect(() => {
    (async () => {
      const { id } = await params
      const s: Session = await fetch(`/api/sessions/${id}`).then(r => r.json())
      setSession(s)
      setGoalProgress(s.goalProgress ?? [])
      const all: Scenario[] = await fetch("/api/scenarios").then(r => r.json())
      setScenario(all.find(x => x.id === s.scenarioId) ?? null)
      setBubbles(s.turns.map(t => [{ role: "user" as const, text: t.userText }, { role: "ai" as const, text: t.aiText }]).flat())
    })()
  }, [params])

  async function runStt(blob: Blob) {
    setBusy(true); setFailed(null)
    const form = new FormData()
    form.set("sessionId", session!.id)
    form.set("audio", blob, "turn.webm")
    const r = await fetch("/api/stt", { method: "POST", body: form })
    if (!r.ok) { setBusy(false); setFailed({ name: "stt", retry: () => runStt(blob) }); return }
    const data = await r.json()
    pending.current = { turnId: data.turnId, audioUrl: data.audioUrl, userText: data.text }
    await runChat(data.text)
  }

  async function runChat(userText: string, mode?: "simplify" | "hint") {
    setBusy(true); setFailed(null)
    const messages = bubbles
      .filter(b => b.role !== "coach")
      .map(b => ({ role: b.role === "user" ? "user" as const : "assistant" as const, content: b.text }))
    if (!mode) messages.push({ role: "user", content: userText })
    const r = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session!.id, scenarioId: session!.scenarioId, messages, mode }),
    })
    if (!r.ok) { setBusy(false); setFailed({ name: "chat", retry: () => runChat(userText, mode) }); return }
    const { reply, goalsDone } = await r.json()
    if (mode) {
      setBubbles(b => [...b, { role: "coach", text: reply }])
      setBusy(false)
      return
    }
    setBubbles(b => [...b, { role: "user", text: userText }, { role: "ai", text: reply }])
    setGoalProgress(g => Array.from(new Set([...g, ...goalsDone])))
    const turn: Turn = {
      id: pending.current?.turnId ?? crypto.randomUUID(),
      userText, aiText: reply,
      audioUrl: pending.current?.audioUrl,
      sttProvider: pending.current?.turnId ? "mock" : "keyboard",
      createdAt: new Date().toISOString(),
    }
    await fetch(`/api/sessions/${session!.id}/turns`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turn, goalsDone }),
    })
    pending.current = null
    setBusy(false)
    playTts(reply)
  }

  async function playTts(text: string) {
    try {
      const wav = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speaker: scenario?.voice }),
      }).then(r => { if (!r.ok) throw new Error(); return r.arrayBuffer() })
      new Audio(URL.createObjectURL(new Blob([wav], { type: "audio/wav" }))).play()
      setTtsDown(false)
    } catch {
      setTtsDown(true)
    }
  }

  async function endPractice() {
    setBusy(true)
    await fetch("/api/report", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session!.id }),
    })
    router.push(`/report/${session!.id}`)
  }

  if (!session || !scenario) return <p className="muted">加载中…</p>
  return (
    <div>
      <div className="card">
        <b>{scenario.title}</b>
        <div className="muted">{scenario.persona}</div>
        <div className="mt-2" role="list" aria-label="练习目标进度">
          <div className="muted">已完成 {goalProgress.length}/{scenario.goals.length}</div>
          {scenario.goals.map((g, i) => (
            <div key={i} role="listitem" className={goalProgress.includes(i) ? "goal-done" : ""}>
              {goalProgress.includes(i)
                ? <CheckCircle size={18} weight="fill" aria-hidden="true" />
                : <Circle size={18} aria-hidden="true" />}{" "}
              {i}. {g}
            </div>
          ))}
        </div>
        {ttsDown && <span className="chip">语音服务离线（文字模式）</span>}
      </div>
      <div style={{ minHeight: 200 }}>
        {bubbles.map((b, i) => (
          <div key={i} className={`bubble ${b.role === "user" ? "bubble-user" : b.role === "ai" ? "bubble-ai" : "bubble-coach"}`}>
            {b.text}
          </div>
        ))}
        {busy && <p className="muted">思考中…</p>}
        {failed && (
          <div className="card">
            <span className="muted">{failed.name === "stt" ? "语音识别" : "对话"}失败</span>{" "}
            <button className="btn btn-secondary" onClick={failed.retry}>重试</button>
          </div>
        )}
      </div>
      <div className="card">
        <div className="row">
          <Recorder onRecorded={runStt} disabled={busy} />
          <input className="input" placeholder="或用键盘输入英文…" value={keyboard}
            onChange={e => setKeyboard(e.target.value)}
            onKeyDown={async e => {
              if (e.key === "Enter" && keyboard.trim() && !busy) {
                const t = keyboard.trim(); setKeyboard("")
                pending.current = { userText: t }
                await runChat(t)
              }
            }} />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-secondary" disabled={busy || bubbles.length === 0}
            onClick={() => runChat("", "simplify")}>听不懂</button>
          <button className="btn btn-secondary" disabled={busy || bubbles.length === 0}
            onClick={() => runChat("", "hint")}>提示</button>
          <button className="btn btn-danger" disabled={busy || bubbles.length === 0} onClick={endPractice}>
            结束练习
          </button>
        </div>
      </div>
    </div>
  )
}
