"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Scenario } from "@/lib/domain/types"

const emptyDraft: Scenario = {
  id: "", title: "", persona: "", goals: [], difficulty: "medium", builtin: false,
}

export default function ScenariosPage() {
  const router = useRouter()
  const [list, setList] = useState<Scenario[]>([])
  const [description, setDescription] = useState("")
  const [draft, setDraft] = useState<Scenario | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => fetch("/api/scenarios").then(r => r.json()).then(setList)
  useEffect(() => { load() }, [])

  async function startPractice(scenarioId: string) {
    const s = await fetch("/api/sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId }),
    }).then(r => r.json())
    router.push(`/practice/${s.id}`)
  }

  async function genDraft() {
    setBusy(true)
    const d = await fetch("/api/scenarios/draft", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    }).then(r => r.json())
    setDraft({ ...d, goals: d.goals.join("\n") } as unknown as Scenario)
    setBusy(false)
  }

  async function saveDraft() {
    if (!draft) return
    setBusy(true)
    const saved = await fetch("/api/scenarios", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title, persona: draft.persona,
        goals: String(draft.goals).split("\n").map(s => s.trim()).filter(Boolean),
        difficulty: draft.difficulty,
      }),
    }).then(r => r.json())
    setBusy(false)
    setDraft(null)
    setDescription("")
    await load()
    await startPractice(saved.id)
  }

  return (
    <div>
      <h3>选择场景</h3>
      {list.map(s => (
        <div key={s.id} className="card row">
          <div style={{ flex: 1 }}>
            <b>{s.title}</b> <span className="chip">{s.difficulty}</span>
            <div className="muted">{s.persona}</div>
          </div>
          <button className="btn" onClick={() => startPractice(s.id)}>开始练习</button>
        </div>
      ))}
      <h3>自定义场景</h3>
      <div className="card">
        <label className="field">场景描述 <span className="req">*</span></label>
        <textarea className="input" rows={2} placeholder="用中文描述场景，如：和外国客户谈判交期"
          value={description} onChange={e => setDescription(e.target.value)} />
        <button className="btn mt-2" disabled={busy || !description.trim()} onClick={genDraft}>
          生成草稿
        </button>
        {draft && (
          <div className="mt-3">
            <label className="field">标题 <span className="req">*</span></label>
            <input className="input" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
            <label className="field">AI 角色设定（英文） <span className="req">*</span></label>
            <textarea className="input" rows={2} value={draft.persona}
              onChange={e => setDraft({ ...draft, persona: e.target.value })} />
            <label className="field">练习目标（每行一个，英文） <span className="req">*</span></label>
            <textarea className="input" rows={3} value={String(draft.goals)}
              onChange={e => setDraft({ ...draft, goals: e.target.value.split("\n") as unknown as string[] })} />
            <label className="field">难度</label>
            <select className="input" value={draft.difficulty}
              onChange={e => setDraft({ ...draft, difficulty: e.target.value as Scenario["difficulty"] })}>
              <option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option>
            </select>
            <div className="row mt-2">
              <button className="btn" disabled={busy} onClick={saveDraft}>保存并开始</button>
              <button className="btn btn-secondary" onClick={() => setDraft(null)}>取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
