"use client"

import { useEffect, useState } from "react"

type Masked = {
  chat: { provider: string; baseUrl: string; model: string; apiKey: { configured: boolean; tail: string } }
  stt: { provider: string; baseUrl: string }
  tts: { provider: string; baseUrl: string; speaker: string }
}

type TestResult = { ok: boolean; detail: string; ms: number }

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
      <h3>设置</h3>
      {error && <div className="card"><span className="muted">{error}</span></div>}
      {saved && <div className="card"><span className="muted">已保存，即时生效。</span></div>}

      <div className="card">
        <b>对话（{cfg.chat.provider}）</b>
        <label className="field">BaseURL</label>
        <input className="input" value={cfg.chat.baseUrl}
          onChange={e => setCfg({ ...cfg, chat: { ...cfg.chat, baseUrl: e.target.value } })} />
        <label className="field">API Key {cfg.chat.apiKey.configured ? `（已配置 ····${cfg.chat.apiKey.tail}，留空保持）` : "（未配置）"}</label>
        <input className="input" type="password" placeholder={cfg.chat.apiKey.configured ? "••••留空保持原值" : "sk-..."}
          value={apiKey} onChange={e => setApiKey(e.target.value)} />
        <label className="field">Model</label>
        <input className="input" value={cfg.chat.model}
          onChange={e => setCfg({ ...cfg, chat: { ...cfg.chat, model: e.target.value } })} />
        <button className="btn btn-secondary mt-2" onClick={() => test("chat")}>测试连接</button>
        {results.chat && <p className="muted">{results.chat.ok ? "✓" : "✗"} {results.chat.detail}（{results.chat.ms}ms）</p>}
      </div>

      <div className="card">
        <b>语音服务</b>
        <label className="field">STT 地址（qwen3-local）</label>
        <input className="input" value={cfg.stt.baseUrl}
          onChange={e => setCfg({ ...cfg, stt: { ...cfg.stt, baseUrl: e.target.value } })} />
        <label className="field">TTS 地址（qwen3-local）</label>
        <input className="input" value={cfg.tts.baseUrl}
          onChange={e => setCfg({ ...cfg, tts: { ...cfg.tts, baseUrl: e.target.value } })} />
        <button className="btn btn-secondary mt-2" onClick={() => test("stt")}>测试 STT</button>
        <button className="btn btn-secondary mt-2" onClick={() => test("tts")}>测试 TTS</button>
        {results.stt && <p className="muted">{results.stt.ok ? "✓" : "✗"} {results.stt.detail}（{results.stt.ms}ms）</p>}
        {results.tts && <p className="muted">{results.tts.ok ? "✓" : "✗"} {results.tts.detail}（{results.tts.ms}ms）</p>}
      </div>

      <div className="card">
        <b>通用</b>
        <label className="field">TTS 默认音色</label>
        <select className="input" value={cfg.tts.speaker}
          onChange={e => setCfg({ ...cfg, tts: { ...cfg.tts, speaker: e.target.value } })}>
          {["Aiden", "Ryan", "Serena", "Vivian", "Dylan", "Eric"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <button className="btn" disabled={busy} onClick={save}>{busy ? "保存中…" : "保存设置"}</button>
    </div>
  )
}
