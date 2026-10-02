import { chromium } from "playwright"

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 300)) })
page.on("pageerror", e => errors.push(`PAGEERROR: ${String(e).slice(0, 300)}`))

for (const path of ["/", "/scenarios", "/settings", "/vocab"]) {
  errors.length = 0
  try {
    await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle", timeout: 20000 })
    const body = await page.locator("body").textContent()
    const ok = !body.includes("Application error") && !body.includes("client-side exception")
    console.log(`${path}: loaded=${ok} consoleErrors=${errors.length}`)
    for (const e of errors) console.log(`  ERR: ${e}`)
  } catch (e) {
    console.log(`${path}: LOAD FAILED ${String(e).slice(0, 150)}`)
    for (const er of errors) console.log(`  ERR: ${er}`)
  }
}
await browser.close()
