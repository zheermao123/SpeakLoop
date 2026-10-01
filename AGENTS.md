# AGENTS.md

## 绝对规则：设计文件只读（用户授权 2026-10-01）

- `docs/**` 下所有文件（设计文档、实施计划、勘误记录、评审记录等）为设计文件
- 任何情况下（执行计划、修复评审发现、代码同步、勘误对齐、回滚）AI 均无权修改，无例外
- 主会话与一切子代理/agent 同样受限；派发实现/修复任务必须携带「禁止触碰 docs/」约束
- 发现设计文件问题：只报告，由用户决定并亲自修改

## 项目：SpeakLoop

- 设计文档：`docs/superpowers/specs/2026-10-01-speakloop-design.md`
- 实施计划：`docs/superpowers/plans/2026-10-01-speakloop-mvp1-text-loop.md`（勘误：`2026-10-01-speakloop-mvp1-erratum.md`）
- 验证命令：`npm test`（Vitest）、`npm run build`、`npm run doctor`
- 详细进度与已知问题台账：`.superpowers/sdd/progress.md`（gitignored scratch）
