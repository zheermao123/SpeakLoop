"use client"

import { useEffect, useState } from "react"
import { relativeTime } from "@/lib/format"
import { VocabStatus, VocabWord } from "@/lib/domain/types"

const statusLabel: Record<VocabStatus, string> = { new: "新词", learning: "学习中", mastered: "已掌握", ignored: "已忽略" }

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

  return (
    <div>
      <h3>生词本（{words.length}）</h3>
      {words.length === 0 && <p className="muted">暂无生词。完成一次练习并在报告中采纳候选后，这里会有内容。</p>}
      {words.length > 0 && (
        <div className="ios-grouped-list">
          {words.map(w => (
            <div key={w.id} className="ios-grouped-row">
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <div><b style={{ fontWeight: 700 }}>{w.word}</b> <span className="muted">{w.translation}</span></div>
                <div className="muted" style={{ fontStyle: "italic" }}>{w.example}</div>
                <div className="muted" style={{ fontSize: 12 }}>已使用 {w.timesEncountered} 次{w.lastUsedAt ? ` · 上次使用 ${relativeTime(w.lastUsedAt)}` : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <select className={"vocab-status-pill " + w.status} style={{ width: "auto", minHeight: 32 }} aria-label={`状态：${w.word}`} value={w.status} onChange={e => change(w.id, e.target.value as VocabStatus)}>
                  {(["new", "learning", "mastered", "ignored"] as VocabStatus[]).map(s => (
                    <option key={s} value={s}>{statusLabel[s]}</option>
                  ))}
                </select>
                <button type="button" className="btn" style={{ minHeight: 32, padding: "4px 12px", fontSize: 13, background: "var(--tint-red)", color: "var(--ios-red)", boxShadow: "none" }} onClick={() => remove(w.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
