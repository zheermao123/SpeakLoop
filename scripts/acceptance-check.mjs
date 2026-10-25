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
const errors = []
page.on("pageerror", e => errors.push(String(e).slice(0, 150)))
page.on("console", m => {
  if (m.type() === "error") errors.push(m.text().slice(0, 150))
})

await page.goto(`http://localhost:3000/practice/${s.id}`, { waitUntil: "domcontentloaded" })
await page.waitForTimeout(2500)

const results = []
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " | " + detail : ""}`)
}

const goal0 = page.locator('[role="listitem"]').first()
const t0 = Date.now()
await goal0.hover()
try {
  await page.waitForFunction(
    () => {
      const el = document.querySelector(".zh-line")
      return el && el.textContent.trim().length > 3 && !el.textContent.includes("翻译中") && !el.textContent.includes("翻译失败")
    },
    { timeout: 30000 }
  )
} catch {}
const zh = (await page.locator(".zh-line").first().textContent().catch(() => "")) || ""
const firstMs = Date.now() - t0
check("悬停出译文", zh.length > 3, `${firstMs}ms, "${zh.replace("译文", "").trim()}"`)
check("译文内容正确（非AI自述）", !zh.includes("AI助手") && !zh.includes("AI 助手"), "含AI自述则失败")
check("译文语义命中（介绍）", zh.includes("介绍"))

await page.mouse.move(5, 5)
await page.waitForTimeout(500)
const hiddenCount = await page.locator(".zh-line").count()
check("鼠标离开译文消失", hiddenCount === 0, `zh-line count=${hiddenCount}`)

const t1 = Date.now()
await goal0.hover()
try {
  await page.waitForFunction(
    () => {
      const el = document.querySelector(".zh-line")
      return el && el.textContent.trim().length > 3 && !el.textContent.includes("翻译中")
    },
    { timeout: 6000 }
  )
} catch {}
const reMs = Date.now() - t1
check("复悬停即时复现（缓存）", reMs < 1500, `${reMs}ms`)

await page.mouse.move(5, 5)
await page.waitForTimeout(300)

const tClick = Date.now()
await page.locator('button[aria-label="朗读目标 0"]').click()
let synthSeen = false
let playSeen = false
try {
  await page.waitForFunction(() => document.body.textContent.includes("合成中"), null, { timeout: 8000 })
  synthSeen = true
} catch {}
try {
  await page.waitForFunction(() => document.body.textContent.includes("播放中"), null, { timeout: 150000 })
  playSeen = true
} catch {}
const playAt = Date.now() - tClick
let cleared = false
try {
  await page.waitForFunction(
    () => !document.body.textContent.includes("播放中") && !document.body.textContent.includes("合成中"),
    null, { timeout: 30000 }
  )
  cleared = true
} catch {}
const doneAt = Date.now() - tClick
check("朗读进度：合成中", synthSeen)
check("朗读进度：播放中", playSeen, `合成→播放 ${playAt}ms`)
check("朗读进度：结束清除", cleared, `全流程 ${doneAt}ms`)

for (const path of ["/", "/scenarios", "/settings", "/vocab"]) {
  try {
    await page.goto(`http://localhost:3000${path}`, { waitUntil: "domcontentloaded", timeout: 30000 })
    const body = await page.locator("body").textContent()
    const ok = !body.includes("Application error") && !body.includes("client-side exception")
    check(`回归页面 ${path}`, ok)
  } catch {
    check(`回归页面 ${path}`, false, "load failed")
  }
}
check("控制台零错误", errors.length === 0, errors.slice(0, 2).join(" ; "))

await browser.close()
const pass = results.filter(r => r.ok).length
console.log(`\n== 验收: ${pass}/${results.length} PASS ==`)
process.exit(pass === results.length ? 0 : 1)
