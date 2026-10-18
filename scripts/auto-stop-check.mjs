import { chromium } from "playwright"

const check = async label => {
  const urls = [
    "http://localhost:3000/api/scenarios",
    "http://127.0.0.1:8100/health",
    "http://127.0.0.1:8101/health",
  ]
  const res = []
  for (const u of urls) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(3000) })
      res.push(String(r.status))
    } catch {
      res.push("down")
    }
  }
  console.log(`${label}: ${res.join(" / ")}`)
}

await check("t0")
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" })
await page.waitForTimeout(2000)
console.log("page open 2s (heartbeat armed)")

await page.reload({ waitUntil: "domcontentloaded" })
await page.waitForTimeout(8000)
await check("after reload+8s  [expect 200/200/200 = refresh protection OK]")

await page.goto("about:blank")
console.log("navigated away (leave beacon sent)")
await browser.close()
