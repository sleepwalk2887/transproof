# AGENTS.md — AI 助手自动任务入口

> **任何 AI 编程平台（DSH / Claude Code / Codex / Cursor 等）打开本目录时：先读本文件，再按「会话启动流程」行动。**
> 人类接手请读 `HANDOFF.md`。本文件是全包唯一入口，链式引用，不重复内容。

## 项目一句话
TransProof（译校助手）：纯前端 AI 翻译校对工具，零后端零构建。`transproof/index.html` + `js/` 下 13 个 classic script（按序加载，`01-core` 第 2 行定义 `APP_VERSION`），外接大模型 API 干活，数据存浏览器 localStorage。
线上：https://transproof.pages.dev （Cloudflare Pages）· 当前 **v4.38.1**（2026-10-30）· 测试 `node run-all.js` 共 45 个用例

## 会话启动流程（每次新会话照做）
1. 读 `HANDOFF.md` —— 架构、关键约定（**第八节是铁律**）、版本史、发版流程
2. 读 `TASKS.md` —— 任务板，按优先级取第一个 `status: todo` 的任务开工
3. 读 `transproof/乱风企划tips.md` —— 已上线 35 项总表 + 为什么做这些（Top 3）
4. 需要历史背景时按需翻 `project-memory/`（最新在尾部日期）

## 常用命令（工作目录 `transproof/`）
```bash
node serve.js        # 本地服务器 → http://127.0.0.1:8123/index.html
node _check.js       # 内联 JS 语法校验（改完必跑，要求 scripts=1 bad=0）
node run-all.js      # 全量 Playwright 测试（期望 PASS=29 FAIL=0）
```
- 测试用 playwright-core + Edge，路径写死在各测试文件头部，换机器要改
- 跑浏览器测试的环境必须放行进程 spawn（严格沙箱会拦 `spawn EPERM`）

## 硬性约定（违反 = 返工）
1. **测试锚点**：不改按钮 id、八个标签页结构、测试断言依赖的文案
2. **发版铁律**（用户规定）：功能更新 + 版本 bump 后必须 ①自检（`_check.js` + 全量 + bump 后复跑）②更新 `transproof/index.html` 的 `#p-help` 使用指南 ③更新 `乱风企划tips.md`（已上线表加行+计数）→ ④同步副本、发布 ⑤**发布后跑 `node _verify-release.js` 发版自检**（六副本版本/文件对齐 + tips/交接本镜像 + git 已推送 + 线上版本与脚本清单 = 本地，全绿才算插件端和网页端同时更新）
3. **密钥不入库**：Cloudflare/API 凭证在 `~/.transproof-deploy/env`（本包不含），任何文件不得写入密钥
4. **版本号**：`js/01-core.js` 第 2 行的 `APP_VERSION`（**不在 index.html**），bump 后必须复跑全量
5. 用户是文科生，一切说明要「零基础能懂、白话、表格化」

## 回复规范（每次回复都照做，硬性）

| # | 规矩 | 说明 |
|---|---|---|
| 1 | **白话 + 表格** | 结论先行，能上表就不写大段，不堆术语（用户是文科生） |
| 2 | **每完成一件事就汇报** | 用人话说清「现状 + 原因」，别只丢一句「做完了」 |
| 3 | **每轮报进度** | 用户原话「每次完成之后应当向我汇报进度」 |
| 4 | **改完当场核对再报完成** | `grep` 或读回比对，绝不假报（出过 2 次假报「已写进 tips」） |
| 5 | **复读机就停** | 出现「同字无限重复 / 工具调用死循环」→ 立即停手汇报，别闷头改（出过 4 次） |
| 6 | **答复末尾带两句** | 「看 tips」+「革命尚未成功，同志仍需努力」 |
| 7 | **不许猜** | 查不到的事写「查不到 / 待确认」，禁止用推测填形状 |

> 完整版见 `交接本.md` 第 1 节。

## 任务板
见 `TASKS.md`（结构化字段：id / priority / status / acceptance）。
**完成任务后**：把该项 `status` 改 `done` → `project-memory/` 当天日志追加该版本节 → 按铁律收尾 → 新任务按同格式追加。

## 提新任务的格式（双向协作）
直接在 `TASKS.md` 任务区按现有条目格式追加（title / priority P1>P2>P3 / status: todo / 来源 / 需求 / 验收），两边平台都能识别。
