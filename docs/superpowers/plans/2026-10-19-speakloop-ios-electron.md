<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SpeakLoop — iOS 设计预览</title>
  <style>
    /* ═══════════════════════════════════════════════════════════════
       SpeakLoop iOS Design System — Static Preview
       浏览器直接打开即可预览设计效果，无需任何服务
       ═══════════════════════════════════════════════════════════════ */

    :root {
      color-scheme: light;

      /* iOS System Colors */
      --ios-blue: #007aff;
      --ios-green: #34c759;
      --ios-indigo: #5856d6;
      --ios-orange: #ff9500;
      --ios-red: #ff3b30;
      --ios-teal: #30b0c7;
      --ios-yellow: #ffcc00;
      --ios-gray: #8e8e93;

      /* Grouped Background */
      --bg-grouped: #f2f2f7;
      --bg-card: #ffffff;
      --bg-inset: rgba(118, 118, 128, 0.12);

      /* Label Colors */
      --label: #000000;
      --label-2: rgba(60, 60, 67, 0.6);
      --label-3: rgba(60, 60, 67, 0.3);

      /* Separator */
      --separator: rgba(60, 60, 67, 0.36);
      --separator-soft: rgba(60, 60, 67, 0.12);

      /* Fill */
      --fill-1: rgba(120, 120, 128, 0.2);
      --fill-2: rgba(120, 120, 128, 0.16);
      --fill-3: rgba(120, 120, 128, 0.12);
      --fill-4: rgba(120, 120, 128, 0.08);

      /* Materials */
      --material-nav: rgba(255, 255, 255, 0.72);
      --material-dock: rgba(255, 255, 255, 0.85);
      --material-popover: rgba(255, 255, 255, 0.82);
      --material-blur: saturate(180%) blur(20px);

      /* Shadows */
      --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
      --shadow-elevated: 0 4px 16px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.03);
      --shadow-popover: 0 10px 34px rgba(0, 0, 0, 0.14), 0 0 0 0.5px rgba(0, 0, 0, 0.06);

      /* Radius */
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 16px;
      --radius-xl: 20px;
      --radius-pill: 999px;

      /* Spacing */
      --s1: 4px;
      --s2: 8px;
      --s3: 12px;
      --s4: 16px;
      --s5: 20px;
      --s6: 24px;
      --s8: 32px;

      /* Font */
      --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif;

      /* Controls */
      --h-control: 44px;
      --h-nav: 48px;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: var(--font);
      font-size: 16px;
      line-height: 1.47;
      color: var(--label);
      background: var(--bg-grouped);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    h1, h2, h3 { font-weight: 700; letter-spacing: -0.02em; }

    a { color: var(--tint); }

    :focus { outline: none; }
    :focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.35);
      border-radius: var(--radius-sm);
    }

    ::selection { background: rgba(0, 122, 255, 0.2); }

    * { scrollbar-width: thin; scrollbar-color: var(--fill-1) transparent; }
    *::-webkit-scrollbar { width: 6px; height: 6px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb { background: var(--fill-1); border-radius: 3px; }
    *::-webkit-scrollbar-thumb:hover { background: var(--fill-2); }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
    }

    /* ── Layout ── */
    .container { max-width: 672px; margin: 0 auto; padding: var(--s4) var(--s5) 88px; }

    /* ── Frosted Nav Bar ── */
    .nav-bar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--material-nav);
      -webkit-backdrop-filter: var(--material-blur);
      backdrop-filter: var(--material-blur);
      border-bottom: 0.5px solid var(--separator-soft);
    }

    .nav-inner {
      max-width: 672px;
      margin: 0 auto;
      padding: 0 var(--s5);
      height: var(--h-nav);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .nav-brand {
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--label);
      text-decoration: none;
    }

    .nav-links {
      display: flex;
      align-items: center;
      background: var(--fill-4);
      border-radius: 9px;
      padding: 2px;
    }

    .nav-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 32px;
      padding: 0 var(--s4);
      border-radius: 7px;
      font-size: 13px;
      font-weight: 500;
      color: var(--label);
      text-decoration: none;
      transition: background 150ms ease, color 150ms ease;
    }

    .nav-link:hover { color: var(--tint); }
    .nav-link.active {
      background: var(--bg-card);
      color: var(--label);
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 0 0 0.5px rgba(0, 0, 0, 0.04);
    }

    /* ── Cards ── */
    .card {
      background: var(--bg-card);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-card);
      padding: var(--s4);
      margin-bottom: var(--s3);
    }

    .card-section-title {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--label-2);
      margin: 0 0 var(--s3);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .card-section-title .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
      margin-right: 5px;
    }

    /* ── Buttons ── */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--s2);
      min-height: 44px;
      padding: 0 var(--s5);
      border: none;
      border-radius: var(--radius-md);
      background: var(--tint);
      color: #ffffff;
      font-family: var(--font);
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: opacity 150ms ease, transform 150ms ease, background 150ms ease;
      -webkit-tap-highlight-color: transparent;
    }

    .btn:active { opacity: 0.7; transform: scale(0.98); }
    .btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

    .btn-secondary { background: var(--fill-1); color: var(--label); }
    .btn-secondary:active { background: var(--fill-2); }

    .btn-plain { background: transparent; color: var(--tint); padding: 0 var(--s2); }
    .btn-plain:hover { opacity: 0.7; }

    /* ── Inputs ── */
    .input, textarea.input, select.input {
      width: 100%;
      min-height: 44px;
      padding: var(--s2) var(--s3);
      border: none;
      border-radius: 10px;
      font-family: var(--font);
      font-size: 16px;
      background: var(--fill-2);
      color: var(--label);
      transition: background 150ms ease;
    }

    .input:focus, textarea.input:focus, select.input:focus {
      outline: none;
      background: var(--bg-card);
      box-shadow: 0 0 0 2px var(--tint);
    }

    textarea.input { min-height: 72px; resize: vertical; }

    select.input {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%238E8E93' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right var(--s3) center;
      padding-right: var(--s6);
    }

    label.field {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--label-2);
      margin: var(--s3) 0 var(--s1);
    }

    /* ── Bubbles ── */
    .bubble {
      max-width: 82%;
      padding: var(--s2) var(--s3);
      border-radius: 18px;
      margin: var(--s1) 0;
      font-size: 16px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .bubble-user {
      background: var(--tint);
      color: #ffffff;
      margin-left: auto;
      border-bottom-right-radius: 6px;
    }

    .bubble-ai {
      background: var(--bg-card);
      color: var(--label);
      margin-right: auto;
      border-bottom-left-radius: 6px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }

    .bubble-coach {
      background: rgba(255, 214, 10, 0.12);
      border: none;
      color: var(--label);
      font-size: 14px;
      max-width: 92%;
    }

    /* ── Lists ── */
    .list-group {
      background: var(--bg-card);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .list-group + .list-group { margin-top: var(--s3); }

    .list-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--s3);
      padding: var(--s3) var(--s4);
      min-height: 44px;
      transition: background 120ms ease;
      cursor: pointer;
    }

    .list-row:active { background: var(--fill-3); }

    .list-row + .list-row { border-top: 0.5px solid var(--separator-soft); }

    /* ── Status Pill ── */
    .pill {
      display: inline-flex;
      align-items: center;
      gap: var(--s1);
      padding: 3px var(--s3);
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 500;
      line-height: 1.4;
    }

    .pill-gray  { background: var(--fill-1); color: var(--label-2); }
    .pill-blue  { background: rgba(0, 122, 255, 0.12); color: var(--ios-blue); }
    .pill-green { background: rgba(52, 199, 89, 0.12); color: #248a3d; }
    .pill-orange { background: rgba(255, 149, 0, 0.12); color: #c93400; }
    .pill-red   { background: rgba(255, 59, 48, 0.1); color: var(--ios-red); }

    /* ── Stat Number ── */
    .stat-number {
      font-size: 34px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }

    .stat-unit { font-size: 14px; font-weight: 500; color: var(--label-2); }

    /* ── Section Header ── */
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--s2) var(--s1);
      margin-bottom: var(--s2);
    }

    .section-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    /* ── Utility ── */
    .row { display: flex; align-items: center; gap: var(--s2); }
    .mt-1 { margin-top: var(--s1); }
    .mt-2 { margin-top: var(--space-2, 8px); }
    .mt-3 { margin-top: var(--space-3, 16px); }
    .muted { color: var(--label-2); font-size: 13px; }
    .mono { font-variant-numeric: tabular-nums; }
    .grow { flex: 1; min-width: 0; }
    .divider { height: 0.5px; background: var(--separator-soft); margin: 0 var(--s4); }
    .empty-state { text-align: center; padding: var(--s8) var(--s4); color: var(--label-2); }

    /* ── Speak Progress ── */
    .speak-progress {
      font-size: 12px;
      color: var(--label-2);
      font-variant-numeric: tabular-nums;
      margin-left: var(--s1);
    }

    /* ── Goal Done ── */
    .goal-done { color: var(--ios-green); }
    .goal-done .goal-index { opacity: 0.5; }

    /* ── Icon Tile ── */
    .icon-tile {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    /* ── Alert Banner ── */
    .alert-banner {
      display: flex;
      align-items: center;
      gap: var(--s3);
      padding: var(--s3) var(--s4);
      border-radius: var(--radius-md);
      font-size: 14px;
      margin-bottom: var(--s3);
    }

    .alert-amber {
      background: #fff9e6;
      border: none;
      color: #7a4100;
    }

    .alert-red {
      background: rgba(255, 59, 48, 0.08);
      color: var(--ios-red);
    }

    /* ── Phonetics ── */
    .phonetic {
      font-size: 15px;
      color: var(--label-2);
      font-style: italic;
    }

    .pos-chip {
      display: inline;
      font-size: 11px;
      font-weight: 600;
      color: var(--tint);
      background: rgba(0, 122, 255, 0.08);
      padding: 1px 6px;
      border-radius: 4px;
      margin-right: var(--s1);
    }

    .example-text {
      font-size: 14px;
      color: var(--label-2);
      font-style: italic;
      margin-top: var(--s1);
    }

    /* ── Voice Status ── */
    .voice-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
    }

    .voice-dot-ready { background: var(--ios-green); }
    .voice-dot-loading { background: var(--ios-orange); animation: voice-pulse 1.2s ease-in-out infinite; }
    .voice-dot-offline { background: var(--ios-red); }

    @keyframes voice-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    @media (prefers-reduced-motion: reduce) {
      .voice-dot-loading { animation: none; }
    }

    /* ── Recording Button ── */
    .record-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--s2);
      min-height: 44px;
      padding: 0 var(--s4);
      border: none;
      border-radius: var(--radius-pill);
      background: var(--tint);
      color: #ffffff;
      font-family: var(--font);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 150ms ease, transform 100ms ease;
    }

    .record-btn:active { transform: scale(0.96); }
    .record-btn.is-recording {
      background: var(--ios-red);
      animation: record-pulse 1.2s ease-in-out infinite;
    }

    @keyframes record-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.3); }
      50% { box-shadow: 0 0 0 8px rgba(255, 59, 48, 0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .record-btn.is-recording { animation: none; }
    }

    /* ── Icon Button (transparent, inline) ── */
    .icon-inline {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;
      color: var(--label-2);
      transition: background 120ms ease, color 120ms ease;
    }
    .icon-inline:hover { background: var(--fill-2); color: var(--label); }
    .icon-inline:disabled { opacity: 0.3; cursor: not-allowed; }

    /* ── Report / Vocab Cards ── */
    .vocab-word { font-size: 17px; font-weight: 600; color: var(--label); }
    .vocab-meaning { font-size: 14px; color: var(--label-2); margin-top: 2px; }
    .vocab-meta { font-size: 12px; color: var(--label-3); margin-top: var(--s1); }

    /* ── Goal Check ── */
    .goal-check {
      display: flex;
      align-items: center;
      gap: var(--s2);
      font-size: 15px;
      color: var(--label);
      padding: var(--s2) 0;
    }
    .goal-check.done-text { color: var(--ios-green); font-weight: 500; }

    /* ── Status Select ── */
    .status-select-new { color: var(--ios-blue); }
    .status-select-learning { color: var(--ios-orange); }
    .status-select-mastered { color: var(--ios-green); }
    .status-select-ignored { color: var(--label-3); }

    /* ── Toast ── */
    .toast {
      position: fixed;
      bottom: var(--s8);
      left: 50%;
      transform: translateX(-50%);
      background: var(--label);
      color: var(--bg-card);
      font-size: 13px;
      font-weight: 500;
      padding: var(--s2) var(--s4);
      border-radius: var(--radius-pill);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 999;
      animation: toast-in 200ms ease-out;
    }

    @keyframes toast-in {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  </style>
</head>
<body class="min-h-screen pb-16">

  <!-- 顶部毛玻璃导航栏 -->
  <header class="sticky top-0 z-50 bg-white/75 backdrop-blur-xl border-b border-black/5">
    <div class="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
      <!-- Logo -->
      <div class="flex items-center space-x-2">
        <div class="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold shadow-sm">
          S
        </div>
        <span class="font-semibold text-lg tracking-tight">SpeakLoop</span>
      </div>

      <!-- iOS 分段控制器风格导航 -->
      <nav class="bg-[#E5E5EA] p-1 rounded-xl flex space-x-1 text-sm font-medium">
        <a href="#" class="bg-white text-black px-4 py-1 rounded-lg shadow-sm transition">首页</a>
        <a href="#" class="text-[#8E8E93] hover:text-black px-4 py-1 rounded-lg transition">场景</a>
        <a href="#" class="text-[#8E8E93] hover:text-black px-4 py-1 rounded-lg transition">生词本</a>
        <a href="#" class="text-[#8E8E93] hover:text-black px-4 py-1 rounded-lg transition">设置</a>
      </nav>

      <!-- 快速开始按钮 -->
      <button class="bg-[#007AFF] hover:bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded-full shadow-sm transition active:scale-95">
        + 新练习
      </button>
    </div>
  </header>

  <!-- 主内容区 -->
  <main class="max-w-4xl mx-auto px-6 pt-8 space-y-6">

    <!-- 顶部状态横幅 (iOS 通知胶囊风) -->
    <div class="bg-[#FFF9E6] border border-[#FFE58F]/60 rounded-2xl px-4 py-3 flex items-center justify-between text-xs text-[#B25000]">
      <div class="flex items-center space-x-2.5">
        <span class="text-base">⚠️</span>
        <div>
          <span class="font-semibold">语音服务离线 (STT / TTS)</span>
          <span class="text-[#B25000]/80 ml-2">请双击启动器恢复服务，或检查 <code class="bg-amber-200/50 px-1.5 py-0.5 rounded">logs/</code> 目录</span>
        </div>
      </div>
      <button class="text-[#007AFF] font-medium hover:underline">重试连接</button>
    </div>

    <!-- 数据概览 (Apple Health 风格三栏卡片) -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      
      <!-- 卡片1：本周练习 -->
      <div class="ios-card p-5 flex flex-col justify-between">
        <div class="flex items-center justify-between text-[#8E8E93] text-xs font-medium">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-[#FF9500]"></span>本周练习
          </span>
          <span>🔥 活跃</span>
        </div>
        <div class="mt-4 flex items-baseline space-x-1">
          <span class="text-4xl font-bold tracking-tight text-[#1C1C1E]">10</span>
          <span class="text-sm font-medium text-[#8E8E93]">次对话</span>
        </div>
      </div>

      <!-- 卡片2：生词本 -->
      <div class="ios-card p-5 flex flex-col justify-between">
        <div class="flex items-center justify-between text-[#8E8E93] text-xs font-medium">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-[#34C759]"></span>生词进度
          </span>
          <span class="text-[#007AFF] cursor-pointer">查看全部 ›</span>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2 text-center">
          <div class="bg-[#F2F2F7] rounded-xl py-2">
            <div class="text-xl font-bold text-[#007AFF]">0</div>
            <div class="text-[11px] text-[#8E8E93]">新词</div>
          </div>
          <div class="bg-[#F2F2F7] rounded-xl py-2">
            <div class="text-xl font-bold text-[#FF9500]">0</div>
            <div class="text-[11px] text-[#8E8E93]">学习中</div>
          </div>
          <div class="bg-[#F2F2F7] rounded-xl py-2">
            <div class="text-xl font-bold text-[#34C759]">0</div>
            <div class="text-[11px] text-[#8E8E93]">已掌握</div>
          </div>
        </div>
      </div>

      <!-- 卡片3：常见错误 Top3 -->
      <div class="ios-card p-5 flex flex-col justify-between">
        <div class="flex items-center justify-between text-[#8E8E93] text-xs font-medium mb-2">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-[#FF3B30]"></span>常见错误 Top 3
          </span>
        </div>
        <div class="space-y-1.5 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-[#1C1C1E]">用词不当</span>
            <span class="bg-[#F2F2F7] text-[#8E8E93] text-xs font-semibold px-2 py-0.5 rounded-full">2 次</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[#1C1C1E]">语法错误</span>
            <span class="bg-[#F2F2F7] text-[#8E8E93] text-xs font-semibold px-2 py-0.5 rounded-full">1 次</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[#1C1C1E]">地道表达</span>
            <span class="bg-[#F2F2F7] text-[#8E8E93] text-xs font-semibold px-2 py-0.5 rounded-full">1 次</span>
          </div>
        </div>
      </div>

    </div>

    <!-- 最近练习 (iOS Inset Grouped List 风格) -->
    <div>
      <div class="flex items-center justify-between px-1 mb-2.5">
        <h2 class="text-lg font-bold tracking-tight text-[#1C1C1E]">最近练习</h2>
        <span class="text-xs text-[#8E8E93]">共 8 条记录</span>
      </div>

      <!-- 合并的列表大容器 -->
      <div class="ios-card divide-y divide-[#E5E5EA]/70 overflow-hidden">
        
        <!-- 列表项 1 -->
        <div class="p-4 hover:bg-[#F2F2F7]/50 transition flex items-center justify-between cursor-pointer group">
          <div class="flex items-center space-x-3.5">
            <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
              🚗
            </div>
            <div>
              <div class="font-medium text-[#1C1C1E] text-sm group-hover:text-[#007AFF] transition">
                与客户沟通电动前备箱盖功能需求
              </div>
              <div class="text-xs text-[#8E8E93] mt-0.5">2026年10月19日 20:53</div>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <span class="bg-[#F2F2F7] text-[#8E8E93] text-xs font-medium px-2.5 py-1 rounded-full">0 轮</span>
            <span class="text-[#C7C7CC] text-lg font-light">›</span>
          </div>
        </div>

        <!-- 列表项 2 -->
        <div class="p-4 hover:bg-[#F2F2F7]/50 transition flex items-center justify-between cursor-pointer group">
          <div class="flex items-center space-x-3.5">
            <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
              💼
            </div>
            <div>
              <div class="font-medium text-[#1C1C1E] text-sm group-hover:text-[#007AFF] transition">
                英文面试
              </div>
              <div class="text-xs text-[#8E8E93] mt-0.5">2026年10月19日 19:38</div>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <span class="bg-[#F2F2F7] text-[#8E8E93] text-xs font-medium px-2.5 py-1 rounded-full">0 轮</span>
            <span class="text-[#C7C7CC] text-lg font-light">›</span>
          </div>
        </div>

        <!-- 列表项 3 -->
        <div class="p-4 hover:bg-[#F2F2F7]/50 transition flex items-center justify-between cursor-pointer group">
          <div class="flex items-center space-x-3.5">
            <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
              💡
            </div>
            <div>
              <div class="font-medium text-[#1C1C1E] text-sm group-hover:text-[#007AFF] transition">
                与客户沟通车辆灯光功能需求
              </div>
              <div class="text-xs text-[#8E8E93] mt-0.5">2026年10月18日 21:40</div>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <span class="bg-[#F2F2F7] text-[#8E8E93] text-xs font-medium px-2.5 py-1 rounded-full">0 轮</span>
            <span class="text-[#C7C7CC] text-lg font-light">›</span>
          </div>
        </div>

      </div>
    </div>

  </main>
</body>
</html>
