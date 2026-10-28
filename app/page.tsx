"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Briefcase,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  ChatCircleDots,
  Coffee,
  Lightbulb,
  Presentation,
  SpeakerHigh,
  Users,
} from "@phosphor-icons/react"
import { relativeTime } from "@/lib/format"
import { Scenario, Session, VocabStatus, VocabWord } from "@/lib/domain/types"

const scenarioTiles: Record<string, { Icon: typeof ChatCircleDots; color: string }> = {
  "builtin-interview": { Icon: Briefcase, color: "#5B5BD6" },
  "builtin-standup": { Icon: Presentation, color: "#FFB300" },
  "builtin-oneonone": { Icon: Users, color: "#34C759" },
  "builtin-smalltalk": { Icon: Coffee, color: "#FF7847" },
}

const statusLabel: Record<VocabStatus, string> = {
  new: "新词",
  learning: "学习中",
  mastered: "已掌握",
  ignored: "已忽略",
}

const insightHint: Record<string, string> = {
  grammar: "留意句子结构与动词时态",
  vocab: "留意词语搭配",
  idiom: "试试更地道的表达",
}

const insightArrowStyle = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  border: "none",
  padding: 0,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,.25)",
  color: "#ffffff",
  flexShrink: 0,
} as const

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export default function Dashboard() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [words, setWords] = useState<VocabWord[]>([])
  const [loading, setLoading] = useState(true)
  const [insightIndex, setInsightIndex] = useState(0)

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

  const newLearningCount = (dist.new ?? 0) + (dist.learning ?? 0)
  const reviewWords = words
    .filter(w => w.status === "new" || w.status === "learning")
    .sort((a, b) => a.timesEncountered - b.timesEncountered)
    .slice(0, 5)
  const quickScenarios = scenarios.slice(0, 4)

  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const sessionGroups: { label: string; items: Session[] }[] = [
    { label: "今天", items: [] },
    { label: "昨天", items: [] },
    { label: "更早", items: [] },
  ]
  for (const s of sessions) {
    const d = new Date(s.startedAt)
    if (dayKey(d) === dayKey(now)) sessionGroups[0].items.push(s)
    else if (dayKey(d) === dayKey(yesterday)) sessionGroups[1].items.push(s)
    else sessionGroups[2].items.push(s)
  }
  const visibleGroups = sessionGroups.filter(g => g.items.length > 0)

  if (loading) return <p className="muted">加载中…</p>

  const greeting = now.getHours() < 12 ? "早上好" : now.getHours() < 18 ? "下午好" : "晚上好"
  const dateText = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
  const insightCount = topErrors.length
  const insightPos = insightCount === 0 ? 0 : insightIndex % insightCount
  const insightText =
    insightCount === 0
      ? "暂无错误记录，保持练习！"
      : `「${typeLabel[topErrors[insightPos][0]] ?? topErrors[insightPos][0]}」出现 ${topErrors[insightPos][1]} 次——${insightHint[topErrors[insightPos][0]] ?? "多加留意"}`

  async function speakWord(text: string) {
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      if (!r.ok) return
      const buf = await r.arrayBuffer()
      const a = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/wav" })))
      a.onended = () => URL.revokeObjectURL(a.src)
      a.onerror = () => URL.revokeObjectURL(a.src)
      a.play().catch(() => {})
    } catch {
    }
  }

  async function startPractice(scenarioId: string) {
    try {
      const r = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      })
      if (!r.ok) return
      const s = await r.json()
      if (s?.id) router.push(`/practice/${s.id}`)
    } catch {
    }
  }

  return (
    <div>
      <h1 style={{ margin: "0 0 20px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
        {greeting} <span aria-hidden="true">👋</span>
      </h1>

      <section
        className="card"
        style={{
          background: "var(--brand-grad)",
          boxShadow: "var(--shadow-hero)",
          borderRadius: "var(--radius-hero)",
          padding: 24,
          marginBottom: 24,
          color: "#ffffff",
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, opacity: 0.95 }}>
          <CalendarBlank size={16} weight="bold" aria-hidden="true" />
          {dateText}
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 17, lineHeight: 1.6 }}>
          本周你完成了{" "}
          <a href="#recent-practice" style={{ color: "inherit", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }}>
            {weekCount} 次对话
          </a>
          ，还有{" "}
          <Link href="/vocab" style={{ color: "inherit", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }}>
            {newLearningCount} 个生词
          </Link>
          待复习。
        </p>
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid rgba(255,255,255,.28)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Lightbulb size={16} weight="fill" aria-hidden="true" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{insightText}</span>
          {insightCount > 0 && (
            <>
              <button
                type="button"
                aria-label="上一条提示"
                style={insightArrowStyle}
                onClick={() => setInsightIndex((insightPos - 1 + insightCount) % insightCount)}
              >
                <CaretLeft size={12} weight="bold" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="下一条提示"
                style={insightArrowStyle}
                onClick={() => setInsightIndex((insightPos + 1) % insightCount)}
              >
                <CaretRight size={12} weight="bold" aria-hidden="true" />
              </button>
              <span style={{ display: "inline-flex", gap: 5, marginLeft: 2 }}>
                {topErrors.map(([t], i) => (
                  <span
                    key={t}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: i === insightPos ? "#ffffff" : "rgba(255,255,255,.4)",
                    }}
                  />
                ))}
              </span>
            </>
          )}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
        <section id="recent-practice" style={{ scrollMarginTop: 88 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>练习动态</h3>
            <span className="muted">共 {sessions.length} 条记录</span>
          </div>
          {sessions.length === 0 && (
            <p className="muted">
              还没有练习记录，去 <Link href="/scenarios">选一个场景</Link> 开始吧。
            </p>
          )}
          {visibleGroups.map(g => (
            <div key={g.label} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{g.label}</span>
                <span style={{ flex: 1, height: 1, background: "var(--separator-soft)" }} />
              </div>
              <div className="ios-grouped-list">
                {g.items.map(s => {
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
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            display: "grid",
                            placeItems: "center",
                            color: "#ffffff",
                            background: tile.color,
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={16} weight="fill" aria-hidden="true" />
                        </span>
                        <span style={{ fontSize: 14, lineHeight: 1.5, minWidth: 0 }}>
                          {s.report ? (
                            <>
                              你完成了 <b>{sc?.title ?? "未知场景"}</b>，<b>{s.report.corrections.length} 处</b>可改进。
                            </>
                          ) : (
                            <>
                              你练习了 <b>{sc?.title ?? "未知场景"}</b>，共 {s.turns.length} 轮对话。
                            </>
                          )}
                        </span>
                      </div>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <span className="muted" style={{ fontSize: 12 }}>{relativeTime(s.startedAt)}</span>
                        <CaretRight size={14} className="muted" aria-hidden="true" />
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card" style={{ marginBottom: 0 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>待复习生词</h3>
            {reviewWords.length === 0 && <p className="muted" style={{ margin: 0 }}>暂无待复习生词。</p>}
            {reviewWords.map((w, i) => (
              <div
                key={w.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "9px 0",
                  borderTop: i === 0 ? "none" : "0.5px solid var(--separator-soft)",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {w.word}
                </span>
                <span className={"vocab-status-pill " + w.status} style={{ flexShrink: 0 }}>{statusLabel[w.status]}</span>
                <button type="button" className="icon-inline" aria-label={`发音：${w.word}`} onClick={() => speakWord(w.word)}>
                  <SpeakerHigh size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </section>

          <section>
            <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>场景</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {quickScenarios.map(sc => {
                const tile = scenarioTiles[sc.id] ?? { Icon: ChatCircleDots, color: "#8E8E93" }
                const Icon = tile.Icon
                return (
                  <button
                    key={sc.id}
                    type="button"
                    className="card"
                    style={{
                      marginBottom: 0,
                      padding: 12,
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "var(--font)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                    }}
                    onClick={() => startPractice(sc.id)}
                  >
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        display: "grid",
                        placeItems: "center",
                        background: `${tile.color}1F`,
                        color: tile.color,
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={20} weight="fill" aria-hidden="true" />
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--label)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sc.title}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
