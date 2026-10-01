export function stripGoalMarkers(s: string, goals: number[] = []): string {
  const re = /\[GOAL_DONE:(\d+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) goals.push(Number(m[1]))
  return s.replace(re, "")
}

export function trailingMarkerPrefix(s: string): number {
  const M = "[GOAL_DONE:"
  const tail = s.slice(-(M.length + 3))
  for (let n = Math.min(M.length, tail.length); n >= 1; n--) {
    if (tail.endsWith(M.slice(0, n))) return n
  }
  const dm = /\[GOAL_DONE:\d{0,3}$/.exec(tail)
  return dm ? dm[0].length : 0
}

export class SentenceStream {
  private buf = ""
  readonly goals: number[] = []
  constructor(private readonly onSentence: (s: string) => void) {}

  push(delta: string): void {
    this.buf = stripGoalMarkers(this.buf + delta, this.goals)
    this.drain(false)
  }

  flush(): void {
    this.drain(true)
  }

  private drain(final: boolean): void {
    const hold = final ? 0 : trailingMarkerPrefix(this.buf)
    const avail = hold ? this.buf.slice(0, this.buf.length - hold) : this.buf
    const m = /[.!?]+(?=\s|\n|$)/.exec(avail)
    if (m && (m.index + m[0].length < avail.length || final)) {
      const end = m.index + m[0].length
      const head = avail.slice(0, end).trim()
      if (head) this.onSentence(head)
      this.buf = this.buf.slice(end)
      this.drain(final)
      return
    }
    if (final) {
      const rest = this.buf.replace(/\s+/g, " ").trim()
      if (rest) this.onSentence(rest)
      this.buf = ""
    }
  }
}
