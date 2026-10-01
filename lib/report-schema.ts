import { z } from "zod"

export const reportSchema = z.object({
  summary: z.string().default(""),
  highlights: z.array(z.string()).default([]),
  corrections: z
    .array(
      z.object({
        turnId: z.string().default(""),
        original: z.string(),
        type: z.enum(["grammar", "vocab", "idiom"]).default("vocab"),
        improved: z.string().default(""),
        explanation: z.string().default(""),
      })
    )
    .default([]),
  vocabCandidates: z
    .array(z.object({ word: z.string(), translation: z.string().default(""), example: z.string().default("") }))
    .default([]),
})

export type RawReport = z.infer<typeof reportSchema>

function balancedJsonCandidates(t: string): string[] {
  const out: string[] = []
  const stack: number[] = []
  let inStr = false
  let esc = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (esc) { esc = false; continue }
    if (c === "\\") { esc = true; continue }
    if (c === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (c === "{") stack.push(i)
    else if (c === "}" && stack.length) {
      const s = stack.pop()!
      if (stack.length === 0) out.push(t.slice(s, i + 1))
    }
  }
  return out
}

export function tolerantParse(text: string): RawReport | null {
  let t = text.trim()
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) t = fenced[1].trim()
  const candidates: string[] = []
  const start = t.indexOf("{")
  const end = t.lastIndexOf("}")
  if (start !== -1 && end > start) candidates.push(t.slice(start, end + 1))
  candidates.push(...balancedJsonCandidates(t))
  for (const c of candidates) {
    try {
      return reportSchema.parse(JSON.parse(c))
    } catch {
      continue
    }
  }
  return null
}
