"use client"

import { tokenizeWords } from "@/lib/word-token"

export default function WordText({ text, onWordClick, activeWord }: { text: string; onWordClick?: (word: string, el: HTMLSpanElement) => void; activeWord?: string }) {
  const tokens = tokenizeWords(text)
  return (
    <>
      {tokens.map((t, i) =>
        t.type === "word" ? (
          <span
            key={i}
            role="button"
            tabIndex={-1}
            className={`word-chip${activeWord && activeWord.toLowerCase() === t.value.toLowerCase() ? " active" : ""}`}
            aria-label={`查询 ${t.value}`}
            onClick={e => onWordClick?.(t.value, e.currentTarget)}
          >
            {t.value}
          </span>
        ) : (
          <span key={i}>{t.value}</span>
        )
      )}
    </>
  )
}
