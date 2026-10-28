"use client"

import { Briefcase, ChatCircleDots, Coffee, Presentation, Users } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Scenario } from "@/lib/domain/types"

const scenarioTiles: Record<string, { Icon: typeof ChatCircleDots; color: string }> = {
  "builtin-interview": { Icon: Briefcase, color: "#007AFF" },
  "builtin-standup": { Icon: Presentation, color: "#5856D6" },
  "builtin-oneonone": { Icon: Users, color: "#30B0C7" },
  "builtin-smalltalk": { Icon: Coffee, color: "#FF9500" },
}

const fieldStyle = { backgroundColor: "#ffffff", border: "1px solid rgba(0, 0, 0, 0.08)", borderRadius: 12 }

const emptyDraft: Scenario = {
  id: "", title: "", persona: "", personaZh: "", goals: [], difficulty: "medium", builtin: false,
}

export default function ScenariosPage() {
  const router = useRouter()
  const [list, setList] = useState<Scenario[]>([])
  const [description, setDescription] = useState("")
  const [draft, setDraft] = useState<Scenario | null>(null)
  const [goalsText, setGoalsText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const load = () => fetch("/api/scenarios").then(r => r.json()).then(setList).catch(() => {})
  useEffect(() => { load() }, [])

  async function startPractice(scenarioId: string) {
    setError("")
    try {
      const r = await fetch("/api/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      })
      if (!r.ok) throw new Error(`创建练习失败 (${r.status})`)
      const s = await r.json()
      if (!s?.id) throw new Error("创建练习失败：无效响应")
      router.push(`/practice/${s.id}`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function genDraft() {
    setBusy(true); setError("")
    try {
      const r = await fetch("/api/scenarios/draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      })
      if (!r.ok) throw new Error(`草稿生成失败 (${r.status})`)
      const d: Scenario = await r.json()
      setDraft(d)
      setGoalsText(d.goals.join("\n"))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function saveDraft() {
    if (!draft) return
    setBusy(true); setError("")
    try {
      const r = await fetch("/api/scenarios", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title, persona: draft.persona,
          personaZh: draft.personaZh?.trim() || undefined,
          goals: goalsText.split("\n").map(s => s.trim()).filter(Boolean),
          difficulty: draft.difficulty,
        }),
      })
      if (!r.ok) throw new Error(`保存失败 (${r.status})`)
      const saved = await r.json()
      if (!saved?.id) throw new Error("保存失败：无效响应")
      setDraft(null)
      setDescription("")
      await load()
      await startPractice(saved.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 style={{ margin: "0 0 20px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>选择场景</h1>
      {error && <div className="card"><span className="muted">{error}</span></div>}
      {list.map(s => {
        const tile = scenarioTiles[s.id] ?? { Icon: ChatCircleDots, color: "#8E8E93" }
        const Icon = tile.Icon
        return (
          <div key={s.id} className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px" }}>
            <span
              aria-hidden="true"
              style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: `${tile.color}1F`, color: tile.color, flexShrink: 0 }}
            >
              <Icon size={20} weight="fill" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{s.title}</div>
              <div className="muted" style={{ marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.personaZh || s.persona}
              </div>
            </div>
            <span className="chip" style={{ flexShrink: 0 }}>{s.difficulty}</span>
            <button
              className="btn"
              style={{ minHeight: 36, padding: "0 18px", borderRadius: 999, fontSize: 13, flexShrink: 0 }}
              disabled={busy}
              onClick={() => startPractice(s.id)}
            >
              开始练习
            </button>
          </div>
        )
      })}
      <h3 style={{ margin: "28px 0 12px", fontSize: 20, letterSpacing: "-0.02em" }}>自定义场景</h3>
      <div className="card">
        <label className="field">场景描述 <span className="req">*</span></label>
        <textarea className="input" style={fieldStyle} rows={2} placeholder="用中文描述场景，如：和外国客户谈判交期"
          value={description} onChange={e => setDescription(e.target.value)} />
        <button className="btn mt-2" disabled={busy || !description.trim()} onClick={genDraft}>
          生成草稿
        </button>
        {draft && (
          <div className="mt-3">
            <label className="field">标题 <span className="req">*</span></label>
            <input className="input" style={fieldStyle} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
            <label className="field">AI 角色设定（英文） <span className="req">*</span></label>
            <textarea className="input" style={fieldStyle} rows={2} value={draft.persona}
              onChange={e => setDraft({ ...draft, persona: e.target.value })} />
            <label className="field">AI 角色设定的中文翻译（选填——留空显示英文原文）</label>
            <textarea className="input" style={fieldStyle} rows={2} value={draft.personaZh ?? ""}
              onChange={e => setDraft({ ...draft, personaZh: e.target.value })} />
            <label className="field">练习目标（每行一个，英文） <span className="req">*</span></label>
            <textarea className="input" style={fieldStyle} rows={3} value={goalsText}
              onChange={e => setGoalsText(e.target.value)} />
            <label className="field">难度</label>
            <select className="input" style={fieldStyle} value={draft.difficulty}
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
