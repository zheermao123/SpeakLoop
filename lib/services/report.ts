import { Report, ReportCorrection, Turn } from "@/lib/domain/types"
import { RawReport, tolerantParse } from "@/lib/report-schema"
import { getChat } from "@/lib/providers/types"
import { endSession, getSession, saveReport } from "@/lib/services/practice"
import { listWords, markUsedInSession } from "@/lib/services/vocab"

export class ReportParseError extends Error {
  constructor(public raw: string) {
    super("report parse failed")
  }
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()

export function backfillCorrections(raw: RawReport, turns: Turn[]): ReportCorrection[] {
  const out: ReportCorrection[] = []
  for (const c of raw.corrections) {
    const n = norm(c.original)
    if (!n) continue
    let turn = turns.find(t => t.id === c.turnId && norm(t.userText).length > 0)
    if (!turn) turn = turns.find(t => norm(t.userText).includes(n) || n.includes(norm(t.userText)))
    if (!turn) {
      console.warn("[report] drop hallucinated correction:", c.original)
      continue
    }
    out.push({ turnId: turn.id, original: c.original, type: c.type, improved: c.improved, explanation: c.explanation })
  }
  return out
}

const REPORT_SYSTEM =
  "You are a spoken-English report analyzer. Output ONLY a JSON object: " +
  '{"summary":string(中文总评),"highlights":string[](中文亮点,1-3条),' +
  '"corrections":[{turnId:string,original:string(原样引用该轮用户原句,不得改写),' +
  '"type":"grammar"|"vocab"|"idiom",improved:string(更地道英文),explanation:string(中文解释)}],' +
  '"vocabCandidates":[{word:string,translation:string,example:string(英文例句)}]}. ' +
  "Analyze ONLY the turns given in the transcript. Every correction MUST carry the turnId shown in [brackets]. Never invent sentences."

export async function generateReport(sessionId: string): Promise<Report> {
  const session = await getSession(sessionId)
  if (!session) throw new Error("session not found")
  const transcript = session.turns.map(t => `[${t.id}] ${t.userText}`).join("\n")
  const rawText = await getChat().chat(REPORT_SYSTEM, [
    { role: "user", content: `Transcript:\n${transcript}` },
  ])
  const parsed = tolerantParse(rawText)
  if (!parsed) throw new ReportParseError(rawText)
  const corrections = backfillCorrections(parsed, session.turns)
  const report: Report = {
    sessionId,
    summary: parsed.summary,
    highlights: parsed.highlights,
    corrections,
    vocabCandidates: parsed.vocabCandidates,
  }
  const all = await listWords()
  const active = all.filter(w => w.status === "new" || w.status === "learning")
  const fullText = session.turns.map(t => `${t.userText} ${t.aiText}`).join("\n")
  await markUsedInSession(active, fullText)
  await saveReport(sessionId, report)
  await endSession(sessionId)
  return report
}
