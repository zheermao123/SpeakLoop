import { chromium } from "playwright"

const s = await (
  await fetch("http://localhost:3000/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId: "builtin-interview" }),
  })
).json()

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.addInitScript(() => {
  window.__audios = []
  const Orig = window.Audio
  window.Audio = function (url) {
    const el = new Orig(url)
    const rec = { duration: -1, endedAt: -1, error: null, playCalls: 0 }
    window.__audios.push(rec)
    el.addEventListener("loadedmetadata", () => {
      rec.duration = el.duration
    })
    el.addEventListener("ended", () => {
      rec.endedAt = el.currentTime
    })
    el.addEventListener("error", () => {
      rec.error = el.error ? el.error.code : "unknown"
    })
    const origPlay = el.play.bind(el)
    el.play = () => {
      rec.playCalls++
      return origPlay()
    }
    return el
  }
})

page.on("console", m => {
  if (m.type() === "error") console.log("CONSOLE-ERR:", m.text().slice(0, 200))
})
page.on("response", r => {
  if (r.url().includes("/api/tts")) {
    console.log(`TTS response: status=${r.status()} len=${r.headers()["content-length"] ?? "?"}`)
  }
})

await page.goto(`http://localhost:3000/practice/${s.id}`, { waitUntil: "domcontentloaded" })
await page.waitForTimeout(3000)
console.log("clicking speak button for goal 0 ...")
await page.locator('button[aria-label="朗读目标 0"]').click()

for (const t of [15, 25, 35, 45, 55]) {
  await page.waitForTimeout(10000)
  const st = await page.evaluate(() => (window.__audios || []).map(a => ({
    duration: a.duration, endedAt: a.endedAt, error: a.error, playCalls: a.playCalls,
  })))
  console.log(`t=${t}s`, JSON.stringify(st))
}
await browser.close()
