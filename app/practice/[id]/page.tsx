"use client"

import { Target, Translate } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import DictPopover from "@/components/DictPopover"
import Recorder from "@/components/Recorder"
import SpeakButton from "@/components/SpeakButton"
import { VoiceBanner, useVoiceProbes } from "@/components/VoiceStatus"
import WordText from "@/components/WordText"
import { AudioQueue } from "@/lib/audio-queue"
import { Scenario, Session, Turn } from "@/lib/domain/types"
import { hasCjk } from "@/lib/word-token"

type Bubble = { role: "user" | "ai" | "coach"; text: string }
type Step = { name: "stt" | "chat" | "save"; retry: () => void }

const stepLabel: Record<Step["name"], string> = { stt: "语音识别", chat: "对话", save: "轮次保存" }

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
  const [dict, setDict] = useState<{ word: string; sentence: string; anchor: DOMRect } | null>(null)
  const [zhMap, setZhMap] = useState<Record<string, string>>({})
  const [zhShown, setZhShown] = useState<string | null>(null)
  const [speakStatus, setSpeakStatus] = useState<{ key: string; phase: "synth" | "play"; since: number } | null>(null)

  function speakNow(key: string, text: string) {
    setSpeakStatus({ key, phase: "synth", since: Date.now() })
    queue().enqueue(() => postTts(text), {
      onSynthDone: () =>
        setSpeakStatus(prev => (prev && prev.key === key && prev.phase === "synth" ? { key, phase: "play", since: Date.now() } : prev)),
      onSettle: () => setSpeakStatus(prev => (prev && prev.key === key ? null : prev)),
    })
  }

  function speakStatusOf(key: string): { phase: "synth" | "play"; seconds: number } | null {
    if (!speakStatus || speakStatus.key !== key) return null
    return { phase: speakStatus.phase, seconds: Math.floor((Date.now() - speakStatus.since) / 1000) }
  }
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
  }, [])
  const pending = useRef<{ turnId?: string; audioUrl?: string; userText: string; sttProvider?: string } | null>(null)
  const audioQueue = useRef<AudioQueue | null>(null)
  const [phase, setPhase] = useState<{ label: string; since: number } | null>(null)
  const [, setTick] = useState(0)
  const { sttLoading, ttsLoading } = useVoiceProbes()
  useEffect(() => {
    if (!phase && !(speakStatus && speakStatus.phase === "synth")) return
    const id = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(id)
  }, [phase, speakStatus])
  function queue(): AudioQueue {
    if (!audioQueue.current) {
      audioQueue.current = new AudioQueue(async buf => {
        await new Promise<void>(resolve => {
          const a = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/wav" })))
          let guard: ReturnType<typeof setTimeout> | null = null
          const settle = () => {
            if (guard) clearTimeout(guard)
            resolve()
          }
          guard = setTimeout(() => {
            setTtsDown(true)
            settle()
          }, 60000)
          a.onended = () => {
            URL.revokeObjectURL(a.src)
            setTtsDown(false)
            settle()
          }
          a.onerror = () => settle()
          a.play().catch(() => {
            setTtsDown(true)
            settle()
          })
        })
      })
    }
    return audioQueue.current
  }

  async function postTts(text: string): Promise<ArrayBuffer | null> {
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speaker: scenario?.voice }),
      })
      if (!r.ok) throw new Error()
      return await r.arrayBuffer()
    } catch {
      setTtsDown(true)
      return null
    }
  }

  function handleWordClick(sentence: string) {
    return (word: string, el: HTMLSpanElement) => {
      setDict({ word, sentence, anchor: el.getBoundingClientRect() })
    }
  }

  async function ensureZh(text: string) {
    if (zhMap[text]) return
    setZhMap(prev => ({ ...prev, [text]: "翻译中…" }))
    try {
      const r = await fetch("/api/translate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      if (!r.ok) throw new Error(`翻译失败 (${r.status})`)
      const j = await r.json()
      setZhMap(prev => ({ ...prev, [text]: j.translation }))
    } catch (e) {
      setZhMap(prev => ({ ...prev, [text]: (e as Error).message }))
    }
  }

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
    setPhase({ label: "语音识别", since: Date.now() })
    const form = new FormData()
    form.set("sessionId", session!.id)
    form.set("audio", blob, "turn.webm")
    let r: Response
    try {
      r = await fetch("/api/stt", { method: "POST", body: form })
    } catch {
      setPhase(null); setBusy(false); setFailed({ name: "stt", retry: () => runStt(blob) }); return
    }
    if (!r.ok) { setPhase(null); setBusy(false); setFailed({ name: "stt", retry: () => runStt(blob) }); return }
    const data = await r.json()
    pending.current = { turnId: data.turnId, audioUrl: data.audioUrl, userText: data.text, sttProvider: data.sttProvider }
    await runChatStream(data.text)
  }

  async function runChatStream(userText: string) {
    setBusy(true); setFailed(null)
    setPhase({ label: "等待 AI 回复", since: Date.now() })
    const messages = bubbles
      .filter(b => b.role !== "coach")
      .map(b => ({ role: b.role === "user" ? "user" as const : "assistant" as const, content: b.text }))
    messages.push({ role: "user", content: userText })
    setBubbles(b => [...b, { role: "user", text: userText }, { role: "ai", text: "" }])
    let res: Response
    try {
      res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session!.id, scenarioId: session!.scenarioId, messages }),
      })
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`)
    } catch {
      setBubbles(b => b.slice(0, -2))
      setPhase(null)
      setBusy(false)
      setFailed({ name: "chat", retry: () => runChatStream(userText) })
      return
    }
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ""
    let reply = ""
    const goalsDone: number[] = []
    let errored = false
    let firstDeltaAt = -1
    for (;;) {
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }))
      if (done) break
      buf += dec.decode(value, { stream: true })
      const frames = buf.split("\n\n")
      buf = frames.pop() ?? ""
      for (const f of frames) {
        const line = f.trim()
        if (!line.startsWith("data:")) continue
        let ev: { type: string; text?: string; reply?: string; goalsDone?: number[] }
        try {
          ev = JSON.parse(line.slice(5))
        } catch {
          continue
        }
        if (ev.type === "delta" && ev.text) {
          const t = ev.text
          setBubbles(b => b.map((x, i) => (i === b.length - 1 && x.role === "ai" ? { ...x, text: x.text + t } : x)))
          if (firstDeltaAt < 0) {
            firstDeltaAt = 1
            setPhase(null)
          }
        } else if (ev.type === "sentence") {
          // v2 勘误 F3：前端不再按句合成，整段在 done 后合成
        } else if (ev.type === "done") {
          reply = ev.reply ?? ""
          goalsDone.push(...(ev.goalsDone ?? []))
        } else if (ev.type === "error") {
          errored = true
        }
      }
    }
    if (errored || !reply) {
      setBubbles(b => b.slice(0, -2))
      setPhase(null)
      setBusy(false)
      setFailed({ name: "chat", retry: () => runChatStream(userText) })
      return
    }
    setBubbles(b => b.map((x, i) => (i === b.length - 1 && x.role === "ai" ? { ...x, text: reply } : x)))
    setGoalProgress(g => Array.from(new Set([...g, ...goalsDone])))
    const turn: Turn = {
      id: pending.current?.turnId ?? crypto.randomUUID(),
      userText, aiText: reply,
      audioUrl: pending.current?.audioUrl,
      sttProvider: pending.current?.sttProvider ?? "keyboard",
      createdAt: new Date().toISOString(),
    }
    const ok = await persistTurn(turn, goalsDone)
    if (!ok) return
    pending.current = null
    setBusy(false)
    setPhase({ label: "语音合成", since: Date.now() })
    queue().enqueue(() => postTts(reply).then(b => {
      setPhase(null)
      return b
    }))
  }

  async function runChat(mode: "simplify" | "hint") {
    setBusy(true); setFailed(null)
    const messages = bubbles
      .filter(b => b.role !== "coach")
      .map(b => ({ role: b.role === "user" ? "user" as const : "assistant" as const, content: b.text }))
    let r: Response
    try {
      r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session!.id, scenarioId: session!.scenarioId, messages, mode }),
      })
    } catch {
      setBusy(false); setFailed({ name: "chat", retry: () => runChat(mode) }); return
    }
    if (!r.ok) { setBusy(false); setFailed({ name: "chat", retry: () => runChat(mode) }); return }
    const { reply } = await r.json()
    setBubbles(b => [...b, { role: "coach", text: reply }])
    setBusy(false)
  }

  async function persistTurn(turn: Turn, goalsDone: number[]): Promise<boolean> {
    const ok = await fetch(`/api/sessions/${session!.id}/turns`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turn, goalsDone }),
    }).then(r => r.ok, () => false)
    if (!ok) {
      setBusy(false)
      setFailed({
        name: "save",
        retry: async () => {
          if (await persistTurn(turn, goalsDone)) {
            pending.current = null
            setBusy(false)
            queue().enqueue(() => postTts(turn.aiText))
          }
        },
      })
      return false
    }
    return true
  }

  async function endPractice() {
    setBusy(true)
    try {
      const r = await fetch("/api/report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session!.id }),
      })
      if (r.status === 422) {
        const { raw } = await r.json()
        sessionStorage.setItem(`report-raw-${session!.id}`, raw ?? "")
      } else if (!r.ok) {
        setBusy(false)
        setFailed({ name: "chat", retry: endPractice })
        return
      }
      router.push(`/report/${session!.id}`)
    } catch {
      setBusy(false)
      setFailed({ name: "chat", retry: endPractice })
    } finally {
      setBusy(false)
    }
  }

  if (!session || !scenario) return <p className="muted">加载中…</p>
  return (
    <div className="page-container">
      <VoiceBanner />
      <div className="practice-grid">
        <div className="practice-left-col">
          <div className="card">
            <div className="muted" style={{ fontSize: 12 }}>当前练习场景</div>
            <b>{scenario.title}</b>
            {scenario.personaZh && <div>{scenario.personaZh}</div>}
            <div style={{ background: "var(--bg-inset)", borderRadius: 12, padding: 12, marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 11 }}>EN PERSONA</div>
              <WordText text={scenario.persona} onWordClick={handleWordClick(scenario.persona)} activeWord={dict?.word} />
              <SpeakButton onSpeak={() => speakNow("persona", scenario.persona)} label="朗读角色设定" status={speakStatusOf("persona")} />
            </div>
          </div>
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b><Target size={16} /> 练习目标</b>
              <span className="muted">已完成 {goalProgress.length}/{scenario.goals.length}</span>
            </div>
            <div className="goal-list" role="list" aria-label="练习目标进度">
              {scenario.goals.map((g, i) => (
                <div
                  key={i}
                  role="listitem"
                  className={"goal-row" + (goalProgress.includes(i) ? " done" : "")}
                  onMouseEnter={() => { hoverTimer.current = setTimeout(() => { setZhShown(g); ensureZh(g) }, 300) }}
                  onMouseLeave={() => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null }; setZhShown(null) }}
                  onClick={e => { if (!(e.target as HTMLElement).closest(".word-chip")) { setZhShown(prev => (prev === g ? null : g)); ensureZh(g) } }}
                >
                  <span className="goal-checkbox" aria-hidden="true">{goalProgress.includes(i) ? "✓" : ""}</span>
                  {i}. <WordText text={g} onWordClick={handleWordClick(g)} activeWord={dict?.word} />
                  <SpeakButton onSpeak={() => speakNow(`goal-${i}`, g)} label={`朗读目标 ${i}`} status={speakStatusOf(`goal-${i}`)} />
                  {zhShown === g && zhMap[g] && <div className="zh-line"><span className="zh-label">译文</span>{zhMap[g]}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div>
          {ttsDown && <span className="chip">语音服务离线（文字模式）</span>}
          <div className="bubble-stream">
            {bubbles.map((b, i) => {
              const canTranslate = !hasCjk(b.text)
              const speakingNow = busy && b.role === "ai" && i === bubbles.length - 1
              return (
                <div
                  key={i}
                  className={`bubble ${b.role === "user" ? "bubble-user" : b.role === "ai" ? "bubble-ai" : "bubble-coach"}`}
                  onMouseEnter={canTranslate && !busy ? () => { hoverTimer.current = setTimeout(() => { setZhShown(b.text); ensureZh(b.text) }, 300) } : undefined}
                  onMouseLeave={canTranslate ? () => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null }; setZhShown(null) } : undefined}
                >
                  <WordText text={b.text} onWordClick={handleWordClick(b.text)} activeWord={dict?.word} />
                  <div className="bubble-actions">
                    <SpeakButton onSpeak={() => speakNow(`bubble-${i}`, b.text)} label="朗读本句" disabled={speakingNow} status={speakStatusOf(`bubble-${i}`)} />
                    {canTranslate && (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="显示中文翻译"
                        aria-pressed={zhShown === b.text}
                        onClick={() => { setZhShown(prev => (prev === b.text ? null : b.text)); ensureZh(b.text) }}
                      >
                        <Translate size={16} weight="regular" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {canTranslate && zhShown === b.text && zhMap[b.text] && (
                    <div className="zh-line"><span className="zh-label">译文</span>{zhMap[b.text]}</div>
                  )}
                </div>
              )
            })}
          </div>
          {phase && (
            <p className="phase-timer-bar" aria-live="polite">
              {phase.label}中… {((Date.now() - phase.since) / 1000).toFixed(0)}s
              {phase.label === "语音识别" && sttLoading ? "（模型预热中）" : null}
              {phase.label === "语音合成" && ttsLoading ? "（模型预热中）" : null}
            </p>
          )}
          {busy && !phase && <p className="muted">处理中…</p>}
          {failed && (
            <div className="card">
              <span className="muted">{stepLabel[failed.name]}失败</span>{" "}
              <button className="btn btn-secondary" onClick={failed.retry}>重试</button>
            </div>
          )}
          <div className="practice-dock">
            <div className="dock-assist-row">
              <button className="btn btn-secondary" disabled={busy || bubbles.length === 0}
                onClick={() => runChat("simplify")}>听不懂</button>
              <button className="btn btn-secondary" disabled={busy || bubbles.length === 0}
                onClick={() => runChat("hint")}>提示</button>
              <button className="btn btn-danger" disabled={busy || bubbles.length === 0} onClick={endPractice}>
                结束练习
              </button>
            </div>
            <div className="dock-input-row">
              <input className="ios-input" placeholder="或用键盘输入英文…" value={keyboard}
                onChange={e => setKeyboard(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === "Enter" && keyboard.trim() && !busy) {
                    const t = keyboard.trim(); setKeyboard("")
                    pending.current = { userText: t }
                    await runChatStream(t)
                  }
                }} />
              <Recorder onRecorded={runStt} disabled={busy} />
            </div>
          </div>
        </div>
      </div>
      {dict && (
        <DictPopover
          key={`${dict.word}|${dict.sentence}`}
          word={dict.word}
          sentence={dict.sentence}
          anchor={dict.anchor}
          sessionId={session?.id}
          onClose={() => setDict(null)}
        />
      )}
    </div>
  )
}
