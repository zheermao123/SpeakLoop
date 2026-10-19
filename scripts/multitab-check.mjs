import { chromium } from "playwright"

const state = async label => {
  const urls = ["http://localhost:3000/api/scenarios", "http://127.0.0.1:8100/health", "http://127.0.0.1:8101/health"]
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

const browser = await chromium.launch({ headless: true })
const p1 = await browser.newPage()
const p2 = await browser.newPage()
await p1.goto("http://localhost:3000", { waitUntil: "domcontentloaded" })
await p2.goto("http://localhost:3000/scenarios", { waitUntil: "domcontentloaded" })
await p1.waitForTimeout(3000)
await state("t0 (two tabs open)")

await p1.close()
console.log("closed tab1")
await p2.waitForTimeout(8000)
await state("after closing 1 of 2 tabs (expect 200/200/200)")

await browser.close()
console.log("closed last tab")
await new Promise(r => setTimeout(r, 7000))
await state("7s after closing last tab (expect down/down/down)")
