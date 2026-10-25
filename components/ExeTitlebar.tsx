"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useVoiceStatus } from "@/lib/use-voice-status"

type ElectronAPI = {
  isDesktopApp?: boolean
  minimize?: () => void
  toggleMaximize?: () => void
  close?: () => void
  restartVoiceServices?: () => Promise<void> | void
}

const NAV_ITEMS = [
  { href: "/", label: "首页" },
  { href: "/scenarios", label: "场景" },
  { href: "/vocab", label: "生词本" },
  { href: "/settings", label: "设置" },
]

function getApi(): ElectronAPI | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
}

export default function ExeTitlebar() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [waking, setWaking] = useState(false)
  const voice = useVoiceStatus()

  useEffect(() => setMounted(true), [])

  async function handlePillClick() {
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

  const pill = waking
    ? { text: "正在唤醒…", background: "rgba(255,149,0,.14)", color: "#A85B00" }
    : voice.ready
      ? { text: "语音就绪", background: "rgba(52,199,89,.14)", color: "#248A3D" }
      : voice.loading
        ? {
            text: `预热中 · ${Math.max(voice.busyElapsed.stt, voice.busyElapsed.tts)}s`,
            background: "rgba(255,149,0,.14)",
            color: "#A85B00",
          }
        : { text: "引擎离线 · 一键恢复", background: "rgba(255,149,0,.14)", color: "#A85B00" }

  const pillLabel = waking
    ? "正在唤醒语音服务"
    : voice.ready
      ? "语音服务就绪，点击重启语音服务"
      : voice.loading
        ? "语音服务预热中，点击重新检查"
        : "语音引擎离线，点击一键恢复"

  return (
    <header className="exe-titlebar">
      <div className="exe-titlebar-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {mounted && getApi()?.isDesktopApp ? (
            <div className="window-traffic-lights">
              <button
                type="button"
                className="traffic-dot traffic-dot-close no-drag"
                aria-label="关闭"
                onClick={() => getApi()?.close?.()}
              />
              <button
                type="button"
                className="traffic-dot traffic-dot-min no-drag"
                aria-label="最小化"
                onClick={() => getApi()?.minimize?.()}
              />
              <button
                type="button"
                className="traffic-dot traffic-dot-max no-drag"
                aria-label="最大化"
                onClick={() => getApi()?.toggleMaximize?.()}
              />
            </div>
          ) : null}
          <Link
            href="/"
            className="no-drag"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--text-primary)",
              textDecoration: "none",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "var(--ios-blue)",
                color: "#fff",
                fontWeight: 700,
                display: "grid",
                placeItems: "center",
              }}
            >
              S
            </span>
            SpeakLoop
          </Link>
        </div>

        <nav className="ios-segmented no-drag" aria-label="主导航">
          {NAV_ITEMS.map(item => {
            const active =
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "ios-seg-item active" : "ios-seg-item"}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button
            type="button"
            className="chip no-drag"
            aria-label={pillLabel}
            onClick={handlePillClick}
            style={{
              border: 0,
              padding: "6px 12px",
              fontFamily: "inherit",
              fontWeight: 600,
              cursor: "pointer",
              background: pill.background,
              color: pill.color,
            }}
          >
            {pill.text}
          </button>
          <Link
            href="/scenarios"
            className="btn no-drag"
            style={{ minHeight: 36, padding: "6px 14px", fontSize: 14 }}
          >
            + 新练习
          </Link>
        </div>
      </div>
    </header>
  )
}
