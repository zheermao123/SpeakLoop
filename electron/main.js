import { app, BrowserWindow, dialog, ipcMain, session } from "electron"
import { spawn } from "node:child_process"
import fs from "node:fs"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const devStartUrl = process.env.ELECTRON_START_URL || null
const devMode = Boolean(devStartUrl)

let appRoot = null
let userDataDir = null
let win = null
let nextProc = null
let serverPort = null
let isQuitting = false

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function readBuildMeta() {
  try {
    return JSON.parse(fs.readFileSync(path.join(appRoot, "electron", "build-meta.json"), "utf8"))
  } catch {
    return null
  }
}

function parseEnvFile(file) {
  const parsed = {}
  let text
  try {
    text = fs.readFileSync(file, "utf8")
  } catch {
    return parsed
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (!key) continue
    let value = trimmed.slice(eq + 1).trim()
    if (value.length >= 2) {
      const first = value[0]
      const last = value[value.length - 1]
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1)
      }
    }
    parsed[key] = value
  }
  return parsed
}

function copyEnvFile() {
  const target = path.join(userDataDir, ".env")
  if (fs.existsSync(target)) return
  const meta = readBuildMeta()
  const candidates = [
    process.env.SPEAKLOOP_ENV_SRC,
    meta?.repoRoot ? path.join(meta.repoRoot, ".env") : null,
    path.join(process.cwd(), ".env"),
  ].filter(Boolean)
  for (const src of candidates) {
    try {
      if (!fs.existsSync(src) || !fs.statSync(src).isFile()) continue
      fs.copyFileSync(src, target)
      return
    } catch (err) {
      console.error("[main] env copy failed:", err.message)
    }
  }
}

function migrateData() {
  const rawDataDir = path.join(userDataDir, "data")
  if (!fs.existsSync(rawDataDir)) {
    const meta = readBuildMeta()
    const candidates = [
      process.env.SPEAKLOOP_DATA_SRC,
      meta?.repoRoot ? path.join(meta.repoRoot, "data") : null,
      path.join(process.cwd(), "data"),
    ].filter(Boolean)
    for (const src of candidates) {
      try {
        if (!fs.statSync(src).isDirectory() || fs.readdirSync(src).length === 0) continue
        fs.cpSync(src, rawDataDir, { recursive: true })
        fs.writeFileSync(
          path.join(userDataDir, ".data-migrated"),
          `${new Date().toISOString()}\n${src}\n`,
          "utf8",
        )
        break
      } catch (err) {
        console.error("[main] data migration failed:", err.message)
      }
    }
  }
  copyEnvFile()
}

function loadUserDataEnv() {
  const env = parseEnvFile(path.join(userDataDir, ".env"))
  const keys = Object.keys(env)
  if (keys.length > 0) console.log("[main] userData env keys:", keys.join(","))
  return env
}

function isPortFree(port) {
  return new Promise(resolve => {
    const server = net.createServer()
    server.once("error", () => resolve(false))
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true))
    })
  })
}

async function pickFreePort(start) {
  for (let port = start; port < start + 500; port += 1) {
    if (await isPortFree(port)) return port
  }
  throw new Error("no free port available")
}

function spawnNextServer(port) {
  const standaloneDir = path.join(appRoot, ".next", "standalone")
  const dotEnv = loadUserDataEnv()
  const proc = spawn(process.execPath, [path.join(standaloneDir, "server.js")], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ...dotEnv,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      DATA_DIR: path.join(userDataDir, "data"),
      AUTO_STOP: "0",
    },
    windowsHide: true,
    stdio: "ignore",
  })
  proc.on("error", err => {
    console.error("[main] next server spawn failed:", err.message)
    if (!app.isPackaged) dialog.showErrorBox("SpeakLoop", `Next server failed to start: ${err.message}`)
  })
  proc.on("exit", code => {
    if (!isQuitting && code !== 0) console.error("[main] next server exited with code", code)
  })
  nextProc = proc
}

async function waitForServer(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return true
    } catch {}
    await delay(250)
  }
  return false
}

function scriptsDir() {
  return app.isPackaged ? path.join(process.resourcesPath, "scripts") : path.join(appRoot, "scripts")
}

function repoRootForScripts() {
  if (!app.isPackaged) return appRoot
  const meta = readBuildMeta()
  return meta?.repoRoot || process.cwd()
}

function startVoiceServices() {
  try {
    const proc = spawn(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(scriptsDir(), "start-all.ps1"),
        "-Silent",
        "-NoBrowser",
      ],
      {
        env: { ...process.env, SPEAKLOOP_REPO_ROOT: repoRootForScripts() },
        windowsHide: true,
        stdio: "ignore",
      },
    )
    proc.on("error", err => console.error("[main] start-all spawn failed:", err.message))
    proc.on("exit", code => console.log("[main] start-all exited", code))
    proc.unref()
  } catch (err) {
    console.error("[main] start-all failed:", err.message)
  }
}

async function probeHealth(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

async function restartVoiceServices() {
  startVoiceServices()
  const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    const [asr, tts] = await Promise.all([
      probeHealth("http://127.0.0.1:8100/health"),
      probeHealth("http://127.0.0.1:8101/health"),
    ])
    if (asr && tts) return { ok: true }
    await delay(1000)
  }
  return { ok: false }
}

function isAllowedOrigin(target) {
  let url
  try {
    url = new URL(target)
  } catch {
    return false
  }
  if (devStartUrl) {
    try {
      return url.origin === new URL(devStartUrl).origin
    } catch {
      return false
    }
  }
  return serverPort !== null && url.origin === `http://127.0.0.1:${serverPort}`
}

function createWindow() {
  win = new BrowserWindow({
    show: false,
    frame: false,
    width: 1120,
    height: 760,
    minWidth: 920,
    minHeight: 640,
    backgroundColor: "#F2F2F7",
    roundedCorners: true,
    resizable: true,
    maximizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === "media")
  })

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }))

  win.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedOrigin(url)) event.preventDefault()
  })

  win.once("ready-to-show", () => {
    if (!win || win.isDestroyed()) return
    win.show()
    startVoiceServices()
  })

  win.on("closed", () => {
    win = null
    app.quit()
  })
}

ipcMain.handle("window:minimize", () => {
  win?.minimize()
})

ipcMain.handle("window:toggle-maximize", () => {
  if (!win) return
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
})

ipcMain.handle("window:close", () => {
  app.quit()
})

ipcMain.handle("service:restart-voice", () => restartVoiceServices())

function killNextServer() {
  const proc = nextProc
  nextProc = null
  if (!proc || !proc.pid) return
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      })
    } else {
      proc.kill("SIGTERM")
    }
  } catch (err) {
    console.error("[main] failed to kill next server:", err.message)
  }
}

function stopVoiceServices() {
  try {
    spawn(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(scriptsDir(), "stop-all.ps1"),
        "-Quiet",
      ],
      { windowsHide: true, stdio: "ignore" },
    ).on("error", err => console.error("[main] stop-all spawn failed:", err.message))
  } catch (err) {
    console.error("[main] stop-all failed:", err.message)
  }
}

app.on("before-quit", () => {
  if (isQuitting) return
  isQuitting = true
  killNextServer()
  stopVoiceServices()
})

app.whenReady().then(async () => {
  appRoot = app.getAppPath()
  userDataDir = app.getPath("userData")

  if (devMode) {
    createWindow()
    await win.loadURL(devStartUrl)
    return
  }

  migrateData()
  createWindow()

  try {
    serverPort = await pickFreePort(3123)
    spawnNextServer(serverPort)
    const ready = await waitForServer(serverPort, 30000)
    if (!ready) console.error("[main] next server did not respond within 30s")
    if (!win) return
    await win.loadURL(`http://127.0.0.1:${serverPort}`)
  } catch (err) {
    console.error("[main] startup failed:", err.message)
    if (!app.isPackaged) dialog.showErrorBox("SpeakLoop", err.message)
  }
})
