"use client"

import { Check, SpeakerHigh } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { relativeTime } from "@/lib/format"
import { VocabStatus, VocabWord } from "@/lib/domain/types"

const statusLabel: Record<VocabStatus, string> = { new: "未学", learning: "认识中", mastered: "已掌握", ignored: "已忽略" }
const statusOrder: VocabStatus[] = ["new", "learning", "mastered", "ignored"]

export default function VocabPage() {
  const [words, setWords] = useState<VocabWord[]>([])

  const load = () => fetch("/api/vocab").then(r => r.json()).then(setWords)
  useEffect(() => { load() }, [])

  async function change(id: string, status: VocabStatus) {
    await fetch("/api/vocab", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) })
    load()
  }

  async function remove(id: string) {
    await fetch(`/api/vocab?id=${id}`, { method: "DELETE" })
    load()
  }

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

  const groups = statusOrder
    .map(status => ({ status, items: words.filter(w => w.status === status) }))
    .filter(g => g.items.length > 0)

  return (
    <div>
      <h1 style={{ margin: "0 0 20px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>生词本（{words.length}）</h1>
      {words.length === 0 && <p className="muted">暂无生词。完成一次练习并在报告中采纳候选后，这里会有内容。</p>}
      {groups.map(g => (
        <section key={g.status} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{statusLabel[g.status]}</span>
            <span
              style={{ minWidth: 22, height: 22, padding: "0 7px", borderRadius: 999, background: "var(--fill-3)", fontSize: 12, fontWeight: 600, color: "var(--label-2)", display: "grid", placeItems: "center" }}
            >
              {g.items.length}
            </span>
            <span style={{ flex: 1, height: 1, background: "var(--separator-soft)" }} />
          </div>
          <div className="ios-grouped-list">
            {g.items.map(w => (
              <div key={w.id} className="ios-grouped-row" style={{ alignItems: "flex-start", paddingTop: 14, paddingBottom: 14 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: `2px solid ${w.status === "mastered" ? "var(--ios-green)" : "rgba(0, 0, 0, 0.15)"}`,
                    background: w.status === "mastered" ? "var(--ios-green)" : "transparent",
                    color: "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {w.status === "mastered" && <Check size={12} weight="bold" />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15 }}>
                    <b style={{ fontWeight: 700 }}>{w.word}</b> <span className="muted">{w.translation}</span>
                  </div>
                  <div className="muted" style={{ fontStyle: "italic", marginTop: 2 }}>{w.example}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    已使用 {w.timesEncountered} 次{w.lastUsedAt ? ` · 上次使用 ${relativeTime(w.lastUsedAt)}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={w.status === "mastered"}
                    aria-label={`已掌握：${w.word}`}
                    onClick={() => change(w.id, w.status === "mastered" ? "learning" : "mastered")}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: "1.5px solid var(--ios-green)",
                      background: w.status === "mastered" ? "var(--ios-green)" : "transparent",
                      color: "#ffffff",
                      display: "grid",
                      placeItems: "center",
                      padding: 0,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {w.status === "mastered" && <Check size={11} weight="bold" />}
                  </button>
                  <span className={"vocab-status-pill " + w.status}>{statusLabel[w.status]}</span>
                  <button type="button" className="icon-inline" aria-label={`发音：${w.word}`} onClick={() => speakWord(w.word)}>
                    <SpeakerHigh size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ minHeight: 32, padding: "4px 12px", fontSize: 13, background: "rgba(255, 59, 48, 0.1)", color: "var(--ios-red)", boxShadow: "none" }}
                    onClick={() => remove(w.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
