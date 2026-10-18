export type WordToken = { type: "word" | "text"; value: string }

export function tokenizeWords(text: string): WordToken[] {
  const tokens: WordToken[] = []
  const re = /[A-Za-z]+(?:'[A-Za-z]+)?/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) tokens.push({ type: "text", value: text.slice(last, m.index) })
    tokens.push({ type: "word", value: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) })
  return tokens
}

export function hasCjk(text: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(text)
}
