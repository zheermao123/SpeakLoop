"use client"

import { BookOpen, GearSix, House, Rows } from "@phosphor-icons/react"
import { Squircle } from "@squircle-js/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useVoiceStatus } from "@/lib/use-voice-status"

type ElectronAPI = {
  isDesktopApp?: boolean
  restartVoiceServices?: () => Promise<void> | void
}

function getApi(): ElectronAPI | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
}

const NAV_ITEMS = [
  { href: "/", label: "仪表盘", Icon: House, exact: true },
  { href: "/scenarios", label: "场景", Icon: Rows, exact: false },
  { href: "/vocab", label: "生词本", Icon: BookOpen, exact: false },
  { href: "/settings", label: "设置", Icon: GearSix, exact: false },
]

export default function Nav() {
  const pathname = usePathname()
  const voice = useVoiceStatus()
  const [waking, setWaking] = useState(false)
  const [vocabCount, setVocabCount] = useState(0)

  useEffect(() => {
    let stopped = false
    const load = async () => {
      try {
        const r = await fetch("/api/vocab")
        if (!r.ok || stopped) return
        const words: { status: string }[] = await r.json()
        if (!stopped) {
          setVocabCount(words.filter(w => w.status === "new" || w.status === "learning").length)
        }
      } catch {
      }
    }
    void load()
    return () => {
      stopped = true
    }
  }, [])

  async function handleRestore() {
    const api = getApi()
    if (!api?.restartVoiceServices) {
      voice.refresh()
      return
    }
    setWaking(true)
    try {
      await Promise.race([
        Promise.resolve(api.restartVoiceServices()),
        new Promise<void>(resolve => setTimeout(resolve, 90000)),
      ])
    } catch {
    }
    voice.refresh()
    setWaking(false)
  }

  const offline = !voice.ready && !voice.loading
  const dotClass = voice.ready
    ? "voice-dot voice-dot-ready"
    : voice.loading
      ? "voice-dot voice-dot-loading"
      : "voice-dot voice-dot-offline"
  const voiceText = voice.ready
    ? "语音就绪"
    : voice.loading
      ? `预热中 · ${Math.max(voice.busyElapsed.stt, voice.busyElapsed.tts)}s`
      : "语音离线"

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Squircle
          aria-hidden="true"
          width={28}
          height={28}
          cornerRadius={9}
          cornerSmoothing={0.8}
          style={{
            background: "linear-gradient(135deg, #007AFF, #0062CC)",
            color: "#fff",
            fontWeight: 700,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          S
        </Squircle>
        <span className="sidebar-brand-name">SpeakLoop</span>
      </div>
      <nav className="sidebar-nav" aria-label="主导航">
        {NAV_ITEMS.map(({ href, label, Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link key={href} href={href} className={active ? "sidebar-item active" : "sidebar-item"}>
              <Icon size={18} aria-hidden="true" />
              {label}
              {href === "/vocab" && vocabCount > 0 ? (
                <span className="sidebar-badge">{vocabCount}</span>
              ) : null}
            </Link>
          )
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-voice" role="status" aria-live="polite">
          <span className={dotClass} aria-hidden="true" />
          <span>{voiceText}</span>
          {offline ? (
            <button
              type="button"
              className="sidebar-voice-restore"
              aria-busy={waking}
              disabled={waking}
              onClick={handleRestore}
            >
              {waking ? "正在唤醒…" : getApi()?.restartVoiceServices ? "一键恢复" : "恢复"}
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
