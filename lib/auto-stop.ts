import { exec } from "node:child_process"

export interface WatchdogDeps {
  now(): number
  stop(): void | Promise<void>
  intervalMs: number
  idleMs: number
}

export interface Watchdog {
  beat(): void
  tick(): void
  readonly armed: boolean
  readonly stopped: boolean
}

export function createWatchdog(d: WatchdogDeps): Watchdog {
  let last = -1
  let stopped = false
  return {
    beat() {
      last = d.now()
    },
    tick() {
      if (stopped || last < 0) return
      if (d.now() - last > d.idleMs) {
        stopped = true
        void d.stop()
      }
    },
    get armed() {
      return last >= 0
    },
    get stopped() {
      return stopped
    },
  }
}

export function shouldAutoStop(): boolean {
  return (process.env.AUTO_STOP ?? "1") !== "0"
}

export function idleMsFromEnv(): number {
  const v = Number(process.env.AUTO_STOP_IDLE_MS)
  return Number.isFinite(v) && v >= 5000 ? v : 30000
}

function killPort(port: number): Promise<void> {
  return new Promise(resolve => {
    exec(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
      () => resolve()
    )
  })
}

export async function stopStack(): Promise<void> {
  await killPort(8100)
  await killPort(8101)
}

type GlobalWithWatchdog = typeof globalThis & { __slWatchdog?: Watchdog }

export function getWatchdog(): Watchdog {
  const g = globalThis as GlobalWithWatchdog
  if (!g.__slWatchdog) {
    g.__slWatchdog = createWatchdog({
      now: () => Date.now(),
      stop: async () => {
        await stopStack()
        process.exit(0)
      },
      intervalMs: 5000,
      idleMs: idleMsFromEnv(),
    })
  }
  return g.__slWatchdog
}

export function startWatchdogLoop(): Watchdog {
  const wd = getWatchdog()
  setInterval(() => wd.tick(), 5000)
  return wd
}
