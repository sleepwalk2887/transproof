# TransProof 协作包 · 给技术搭档的入门说明

> 生成日期：2026-10-14 · 版本：v4.25.0 · 29/29 测试全绿
>
> **给 AI 平台（DSH / Claude Code / Codex / Cursor）**：打开本目录即自动识别
> `AGENTS.md`（入口）→ `TASKS.md`（任务板，领第一个 todo）→ `HANDOFF.md`（约定）。
> 人类阅读从下一节开始。

## 一、这是什么

TransProof（译校助手）：纯前端单文件 AI 翻译校对工具。**零构建、零后端**——
核心就是 `transproof/index.html` 一个文件（HTML+CSS+JS 全内联），
外接大模型 API 干活。数据全存浏览器 localStorage。

线上：https://transproof.pages.dev （Cloudflare Pages）

## 二、目录结构

```
transproof-collab/
├── HANDOFF.md                 ← 【先读这个】接手文档：架构、约定、版本史、发版流程
├── UI-DESIGN-BRIEF.md         ← UI 设计任务书（Swiss 栅格/字体系统/禁区）
├── HELP-MECHANISM.html        ← 帮助页素材（机制说明卡）
├── publish.sh                 ← 一键发布入口（依赖 ~/.transproof-deploy/deploy.sh，见第五节）
├── project-memory/            ← 开发日志，按日期记录每版改了什么、为什么、坑在哪
│   └── 2026-10-14.md          ← 最新（v4.24.0 / v4.25.0）
└── transproof/
    ├── index.html             ← 主程序（全部功能在这）
    ├── config.js              ← 出厂模板配置
    ├── chi_sim.traineddata.gz ← OCR 简中语言包（线上同源加载，必须随站部署）
    ├── eng.traineddata.gz     ← OCR 英文语言包（同上）
    ├── tests/                 ← 29 个 Playwright 测试（01～29），纯 node 脚本
    ├── run-all.js             ← 一键跑全部测试
    ├── serve.js               ← 本地静态服务器（node serve.js → 127.0.0.1:8123）
    ├── _check.js              ← 内联 JS 语法校验（改完必跑）
    ├── 乱风企划tips.md         ← 未竟目标清单 + 已上线 18 项总表
    └── _*.js / _*.png / _*.pdf ← 开发辅助脚本与截图（可留可删，不影响线上）
```

## 三、跑起来（5 分钟）

```bash
cd transproof
node serve.js          # 没有 python/node？装个 node 22+ 即可
# 浏览器打开 http://127.0.0.1:8123/index.html
```

跑测试（需要 playwright-core + Edge/Chrome，路径在各测试文件头部，按需改）：

```bash
node _check.js         # 语法校验（第一道门）
node run-all.js        # 全量 29 个（期望 PASS=29 FAIL=0）
```

## 四、协作方式（我们的分工流程）

1. **单一事实源 = 一个 Git 仓库**（推荐私有 GitHub/Gitee，见交付者说明）
2. **改动前先看** `HANDOFF.md` 第八节「关键约定」——特别是发版收尾铁律：
   改完必须：`_check.js` → 全量测试 → 更新 `#p-help` 使用指南 → 更新 `乱风企划tips.md`
3. **提交规范**：`v4.x.y 一句话说明`，正文写改了什么/为什么/怎么验的
4. **进度共享**：`project-memory/` 按天追加日志 + `乱风企划tips.md` 的 Top 清单
   ——双方读这两个文件就知道项目到哪了、下一步做什么
5. **你的建议怎么提**：直接开 issue / 或在 `乱风企划tips.md` 的 ❌ 表里加行，
   标注「技术评估：可行/不可行 + 理由」，我们按「实用 × 可行」排序采纳

## 五、重要边界

- **部署凭证不含在本包内**：Cloudflare token 在交付者的
  `~/.transproof-deploy/env`，不要外传；协作者提 PR/commit，由持有凭证方发布
  （或协作者自己跑 `wrangler login` 后改 publish.sh 指向自己的仓库）
- **用户数据不共享**：术语库/任务存各自浏览器 localStorage，代码协作 ≠ 数据共享
- **改测试要注意**：测试断言依赖按钮 id 与文案，`HANDOFF.md` 第八节禁止改这些锚点
- 沙箱环境提示：跑浏览器测试需放行 spawn 权限（workspace-write 沙箱会拦 Edge 启动）
