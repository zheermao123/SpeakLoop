import { chromium } from "playwright"
import { mkdirSync } from "node:fs"

const BASE = "http://localhost:3000"
const SHOT = "debug-shots"
mkdirSync(SHOT, { recursive: true })

const results = []
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`)
}

const browser = await chromium.launch({ headless: false, slowMo: 120 })
const page = await browser.newPage({ viewport: { width: 1100, height: 850 } })

try {
  await page.goto(BASE, { waitUntil: "networkidle" })
  check("仪表盘渲染", await page.locator(".stat").first().isVisible())
  await page.screenshot({ path: `${SHOT}/01-dashboard.png` })

  await page.goto(`${BASE}/scenarios`, { waitUntil: "networkidle" })
  const cards = await page.locator(".card.row").count()
  check("场景卡片=4", cards >= 4, `got ${cards}`)
  await page.screenshot({ path: `${SHOT}/02-scenarios.png` })

  await page.locator(".card.row", { hasText: "英文面试" }).locator("button", { hasText: "开始练习" }).click()
  await page.waitForURL(/\/practice\//, { timeout: 15000 })
  check("进入对话页", true)
  await page.waitForSelector(".goal-done, .muted", { timeout: 10000 })

  const kb = page.locator("input[placeholder*='键盘']")
  await kb.fill("I am a senior engineer with eight years of experience scaling backend systems.")
  await kb.press("Enter")

  const t0 = Date.now()
  await page.waitForFunction(
    () => {
      const ai = [...document.querySelectorAll(".bubble-ai")]
      return ai.length > 0 && ai[ai.length - 1].textContent.trim().length > 40
    },
    { timeout: 90000 }
  )
  const streamMs = Date.now() - t0
  const lastAi = await page.locator(".bubble-ai").last().textContent()
  check("SSE 流式回复(真实DeepSeek)", lastAi.includes("Sarah") || lastAi.length > 40, `${streamMs}ms`)
  check("标记不可见(气泡)", !lastAi.includes("GOAL_DONE"))

  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${SHOT}/03-practice-stream.png` })

  await page.locator("button", { hasText: "听不懂" }).click()
  await page.waitForSelector(".bubble-coach", { timeout: 60000 })
  check("听不懂教练气泡", true)
  await page.locator("button", { hasText: "提示" }).click()
  await page.waitForFunction(() => document.querySelectorAll(".bubble-coach").length >= 2, { timeout: 60000 })
  check("提示教练气泡", true)
  await page.screenshot({ path: `${SHOT}/04-coach.png` })

  await kb.fill("I led the migration of our monolith to microservices and mentored three juniors. That covers my background.")
  await kb.press("Enter")
  await page.waitForFunction(
    () => {
      const goals = [...document.querySelectorAll(".goal-done")]
      return goals.length >= 1
    },
    { timeout: 90000 }
  )
  check("goals 进度打勾", true)
  await page.screenshot({ path: `${SHOT}/05-goal-progress.png` })

  await page.locator("button", { hasText: "结束练习" }).click()
  await page.waitForURL(/\/report\//, { timeout: 120000 })
  await page.waitForSelector(".card", { timeout: 60000 })
  const reportText = await page.locator("body").textContent()
  check("报告页渲染", reportText.includes("总评") || reportText.includes("练习报告"))
  check("报告无标记泄漏", !reportText.includes("GOAL_DONE"))
  await page.screenshot({ path: `${SHOT}/06-report.png`, fullPage: true })

  await page.goto(`${BASE}/vocab`, { waitUntil: "networkidle" })
  await page.screenshot({ path: `${SHOT}/07-vocab.png` })
  check("生词本可达", true)
} catch (e) {
  check("流程异常中断", false, String(e).slice(0, 200))
  await page.screenshot({ path: `${SHOT}/99-error.png`, fullPage: true }).catch(() => {})
} finally {
  await browser.close()
  const pass = results.filter(r => r.ok).length
  console.log(`\n== 浏览器验证: ${pass}/${results.length} PASS ==`)
  process.exit(pass === results.length ? 0 : 1)
}
