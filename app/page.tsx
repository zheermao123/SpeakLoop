"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  Briefcase,
  CaretRight,
  ChatCircleDots,
  Coffee,
  Flame,
  Presentation,
  Users,
} from "@phosphor-icons/react"
import { VoiceBanner } from "@/components/VoiceStatus"
import { relativeTime } from "@/lib/format"
import { Scenario, Session, VocabWord } from "@/lib/domain/types"

const scenarioTiles: Record<string, { Icon: typeof ChatCircleDots; color: string }> = {
  "builtin-interview": { Icon: Briefcase, color: "#007AFF" },
  "builtin-standup": { Icon: Presentation, color: "#5856D6" },
  "builtin-oneonone": { Icon: Users, color: "#30B0C7" },
  "builtin-smalltalk": { Icon: Coffee, color: "#FF9500" },
}

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
      <div style={{ marginBottom: 16 }}>
        <VoiceBanner />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ios-orange)", display: "inline-block" }} />
              <span className="muted">本周练习</span>
            </span>
            <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Flame size={16} />
              活跃
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
            <div className="stat">{weekCount}</div>
            <span className="muted">次对话</span>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ios-green)", display: "inline-block" }} />
              <span className="muted">生词进度</span>
            </span>
            <Link href="/vocab" style={{ color: "var(--ios-blue)", fontSize: 13, textDecoration: "none" }}>查看全部 ›</Link>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <div style={{ flex: 1, background: "var(--bg-inset)", borderRadius: 10, padding: 8, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ios-blue)" }}>{dist.new ?? 0}</div>
              <div className="muted" style={{ fontSize: 11 }}>新词</div>
            </div>
            <div style={{ flex: 1, background: "var(--bg-inset)", borderRadius: 10, padding: 8, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ios-orange)" }}>{dist.learning ?? 0}</div>
              <div className="muted" style={{ fontSize: 11 }}>学习中</div>
            </div>
            <div style={{ flex: 1, background: "var(--bg-inset)", borderRadius: 10, padding: 8, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ios-green)" }}>{dist.mastered ?? 0}</div>
              <div className="muted" style={{ fontSize: 11 }}>已掌握</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ios-red)", display: "inline-block" }} />
            <span className="muted">常见错误 Top 3</span>
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {topErrors.length === 0 && <div className="muted">暂无数据</div>}
            {topErrors.map(([t, n]) => (
              <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13 }}>{typeLabel[t] ?? t}</span>
                <span className="chip">{n} 次</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>最近练习</h3>
        <span className="muted">共 {sessions.length} 条记录</span>
      </div>

      {sessions.length === 0 && <p className="muted">还没有练习记录，去 <Link href="/scenarios">选一个场景</Link> 开始吧。</p>}
      {sessions.length > 0 && (
        <div className="ios-grouped-list">
          {sessions.slice(0, 8).map(s => {
            const sc = scenarios.find(x => x.id === s.scenarioId)
            const tile = scenarioTiles[s.scenarioId] ?? { Icon: ChatCircleDots, color: "#8E8E93" }
            const Icon = tile.Icon
            return (
              <Link
                key={s.id}
                href={s.report ? `/report/${s.id}` : `/practice/${s.id}`}
                className="ios-grouped-row"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", color: "#fff", background: tile.color, flexShrink: 0 }}>
                    <Icon size={16} weight="fill" aria-hidden="true" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sc?.title ?? "未知场景"}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{relativeTime(s.startedAt)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span className="chip">{s.turns.length} 轮</span>
                  <CaretRight size={14} className="muted" aria-hidden="true" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
