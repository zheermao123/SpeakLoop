import { ChatProvider, getChat } from "@/lib/providers/types"
import { read, update } from "@/lib/store/json-store"

export interface DictEntry {
  word: string
  phonetic: string
  pos: string
  meaning: string
  example: string
  createdAt: string
}

export async function lookupWord(word: string, sentence: string, chat?: ChatProvider): Promise<DictEntry> {
  const key = word.trim().toLowerCase()
  const cached = (await read<DictEntry>("dictionary")).find(e => e.word === key)
  if (cached) return cached
  const provider = chat ?? (await getChat())
  const system =
    "You are an English dictionary for Chinese learners. Output ONLY a JSON object: " +
    '{"phonetic":string(IPA, empty if unsure),"pos":string(part of speech abbreviation like n./v./adj.),' +
    '"meaning":string(简明中文释义, 一行),"example":string(一句英文例句, 贴合给定句子语境)}'
  const raw = await provider.chat(system, [
    { role: "user", content: `word: ${word}${sentence ? `\nsentence: ${sentence}` : ""}` },
  ])
  let parsed: Partial<DictEntry>
  try {
    const t = raw.trim()
    const s = t.indexOf("{")
    const e = t.lastIndexOf("}")
    parsed = s >= 0 && e > s ? JSON.parse(t.slice(s, e + 1)) : {}
  } catch {
    parsed = {}
  }
  const entry: DictEntry = {
    word: key,
    phonetic: String(parsed.phonetic ?? ""),
    pos: String(parsed.pos ?? ""),
    meaning: String(parsed.meaning ?? "").trim() || `（释义生成失败）${key}`,
    example: String(parsed.example ?? ""),
    createdAt: new Date().toISOString(),
  }
  await update<DictEntry>("dictionary", d => [...d.filter(e => e.word !== key), entry])
  return entry
}
