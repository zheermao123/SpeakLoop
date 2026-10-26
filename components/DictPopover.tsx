"use client"

import * as Popover from "@radix-ui/react-popover"
import { useEffect, useState } from "react"

type State = {
  status: "loading" | "ready" | "error"
  entry?: { word: string; phonetic: string; pos: string; meaning: string; example: string }
  error?: string
}

export default function DictPopover({ word, sentence, anchor, onClose, sessionId }: { word: string; sentence: string; anchor: DOMRect; onClose: () => void; sessionId?: string }) {
  const [state, setState] = useState<State>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  const [addState, setAddState] = useState<"idle" | "done" | "error">("idle")

  useEffect(() => {
    let alive = true
    setState({ status: "loading" })
    setAddState("idle")
    fetch("/api/dictionary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, sentence }),
    })
      .then(async r => {
        if (!r.ok) {
          const j = await r.json()
          throw new Error(j.error ?? `查询失败 (${r.status})`)
        }
        return r.json()
      })
      .then(j => {
        if (alive) setState({ status: "ready", entry: { word: j.word, phonetic: j.phonetic, pos: j.pos, meaning: j.meaning, example: j.example } })
      })
      .catch((e: unknown) => {
        if (alive) setState({ status: "error", error: e instanceof Error ? e.message : "查询失败" })
      })
    return () => {
      alive = false
    }
  }, [word, sentence, attempt])

  const addVocab = async () => {
    if (!state.entry) return
    try {
      const r = await fetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, translation: state.entry.meaning, example: state.entry.example, sourceSessionId: sessionId ?? "", status: "new" }),
      })
      if (!r.ok) throw new Error("加入失败")
      setAddState("done")
    } catch {
      setAddState("error")
    }
  }

  return (
    <Popover.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Popover.Anchor asChild>
        <span style={{ position: "fixed", left: anchor.left, top: anchor.bottom, width: 1, height: 1 }} />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          className="popover"
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          style={{ width: "auto", minWidth: 220, maxWidth: 300 }}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (e.target instanceof Element && e.target.closest(".word-chip")) e.preventDefault()
          }}
          aria-label={`词意：${word}`}
        >
          {state.status === "loading" && <p className="muted">查询中…</p>}
          {state.status === "error" && (
            <>
              <p>{state.error}</p>
              <button className="btn btn-secondary" style={{ minHeight: 32 }} onClick={() => setAttempt(a => a + 1)}>
                重试
              </button>
            </>
          )}
          {state.status === "ready" && state.entry && (
            <>
              <div className="row">
                <b>{word}</b>
                {state.entry.phonetic ? <span className="muted">{state.entry.phonetic}</span> : null}
                {state.entry.pos ? <span className="chip">{state.entry.pos}</span> : null}
              </div>
              <div>{state.entry.meaning}</div>
              {state.entry.example ? <p className="muted">{state.entry.example}</p> : null}
              <button className="btn btn-secondary mt-2" style={{ minHeight: 32 }} disabled={addState === "done"} onClick={addVocab}>
                {addState === "done" ? "已在生词本" : addState === "error" ? "加入失败，重试" : "加入生词本"}
              </button>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
