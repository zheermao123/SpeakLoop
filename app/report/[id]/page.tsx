"use client"

import { SpeakerHigh } from "@phosphor-icons/react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Report, Session } from "@/lib/domain/types"

const typeLabel: Record<string, string> = { grammar: "语法", vocab: "用词", idiom: "地道表达" }

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, setSession] = useState<Session | null>(null)
  const [handled, setHandled] = useState<Record<string, string>>({})

  useEffect(() => {
    (async () => {
      const { id } = await params
      const s: Session = await fetch(`/api/sessions/${id}`).then(r => r.json())
      setSession(s)
    })()
  }, [params])

  if (!session) return <p className="muted">加载中…</p>
  const report: Report | undefined = session.report
  if (!report) return <p className="muted">报告尚未生成。<Link href="/">返回首页</Link></p>

  async function handleCandidate(word: string, translation: string, example: string, status: "new" | "ignored") {
    await fetch("/api/vocab", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, translation, example, sourceSessionId: session!.id, status }),
    })
    setHandled(h => ({ ...h, [word]: status }))
  }

  return (
    <div>
      <h3>练习报告</h3>
      <div className="card"><b>总评</b><p>{report.summary}</p></div>
      {report.highlights.length > 0 && (
        <div className="card">
          <b>亮点</b>
          <ul>{report.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
        </div>
      )}
      {report.corrections.map((c, i) => {
        const turn = session.turns.find(t => t.id === c.turnId)
        return (
          <div key={i} className="card">
            <span className="chip">{typeLabel[c.type] ?? c.type}</span>
            <p>你说：{c.original}</p>
            <p>建议：{c.improved}</p>
            <p className="muted">{c.explanation}</p>
            {turn?.audioUrl && (
              <div className="row">
                <SpeakerHigh size={20} aria-hidden="true" />
                <audio controls src={turn.audioUrl} aria-label={`原声回放：${c.original}`} />
              </div>
            )}
          </div>
        )
      })}
      {report.vocabCandidates.length > 0 && (
        <div className="card">
          <b>生词候选</b>
          {report.vocabCandidates.map(v => (
            <div key={v.word} className="row" style={{ marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <b>{v.word}</b> <span className="muted">{v.translation}</span>
                <div className="muted">{v.example}</div>
              </div>
              {handled[v.word] ? (
                <span className="chip">{handled[v.word] === "new" ? "已加入" : "已忽略"}</span>
              ) : (
                <>
                  <button className="btn" onClick={() => handleCandidate(v.word, v.translation, v.example, "new")}>采纳</button>
                  <button className="btn btn-secondary" onClick={() => handleCandidate(v.word, v.translation, v.example, "ignored")}>忽略</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <Link className="btn btn-secondary" href="/">返回首页</Link>
    </div>
  )
}
