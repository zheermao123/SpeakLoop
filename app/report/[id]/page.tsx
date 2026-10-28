"use client"

import { SpeakerHigh } from "@phosphor-icons/react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { CSSProperties } from "react"
import { Report, Session } from "@/lib/domain/types"

const typeLabel: Record<string, string> = { grammar: "语法", vocab: "用词", idiom: "地道表达" }
const typePillClass: Record<string, string> = { grammar: "pill pill-red", vocab: "pill pill-orange", idiom: "pill" }
const typePillStyle: Record<string, CSSProperties> = {
  idiom: { background: "rgba(91, 91, 214, 0.12)", color: "var(--badge-indigo)" },
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, setSession] = useState<Session | null>(null)
  const [handled, setHandled] = useState<Record<string, string>>({})
  const [rawReport, setRawReport] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    (async () => {
      const { id } = await params
      const s: Session = await fetch(`/api/sessions/${id}`).then(r => r.json())
      setSession(s)
      if (!s?.report) {
        setRawReport(sessionStorage.getItem(`report-raw-${id}`))
      }
    })()
  }, [params])

  async function regenerate() {
    setRegenerating(true)
    try {
      const r = await fetch("/api/report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session!.id }),
      })
      if (r.ok) {
        sessionStorage.removeItem(`report-raw-${session!.id}`)
        const refreshed: Session = await fetch(`/api/sessions/${session!.id}`).then(x => x.json())
        setSession(refreshed)
        setRawReport(null)
      }
    } finally {
      setRegenerating(false)
    }
  }

  if (!session) return <p className="muted">加载中…</p>
  const report: Report | undefined = session.report
  if (!report) {
    return (
      <div>
        <h3>练习报告</h3>
        {rawReport ? (
          <div className="card">
            <b>报告生成失败（解析错误）</b>
            <p className="muted">以下是模型原始输出，可重试生成：</p>
            <pre style={{ whiteSpace: "pre-wrap", background: "var(--bg-inset)", padding: 12, borderRadius: 8 }}>{rawReport}</pre>
            <button className="btn" disabled={regenerating} onClick={regenerate}>重新生成</button>
          </div>
        ) : (
          <p className="muted">报告尚未生成。<Link href="/">返回首页</Link></p>
        )}
      </div>
    )
  }

  async function handleCandidate(word: string, translation: string, example: string, status: "new" | "ignored") {
    const r = await fetch("/api/vocab", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, translation, example, sourceSessionId: session!.id, status }),
    })
    if (!r.ok) return
    setHandled(h => ({ ...h, [word]: status }))
  }

  return (
    <div>
      <div className="card" style={{ padding: 24, borderRadius: "var(--radius-hero)", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--label-2)", letterSpacing: "0.02em" }}>练习报告</div>
        <p style={{ margin: "8px 0 0", fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.45 }}>
          {report.summary}
        </p>
      </div>
      {report.highlights.length > 0 && (
        <div className="card">
          <b>亮点</b>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
            {report.highlights.map((h, i) => (
              <li key={i} style={{ fontSize: 14, lineHeight: 1.55 }}>{h}</li>
            ))}
          </ul>
        </div>
      )}
      {report.corrections.length > 0 && (
        <>
          <h3 style={{ margin: "20px 0 10px", fontSize: 16, letterSpacing: "-0.01em" }}>逐句纠错</h3>
          <div className="card" style={{ padding: "4px 20px" }}>
            {report.corrections.map((c, i) => {
              const turn = session.turns.find(t => t.id === c.turnId)
              return (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 0", borderTop: i === 0 ? "none" : "0.5px solid var(--separator-soft)" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: "var(--label-2)", textDecoration: "line-through", wordBreak: "break-word" }}>
                      {c.original}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, wordBreak: "break-word" }}>{c.improved}</div>
                    <div className="muted" style={{ marginTop: 4, lineHeight: 1.55 }}>{c.explanation}</div>
                    {turn?.audioUrl && (
                      <div className="row" style={{ marginTop: 8 }}>
                        <SpeakerHigh size={20} aria-hidden="true" />
                        <audio controls src={turn.audioUrl} aria-label={`原声回放：${c.original}`} style={{ width: "100%", maxWidth: 420, height: 36 }} />
                      </div>
                    )}
                  </div>
                  <span
                    className={typePillClass[c.type] ?? "pill"}
                    style={{ flexShrink: 0, marginTop: 2, ...(typePillStyle[c.type] ?? {}) }}
                  >
                    {typeLabel[c.type] ?? c.type}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
      {report.vocabCandidates.length > 0 && (
        <div className="card">
          <b>生词候选</b>
          <div style={{ marginTop: 2 }}>
            {report.vocabCandidates.map((v, i) => (
              <div
                key={v.word}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : "0.5px solid var(--separator-soft)" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 15 }}>{v.word}</b> <span className="muted">{v.translation}</span>
                  <div className="muted" style={{ fontStyle: "italic" }}>{v.example}</div>
                </div>
                {handled[v.word] ? (
                  <span className="chip" style={{ flexShrink: 0 }}>{handled[v.word] === "new" ? "已加入" : "已忽略"}</span>
                ) : (
                  <span style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      className="btn"
                      style={{ minHeight: 34, padding: "0 14px", borderRadius: 999, fontSize: 13 }}
                      onClick={() => handleCandidate(v.word, v.translation, v.example, "new")}
                    >
                      采纳
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ minHeight: 34, padding: "0 14px", borderRadius: 999, fontSize: 13 }}
                      onClick={() => handleCandidate(v.word, v.translation, v.example, "ignored")}
                    >
                      忽略
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <Link className="btn btn-secondary" href="/">返回首页</Link>
    </div>
  )
}
