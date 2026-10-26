# SpeakLoop iOS 化实施计划（Konsta + Framer Motion + Radix + Squircle + Electron Mica）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。步骤用复选框跟踪。

**Goal:** 将 SpeakLoop 全站视觉重构为像素级 iOS 17/18 原生风格：Konsta 控件库 + Framer Motion 物理弹簧 + @squircle-js 连续曲率 + Radix Popover/Select + Electron `backgroundMaterial:'mica'` 真透光毛玻璃。

**Architecture:** 设计系统以 `globals.css` CSS 变量 + Konsta/Tailwind 双引擎驱动；`App` 组件包裹 Konsta `theme="ios"` 管线；页面全部用 Konsta 原生控件（List/ListItem/Segmented）替换自手写 div；Electron 主进程 `backgroundMaterial:'mica'` 开启 Win11 硬件级透光。

**Tech Stack:** 既有 Next 15 + React 19 + Vitest 基线（**129 tests**）；新增 konsta、framer-motion、@squircle-js/react、@radix-ui/react-popover、@radix-ui/react-select、tailwindcss、postcss、autoprefixer、electron 33+、electron-builder。

## 已锁定决策

- A1 原生 iOS 色（`#007AFF`/`#8E8E93`/`#FF3B30` 等，对比度例外已备案）
- A2 语音后端依赖本机 conda 双环境
- A3 一次性合并交付
- A4 关闭窗口 = 退出（无系统托盘）
- B1 录音按钮无脉冲动画（仅红色态+波形图标）
- B2 悬停译文保留 F3 JS 逻辑（瞬时显示/离开即隐/懒加载/含中文跳过/译按钮切换）
- B3 导航「场景」→ `/scenarios`
- B4 练习页双栏布局，逻辑零改动
- B5 顶栏语音胶囊常驻 + 页面横幅仅非就绪时显示
- B6 EXE 首启自动迁移 `data/` → `userData/data`
- B7 仅 NSIS 安装版
- B8 蓝底 S 图标（≥256px PNG）
- B9 Electron 层仅手动冒烟清单

## Global Constraints

- 测试基线 **129**；目标 **129+N**（新增组件测试数以任务实际为准）；每任务全绿
- 类名稳定性契约不变（`muted/chip/zh-line/btn/word-chip/bubble-*`）
- **新增**：`tailwind.config.js` + `postcss.config.mjs` + Konsta 引擎；`framer-motion` 用于弹窗/切换动画
- Electron 主进程 `backgroundMaterial:'mica'`；页面 body 背景设 `rgba(242,242,247,0.72)` 半透明
- 代码无注释；既有 UI 不变量（r.ok / busy try-finally / 无 undefined 路由）延续

---

### Phase A: Konsta/Tailwind 引擎接入

**A-1** 安装依赖：
```
npm install konsta framer-motion @squircle-js/react @radix-ui/react-popover @radix-ui/react-select
npm install -D tailwindcss postcss autoprefixer
```

**A-2** `tailwind.config.js`（Konsta 引擎注入）：
```js
const konstaConfig = require('konsta/config');
module.exports = konstaConfig({
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
});
```

**A-3** `postcss.config.mjs`：
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

**A-4** `app/layout.tsx` 引入 `<App theme="ios">` 包裹 Konsta iOS 渲染管线：
```tsx
import { App } from 'konsta/react';
// body 内: <App theme="ios"> <Heartbeat /> <ExeTitlebar /> <main>…</main> </App>
```

### Phase B: 设计 token 迁移

**B-1** `globals.css` 保留自定义类（word-chip/bubble-*/speak-progress 等），删除被 Konsta/Tailwind 接管的布局类（.card/.btn/.input/.pill/.container/.nav-*）

**B-2** 新增 CSS 变量（iOS HIG 色板 + 毛玻璃材质 + Squircle 参数）：
- `--ios-blue:#007AFF` `--ios-green:#34C759` `--ios-orange:#FF9500` `--ios-red:#FF3B30` `--ios-gray:#8E8E93`
- `--bg-grouped:#F2F2F7` `--bg-card:#FFFFFF` `--separator:rgba(60,60,67,0.29)`
- `--radius-card:16px` `--radius-pill:999px` `--blur-material:saturate(180%) blur(20px)`
- `--ease-spring:cubic-bezier(0.32,0.72,0,1)` `--dur-fast:150ms` `--dur-normal:220ms`

**B-3** 语音胶囊样式（顶栏右侧）：
- 就绪：`bg-[#34C759]/15 text-[#1B7A34]`
- 离线：`bg-[#FF9500]/15 text-[#B25000] ring-1 ring-[#FF9500]/30`
- 切换动画：`transition-all duration-200`

### Phase C: 页面迁移

**C-1 顶栏**（`components/ExeTitlebar.tsx`）：
- 左：红黄绿三圆点（Electron 窗口控制，hover 暗色符号浮现）+ Squircle 品牌标（渐变蓝底白 S）
- 右：语音状态胶囊（绿就绪/橙离线，Framer Motion whileTap scale(0.95)）
- `backdrop-blur-2xl bg-white/70 border-b border-black/[0.08]` 毛玻璃底

**C-2 首页**（`app/page.tsx`）：
- 三张 Apple Health 风格卡片（白底、radius 16px、微影）：本周练习/生词进度/常见错误
- 生词进度卡：三列迷你块（蓝/橙/绿数字 + 灰底小圆角标签）
- 最近练习：Konsta `<List>` iOS Inset Grouped 风格（白底大圆角容器 + 缩进分割线 + hover 微沉）+ Squircle 图标瓦片

**C-3 练习页**（`app/practice/[id]/page.tsx`）：
- 双栏（左 sticky 场景卡+目标 / 右气泡流+底部操控台）
- 三色气泡：用户蓝渐变右对齐尾 6px / AI 白左尾 6 / 教练琥珀
- 相位计时胶囊（毛玻璃底）
- 悬停译文行 + 译按钮切换 + 录音按钮 Framer Motion 呼吸变形

### Phase D: Electron Mica 集成

**D-1** `electron/main.js`：
```js
mainWindow = new BrowserWindow({
  frame: false,
  backgroundMaterial: 'mica',    // Win11 DWM 硬件级云母透光
  vibrancy: 'under-window',      // macOS 兼容
  roundedCorners: true,
  webPreferences: { preload: ..., contextIsolation: true }
});
```

**D-2** 页面 body 背景：
```css
body { background: rgba(242,242,247,0.72); }
```
让 EXE 窗口和桌面壁纸产生柔和光学融合。

### Phase E: 网页版兼容

- 浏览器模式（无 Electron）：body 设 `#F2F2F7` 纯色底；Konsta/Tailwind 照常工作
- `AUTO_STOP=0` 仅 Electron 主进程注入；浏览器模式沿用页面心跳式自动停止

### Phase F: README

- 新增「桌面版 EXE」章节：安装版下载、Mica 透光效果、麦克风自动放行说明
- 新增「设计系统」章节：Konsta + Tailwind 双引擎、Squircle 连续曲率、Framer Motion 弹簧动效
