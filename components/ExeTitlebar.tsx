"use client"

import { Squircle } from "@squircle-js/react"
import Link from "next/link"
import { useEffect, useState } from "react"

type ElectronAPI = {
  isDesktopApp?: boolean
  minimize?: () => void
  toggleMaximize?: () => void
  close?: () => void
}

function getApi(): ElectronAPI | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
}

export default function ExeTitlebar() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <header className="exe-titlebar">
      <div className="exe-titlebar-inner">
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
          SpeakLoop
        </Link>
      </div>
    </header>
  )
}
