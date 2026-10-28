"use client"

import { useEffect, useState } from "react"

type Masked = {
  chat: { provider: string; baseUrl: string; model: string; apiKey: { configured: boolean; tail: string } }
  stt: { provider: string; baseUrl: string }
  tts: { provider: string; baseUrl: string; speaker: string }
}

type TestResult = { ok: boolean; detail: string; ms: number }

const inputStyle = { backgroundColor: "#ffffff", border: "1px solid rgba(0, 0, 0, 0.08)", borderRadius: 12 }
const labelStyle = { width: 150, flexShrink: 0, fontSize: 14, fontWeight: 500, color: "var(--label)", margin: 0 }
const rowStyle = { display: "flex", alignItems: "center", gap: 16, padding: "10px 0" }
const testBtnStyle = { minHeight: 34, padding: "0 14px", borderRadius: 999, fontSize: 13, background: "rgba(0, 122, 255, 0.12)", color: "var(--tint)", flexShrink: 0 }
const cardStyle = { padding: 0, overflow: "hidden" as const, marginBottom: 16 }
const headStyle = { margin: 0, padding: "16px 20px 0", fontSize: 15, letterSpacing: "-0.01em" }
const bodyStyle = { padding: "4px 20px 16px" }

export default function SettingsPage() {
  const [cfg, setCfg] = useState<Masked | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [results, setResults] = useState<Record<string, TestResult>>({})

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(setCfg).catch(() => setError("加载设置失败"))
  }, [])

  async function save() {
    if (!cfg) return
    setBusy(true); setError(""); setSaved(false)
    try {
      const body: Record<string, unknown> = {
        chat: { baseUrl: cfg.chat.baseUrl, model: cfg.chat.model },
        stt: { baseUrl: cfg.stt.baseUrl },
        tts: { baseUrl: cfg.tts.baseUrl, speaker: cfg.tts.speaker },
      }
      if (apiKey.trim()) (body.chat as Record<string, unknown>).apiKey = apiKey.trim()
      const r = await fetch("/api/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? `保存失败 (${r.status})`)
      setCfg(await r.json())
      setApiKey("")
      setSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function test(target: "chat" | "stt" | "tts") {
    setResults(r => ({ ...r, [target]: { ok: false, detail: "测试中…", ms: 0 } }))
    try {
      const r = await fetch("/api/settings/test", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target }),
      })
      if (!r.ok) throw new Error((await r.json()).detail ?? `测试失败 (${r.status})`)
      const j = await r.json()
      setResults(prev => ({ ...prev, [target]: j }))
    } catch (e) {
      setResults(prev => ({ ...prev, [target]: { ok: false, detail: (e as Error).message, ms: 0 } }))
    }
  }

  if (!cfg) return <p className="muted">加载中…</p>
  return (
    <div>
      <h1 style={{ margin: "0 0 20px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>设置</h1>
      {error && <div className="card"><span className="muted">{error}</span></div>}
      {saved && <div className="card"><span className="muted">已保存，即时生效。</span></div>}

      <div className="card" style={cardStyle}>
        <h3 style={headStyle}>对话（{cfg.chat.provider}）</h3>
        <div style={bodyStyle}>
          <div style={rowStyle}>
            <label className="field" style={labelStyle}>BaseURL</label>
            <input className="input" style={inputStyle} value={cfg.chat.baseUrl}
              onChange={e => setCfg({ ...cfg, chat: { ...cfg.chat, baseUrl: e.target.value } })} />
          </div>
          <div style={{ ...rowStyle, borderTop: "0.5px solid var(--separator-soft)" }}>
            <label className="field" style={labelStyle}>API Key</label>
            <input className="input" style={inputStyle} type="password" placeholder={cfg.chat.apiKey.configured ? "••••留空保持原值" : "sk-..."}
              value={apiKey} onChange={e => setApiKey(e.target.value)} />
            <span className="muted" style={{ flexShrink: 0, fontSize: 12 }}>
              {cfg.chat.apiKey.configured ? `尾 4 位 ${cfg.chat.apiKey.tail}，留空保持` : "未配置"}
            </span>
          </div>
          <div style={{ ...rowStyle, borderTop: "0.5px solid var(--separator-soft)" }}>
            <label className="field" style={labelStyle}>Model</label>
            <input className="input" style={inputStyle} value={cfg.chat.model}
              onChange={e => setCfg({ ...cfg, chat: { ...cfg.chat, model: e.target.value } })} />
            <button className="btn" style={testBtnStyle} onClick={() => test("chat")}>测试连接</button>
          </div>
          {results.chat && <p className="muted" style={{ margin: "2px 0 0" }}>{results.chat.ok ? "✓" : "✗"} {results.chat.detail}（{results.chat.ms}ms）</p>}
        </div>
      </div>

      <div className="card" style={cardStyle}>
        <h3 style={headStyle}>语音服务</h3>
        <div style={bodyStyle}>
          <div style={rowStyle}>
            <label className="field" style={labelStyle}>STT 地址（qwen3-local）</label>
            <input className="input" style={inputStyle} value={cfg.stt.baseUrl}
              onChange={e => setCfg({ ...cfg, stt: { ...cfg.stt, baseUrl: e.target.value } })} />
            <button className="btn" style={testBtnStyle} onClick={() => test("stt")}>测试 STT</button>
          </div>
          <div style={{ ...rowStyle, borderTop: "0.5px solid var(--separator-soft)" }}>
            <label className="field" style={labelStyle}>TTS 地址（qwen3-local）</label>
            <input className="input" style={inputStyle} value={cfg.tts.baseUrl}
              onChange={e => setCfg({ ...cfg, tts: { ...cfg.tts, baseUrl: e.target.value } })} />
            <button className="btn" style={testBtnStyle} onClick={() => test("tts")}>测试 TTS</button>
          </div>
          {results.stt && <p className="muted" style={{ margin: "2px 0 0" }}>{results.stt.ok ? "✓" : "✗"} {results.stt.detail}（{results.stt.ms}ms）</p>}
          {results.tts && <p className="muted" style={{ margin: "2px 0 0" }}>{results.tts.ok ? "✓" : "✗"} {results.tts.detail}（{results.tts.ms}ms）</p>}
        </div>
      </div>

      <div className="card" style={cardStyle}>
        <h3 style={headStyle}>通用</h3>
        <div style={bodyStyle}>
          <div style={rowStyle}>
            <label className="field" style={labelStyle}>TTS 默认音色</label>
            <select className="input" style={inputStyle} value={cfg.tts.speaker}
              onChange={e => setCfg({ ...cfg, tts: { ...cfg.tts, speaker: e.target.value } })}>
              {["Aiden", "Ryan", "Serena", "Vivian", "Dylan", "Eric"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <button className="btn" disabled={busy} onClick={save}>{busy ? "保存中…" : "保存设置"}</button>
    </div>
  )
}
