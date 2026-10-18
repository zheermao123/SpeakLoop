import { ChatProvider, getChat } from "@/lib/providers/types"
import { read, update } from "@/lib/store/json-store"

export interface TranslationEntry {
  text: string
  translation: string
  createdAt: string
}

export async function translateText(text: string, chat?: ChatProvider): Promise<TranslationEntry> {
  const key = text.trim()
  const cached = (await read<TranslationEntry>("translations")).find(e => e.text === key)
  if (cached) return cached
  const provider = chat ?? (await getChat())
  const translation = (
    await provider.chat("Translate the English text to natural Chinese. Output ONLY the translation, no notes.", [
      { role: "user", content: key },
    ])
  ).trim()
  const entry: TranslationEntry = { text: key, translation, createdAt: new Date().toISOString() }
  await update<TranslationEntry>("translations", d => [...d.filter(e => e.text !== key), entry])
  return entry
}
