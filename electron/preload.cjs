const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("electronAPI", {
  isDesktopApp: true,
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  restartVoiceServices: () => ipcRenderer.invoke("service:restart-voice"),
})
