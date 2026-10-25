import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const isWin = process.platform === "win32"
const devUrl = "http://localhost:3000"

function spawnCmd(command, args, options) {
  return spawn(isWin ? `${command}.cmd` : command, args, {
    ...options,
    shell: isWin,
  })
}

function killTree(proc) {
  if (!proc || proc.exitCode !== null || proc.killed) return
  if (isWin) {
    spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    })
  } else {
    proc.kill("SIGTERM")
  }
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return false
}

const devProc = spawnCmd("npm", ["run", "dev"], {
  cwd: repoRoot,
  stdio: "inherit",
  windowsHide: false,
})

devProc.on("error", err => {
  console.error("[electron-dev] failed to start dev server:", err.message)
  process.exit(1)
})

const ready = await waitForServer(devUrl, 60000)
if (!ready) {
  console.error("[electron-dev] dev server did not respond within 60s")
  killTree(devProc)
  process.exit(1)
}

const electronProc = spawnCmd("npx", ["electron", "."], {
  cwd: repoRoot,
  env: { ...process.env, ELECTRON_START_URL: devUrl },
  stdio: "inherit",
  windowsHide: false,
})

electronProc.on("error", err => {
  console.error("[electron-dev] failed to start electron:", err.message)
  killTree(devProc)
  process.exit(1)
})

electronProc.on("exit", code => {
  killTree(devProc)
  process.exit(code ?? 0)
})

process.on("SIGINT", () => {
  killTree(electronProc)
  killTree(devProc)
  process.exit(130)
})
