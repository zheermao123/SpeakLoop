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

export function tolerantParse(text: string): RawReport | null {
  let t = text.trim()
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) t = fenced[1].trim()
  const start = t.indexOf("{")
  const end = t.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  try {
    return reportSchema.parse(JSON.parse(t.slice(start, end + 1)))
  } catch {
    return null
  }
}
