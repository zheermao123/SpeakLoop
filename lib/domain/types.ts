export interface Scenario {
  id: string
  title: string
  persona: string
  goals: string[]
  difficulty: "easy" | "medium" | "hard"
  builtin: boolean
  voice?: string
}

export interface Turn {
  id: string
  userText: string
  aiText: string
  audioUrl?: string
  duration?: number
  sttProvider: string
  confidence?: number
  createdAt: string
}

export interface ReportCorrection {
  turnId: string
  original: string
  type: "grammar" | "vocab" | "idiom"
  improved: string
  explanation: string
}

export interface Report {
  sessionId: string
  summary: string
  highlights: string[]
  corrections: ReportCorrection[]
  vocabCandidates: { word: string; translation: string; example: string }[]
}

export interface Session {
  id: string
  scenarioId: string
  startedAt: string
  endedAt?: string
  turns: Turn[]
  goalProgress?: number[]
  report?: Report
}

export type VocabStatus = "new" | "learning" | "mastered" | "ignored"

export interface VocabWord {
  id: string
  word: string
  translation: string
  example: string
  sourceSessionId: string
  status: VocabStatus
  timesEncountered: number
  lastUsedAt?: string
  createdAt: string
}
