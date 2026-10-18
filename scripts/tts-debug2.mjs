import { chromium } from "playwright"

const SCENARIO_ID = process.argv[2]
const s = await (
  await fetch("http://localhost:3000/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId: SCENARIO_ID }),
  })
).json()

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.addInitScript(() => {
  window.__audios = []
  const Orig = window.Audio
  window.Audio = function (url) {
    const el = new Orig(url)
    const rec = { duration: -1, endedAt: -1, error: null }
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
    return el
  }
})

let reqText = ""
page.on("request", async r => {
  if (r.url().includes("/api/tts")) {
    try {
      const pd = r.postData()
      if (pd) reqText = JSON.parse(pd).text
    } catch {}
  }
})
page.on("response", async r => {
  if (r.url().includes("/api/tts")) {
    try {
      const b = await r.body()
      console.log(`TTS response: status=${r.status()} bytes=${b.length}`)
    } catch {
      console.log("TTS response: body unavailable")
    }
  }
})

await page.goto(`http://localhost:3000/practice/${s.id}`, { waitUntil: "domcontentloaded" })
await page.waitForTimeout(3000)
console.log("clicking speak button for goal 0 ...")
await page.locator('button[aria-label="朗读目标 0"]').click()

for (const t of [20, 30, 40]) {
  await page.waitForTimeout(10000)
  const st = await page.evaluate(() => window.__audios || [])
  console.log(`t=${t}s`, JSON.stringify(st))
}
console.log("posted text:", JSON.stringify(reqText))
await browser.close()
