"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Scenario, Session, VocabWord } from "@/lib/domain/types"

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [words, setWords] = useState<VocabWord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/sessions").then(r => r.json()).then(setSessions).catch(() => {}),
      fetch("/api/scenarios").then(r => r.json()).then(setScenarios).catch(() => {}),
      fetch("/api/vocab").then(r => r.json()).then(setWords).catch(() => {}),
    ]).then(() => setLoading(false))
    fetch("/api/tts/warmup", { method: "POST" }).catch(() => {})
    fetch("/api/stt/warmup", { method: "POST" }).catch(() => {})
  }, [])

  const weekAgo = Date.now() - 7 * 86400_000
  const weekCount = sessions.filter(s => new Date(s.startedAt).getTime() > weekAgo).length
  const dist = words.reduce<Record<string, number>>((acc, w) => ({ ...acc, [w.status]: (acc[w.status] ?? 0) + 1 }), {})
  const errorTypes = sessions
    .flatMap(s => s.report?.corrections ?? [])
    .reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.type]: (acc[c.type] ?? 0) + 1 }), {})
  const topErrors = Object.entries(errorTypes).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const typeLabel: Record<string, string> = { grammar: "语法", vocab: "用词", idiom: "地道表达" }

  if (loading) return <p className="muted">加载中…</p>
  return (
    <div>
      <div className="row" style={{ alignItems: "stretch" }}>
        <div className="card" style={{ flex: 1 }}>
          <div className="muted">本周练习</div>
          <div className="stat stat-accent">{weekCount} 次</div>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <div className="muted">生词（new/learning/mastered）</div>
          <div className="stat">{dist.new ?? 0} / {dist.learning ?? 0} / {dist.mastered ?? 0}</div>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <div className="muted">常见错误 Top3</div>
          {topErrors.length === 0 && <div className="muted">暂无数据</div>}
          {topErrors.map(([t, n]) => <div key={t}>{typeLabel[t] ?? t} × {n}</div>)}
        </div>
      </div>
      <h3>最近练习</h3>
      {sessions.length === 0 && <p className="muted">还没有练习记录，去 <Link href="/scenarios">选一个场景</Link> 开始吧。</p>}
      {sessions.slice(0, 8).map(s => {
        const sc = scenarios.find(x => x.id === s.scenarioId)
        return (
          <div key={s.id} className="card row">
            <span>{sc?.title ?? "未知场景"}</span>
            <span className="muted">{new Date(s.startedAt).toLocaleString("zh-CN")}</span>
            <span className="chip">{s.turns.length} 轮</span>
            {s.report && <Link className="btn btn-secondary" href={`/report/${s.id}`}>查看报告</Link>}
          </div>
        )
      })}
    </div>
  )
}
