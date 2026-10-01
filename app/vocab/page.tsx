"use client"

import { useEffect, useState } from "react"
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
      {words.map(w => (
        <div key={w.id} className="card row">
          <div style={{ flex: 1 }}>
            <b>{w.word}</b> <span className="muted">{w.translation}</span>
            <div className="muted">{w.example}</div>
            <div className="muted">使用 {w.timesEncountered} 次{w.lastUsedAt ? ` · 上次 ${new Date(w.lastUsedAt).toLocaleDateString("zh-CN")}` : ""}</div>
          </div>
          <select className="input" style={{ width: 120 }} aria-label={`状态：${w.word}`} value={w.status} onChange={e => change(w.id, e.target.value as VocabStatus)}>
            {(["new", "learning", "mastered", "ignored"] as VocabStatus[]).map(s => (
              <option key={s} value={s}>{statusLabel[s]}</option>
            ))}
          </select>
          <button className="btn btn-danger" onClick={() => remove(w.id)}>删除</button>
        </div>
      ))}
    </div>
  )
}
