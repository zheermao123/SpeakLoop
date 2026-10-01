import { randomUUID } from "node:crypto"
import { VocabStatus, VocabWord } from "@/lib/domain/types"
import { read, update } from "@/lib/store/json-store"

export async function listWords(): Promise<VocabWord[]> {
  return read<VocabWord>("vocab")
}

export async function addWord(input: {
  word: string
  translation: string
  example: string
  sourceSessionId: string
  status?: VocabStatus
}): Promise<VocabWord> {
  const key = input.word.trim().toLowerCase()
  const existing = (await listWords()).find(x => x.word.toLowerCase() === key)
  if (existing) return existing
  const word: VocabWord = {
    id: randomUUID(),
    word: input.word.trim(),
    translation: input.translation,
    example: input.example,
    sourceSessionId: input.sourceSessionId,
    status: input.status ?? "new",
    timesEncountered: 0,
    createdAt: new Date().toISOString(),
  }
  await update<VocabWord>("vocab", d => [...d, word])
  return word
}

export async function setStatus(id: string, status: VocabStatus): Promise<void> {
  await update<VocabWord>("vocab", d => d.map(x => (x.id === id ? { ...x, status } : x)))
}

export async function deleteWord(id: string): Promise<void> {
  await update<VocabWord>("vocab", d => d.filter(x => x.id !== id))
}

export function selectForInjection(words: VocabWord[], limit = 5): VocabWord[] {
  return words
    .filter(x => x.status === "new" || x.status === "learning")
    .sort((a, b) => a.timesEncountered - b.timesEncountered)
    .slice(0, limit)
}

function stripInflection(w: string): string {
  for (const suf of ["ing", "ed", "es", "s"]) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length)
  }
  return w
}

function stem(word: string): string {
  const w = stripInflection(word.toLowerCase().replace(/[^a-z]/g, ""))
  return w.endsWith("e") ? w.slice(0, -1) : w
}

function stemFamily(a: string, b: string): boolean {
  if (a === b) return true
  const [s, l] = a.length <= b.length ? [a, b] : [b, a]
  return s.length >= 5 && l.startsWith(s) && l.length - s.length <= 4
}

function stemTokens(text: string): string[] {
  return text.split(/[^A-Za-z]+/).filter(Boolean).map(stem)
}

function normalizePhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim()
}

export function containsWord(text: string, word: string): boolean {
  const target = word.trim().toLowerCase()
  if (target.includes(" ")) {
    return normalizePhrase(text).includes(normalizePhrase(target))
  }
  const t = stem(target)
  return stemTokens(text).some(tok => stemFamily(tok, t))
}

export async function markUsedInSession(active: VocabWord[], transcript: string): Promise<void> {
  const now = new Date().toISOString()
  await update<VocabWord>("vocab", words =>
    words.map(x => {
      if (!active.some(a => a.id === x.id) || !containsWord(transcript, x.word)) return x
      return {
        ...x,
        timesEncountered: x.timesEncountered + 1,
        lastUsedAt: now,
        status: x.status === "new" ? ("learning" as VocabStatus) : x.status,
      }
    })
  )
}
