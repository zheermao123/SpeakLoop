"use client"

import { App } from "konsta/react"
import { useEffect } from "react"

export default function KonstaApp({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { isDesktopApp?: boolean } }).electronAPI
    if (api?.isDesktopApp) document.documentElement.classList.add("electron")
  }, [])
  return <App theme="ios">{children}</App>
}
