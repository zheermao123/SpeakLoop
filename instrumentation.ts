export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { shouldAutoStop, startWatchdogLoop } = await import("./lib/auto-stop")
  if (!shouldAutoStop()) return
  startWatchdogLoop()
}
