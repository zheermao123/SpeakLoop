export {}

declare global {
  interface Window {
    electronAPI?: {
      isDesktopApp: boolean
      minimize: () => Promise<void>
      toggleMaximize: () => Promise<void>
      close: () => Promise<void>
      restartVoiceServices: () => Promise<{ ok: boolean }>
    }
  }
}
