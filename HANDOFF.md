# 译校助手 · 项目交接文档（HANDOFF）

> 这是一份给接手者（AI 助手 / 开发者）的完整上下文说明。
> 读完本文件 + `project-memory/` 目录下的记忆日志，即可无缝接手本项目继续开发。

---

## 一、项目是什么

**译校助手（Translation Proofreader）** —— 一个纯前端的 AI 翻译校对工具。

- 定位：把「外文原文 + 中文译文」交给 AI，逐句对照，揪出漏译/误译/翻译腔，统一术语、规范格式、给出可粘贴的注释。
- 目标用户：文科翻译 / 学术译者（用户本人是文科生，看重「省事、省 token、术语一致」）。
- 线上地址：**https://transproof.pages.dev**（Cloudflare Pages 静态部署，已上线 v4.38.1，见第八节第 4 条发布方式）
- 当前版本：**v4.38.1**

## 二、技术栈（很轻，别怕）

- **模块化纯前端（v4.25.1 起拆分）**：`transproof/index.html`（约 1600 行）只留 HTML + CSS，全部原生 JS 按加载顺序拆成 `transproof/js/01-core.js ～ 10-app-init.js` 十个模块（classic script 顺序加载，行为与原单文件完全一致）；改代码前先读第七节测试方式，改动必须过全量 36 项。
  - ⚠️ **拆分红线（v4.25.2 线上回归教训）**：classic script **无跨文件提升**——在先模块（02/03…）不能在加载阶段引用后模块的顶层变量，**包括 `setTimeout(fn,…)` 这类回调**（100ms 也可能早于后模块执行）。所有跨模块共享的数据声明（`GLOSS`/`PROMPTS`/`CFG`/`TERMS` 等 `let/const`）必须前置到 `js/01-core.js`，后模块只放函数。
- 无构建、无框架、无后端。数据全部存在浏览器 `localStorage`。
- 调用 LLM：OpenAI 兼容接口（`CFG.baseUrl + '/chat/completions'`），SSE 流式（`Authorization: Bearer CFG.apiKey`）。默认 DeepSeek。
- 外部 CDN 库（按需懒加载，均带多源兜底，**首选 registry.npmmirror.com（国内可达）**，其余 jsdelivr+unpkg，pdf.js 另有 bootcdn/staticfile；npmmirror 路径格式 `https://registry.npmmirror.com/<pkg>/<ver>/files/<path>`）：mammoth（docx 读）、pdf.js + tesseract.js（PDF/OCR）、JSZip（docx 写）、docx（导出 Word）、OpenCC（繁简转换）、XLSX（Excel）。
- `config.js` 是「安全修改区」：用户可改模板/配色/钩子，主程序不动。

## 三、文件结构

```
transproof/
├── index.html        # 主程序（核心，几乎一切都在这里）
├── config.js         # 外部配置（提示词模板、配色、钩子，用户可改）
├── tests/            # 45 个 Playwright 测试（01～31 + 33～45）
├── 乱风企划tips.md    # 取经笔记 + 功能进化清单（借鉴 GitHub / BelinDoc 的路线图）
└── _verify.png       # 测试截图（可忽略）
project-memory/
├── 2026-09-24.md     # 开发日志（v4.2.1 → v4.7.1）
├── 2026-10-07.md     # 开发日志（v4.8.0 → v4.16.0）
├── 2026-10-09.md     # 开发日志（v4.16.1 全量自检 + 修复 10 隐患）
├── 2026-10-10.md     # 开发日志（v4.17.0 术语集合 / v4.18.0 质量预估 / v4.19.0 联网查证 / v4.20.0 词条批量管理）
└── 2026-10-11.md     # 开发日志（v4.21.0 Swiss×NASA-punk 融合 UI 改造）
    ├── 2026-10-12.md     # 开发日志（v4.21.1 CDN 多源兜底 / v4.21.2 扫描件 OCR 语言包同源修复 / v4.21.3 换行修复 / v4.22.0 PDF 注释识别 / v4.23.0 P2 多模型 + P1 模糊匹配与修订模式）
    └── 2026-10-14.md     # 开发日志（v4.24.0 开屏/分组/疑难标注 + v4.25.0 UI 融合改造 + v4.25.1 模块化拆分 + v4.25.2 效果演示卡 + v4.26.0 报错反馈 + v4.27.0 三问题改进：收录核查·修正流转·译文内联改错 + v4.28.0 专名体检+编辑查找替换 + v4.29.0 批注去重·三段流水线 + v4.29.1 校对提示词纪律（不猜补·优先级链））
        └── 2026-10-18.md # 开发日志（dsh 宿主环境修复全过程 + v4.30.0 三栏逐句对照 T-001）
```

## 四、核心架构（关键函数锚点）

页面顶部 8 个页签：校对工作台 / 翻译工作台 / 项目进度 / 术语库 / 专有译词库 / Prompt库 / 设置 / 使用指南。

| 函数 | 作用 |
|---|---|
| `run()` | 校对主流程（`extOnly`=仅术语延伸） |
| `tsRun()` | 翻译主流程 |
| `buildSystem()` | 拼装校对系统提示词（规则/术语表/偏好/翻译记忆注入） |
| `callModel(sys, user, onDelta, which)` | SSE 流式调用 LLM |
| `callModelSimple()` | 非流式调用（关键词提取、反推提示词用） |
| `md()` | 轻量 Markdown 渲染 |
| `makeStreamRenderer(el)` | 流式渲染节流（纯文本，防卡顿） |
| `collapseSections()` | 把批注/注释/争议折叠成 `<details>` |
| `termAudit()` / `showTermAudit()` | 术语一致性体检（本地零成本） |
| `parseEdits()` / `showEditDiff()` | 改动对照视图（弹窗版） |
| `triBuild()` / `renderTriView()` | 三栏逐句对照视图（T-001，结果页内联，零 token） |
| `setOutView(v)` / `syncOutView()` | 结果区「文档 / 三栏对照」视图切换与显隐同步 |
| `paraAudit(srcText, dstText)` / `showParaAudit()` | 段落对齐体检（T-011，缺段/多段/空段标位置，本地零 token） |
| `approvedGloss()` / `glossSetStatus(id, status)` | 术语权威分级（T-012）：唯一闸门只认「已批准」词条 + 状态迁移（待审/已批准/已拒绝），提示词注入点全部走它 |
| `numAudit(srcText, dstText)` / `showNumAudit()` | 数字与格式体检（T-015，丢失/多出/百分号/漏否定逐处标位，万-亿换算不误报，本地零 token） |
| `qualityScore(srcText, dstText)` / `showQuality()` | 译文总评分（v4.36：本地算 0–100 + S/A/B/C/D，忠实度 60 / 流畅度 40 拆分，逐条列出扣分项；含未翻译残留、占位符保护） |
| `auditAll()` / `auditCenterToggle(on)` / `auditOptsGet()` | 体检中心（v4.36：四项体检收一处、逐项可开关且 `tp.auditOpts` 持久化、一键全检聚合） |
| `toneBriefFor(tone)` / `showToneBrief()` | 风格简报（v4.36：按 `#tone` 体裁调性给 5 条检查清单，本地零流量） |
| `triInlineToggle(on)` / `renderTriInline()` | 三栏对照翻译区直出（v4.35：`#btn-tri-inline` 开关，输入 300ms 防抖实时刷新） |
| `triBuildRe(frags)` / `triHit(re, s)` | 三栏提速（v4.35：每轮只拼一次大正则，替代原来每行 `new RegExp`） |
| `extractProofText(mdText)` | 从模型回复抽出「## 一、修订后译文」正文（三栏「修订」列数据源） |
| `learnFromResult()` / `findMemoryMatches()` | 翻译记忆（本地句对复用） |
| `syncToProject()` | 校对结果同步到项目看板 |
| `parseFile()` | 文件解析（docx/pdf/图片 OCR） |
| `buildTransSystem()` | 翻译系统提示词 |
| `renderDecisionPanel()` | 术语争议点选面板 |

**全局状态**：`CFG`（配置）、`TERMS`（术语库）、`PREFS`（偏好）、`PROJECT`（项目看板）、`TM`（翻译记忆）、`STAGE`（校对阶段 full/pass1/pass2）、`THEME`/`ACCENT`（主题）。

## 五、localStorage 数据（共 13 个 key）

`tp.cfg` `tp.terms` `tp.prefs` `tp.history` `tp.memory` `tp.project` `tp.prompts` `tp.gloss` `tp.task` `tp.stage` `tp.theme` `tp.accent` `tp.splash`

→ 备份/恢复逻辑在 `#btn-backup` / `#btn-restore`（v2 完整备份，13 项全打包成 JSON；备份测试断言 13 类）。

## 六、已实现功能清单（按版本）

- **v4.2.1** 决策面板（术语争议点选 + 一键应用重校）
- **v4.3.0** PDF 逐页 OCR / 从原文反推提示词 / 原文导出 docx
- **v4.4.0** 字数上限可配 / 复制可选段落 / 断点续传
- **v4.5.0–4.7.1** 智能配图助手（关键词→跳转搜索）/ 项目进度看板（导出导入 JSON 协作）/ 导航布局修复
- **v4.8.0** 术语一致性自动体检（本地零成本）
- **v4.9.0** 一校/二校双阶段 + 批注错误分类筛选 + 一键修改 + 看板信息共享
- **v4.10.0** 明暗主题自适应 + 自定义主题色
- **v4.11.0** 流式渲染节流（防崩溃）+ 区块折叠 + 注释可粘贴尾注格式
- **v4.12.0** 改动对照视图（P1，零 token）
- **v4.13.0** 流式纯文本渲染（修火狐卡顿）
- **v4.14.0** 进度条 + 暂停/续写 + 翻译记忆（P1）+ 精修模式修复
- **v4.15.0** 理顺 tone/style 重叠 + 自动术语体检 + 一校自动二校
- **v4.16.0** 完整备份迁移能力（12 key）
- **v4.17.0** 术语「集合」+ LLM 智能扫描：从 PDF/DOC/TXT 智能抽取术语并自动按集合收纳（剔除标题/目录/页眉等噪声，高置信度自动确认、低置信度留待审核）；翻译/校对时可选取集合锁定术语；打通术语库与专有译词库入口
- **v4.18.0** 校对前「质量预估」：正式校对前用很少 token 快速扫一眼，给出译文水平评分/等级、问题集中段落、建议一校还是二校（借鉴 qe4pe/divemt 工作量预估）
- **v4.19.0** 争议术语联网查证：译词库术语行加「🔎 查证」按钮，一键跳转 Google Scholar / 百度学术 / CNKI / 维基百科 检索该术语通行译法（纯前端跳转，零 token、零依赖）；另加「集合筛选」下拉，可按集合查看术语（UI 优化）
- **v4.20.0** 词条批量管理/删除补全：批量栏改为常显（未勾选禁用、勾选启用，解决「找不到批量入口」）；术语行加「🗑」单条删除；补上「⇄ 合并所选」按钮事件（此前缺失）；loadLib 加 10 秒超时兜底（修复 CDN 库加载失败时 onerror 不触发导致的扫描流程卡死）
- **v4.21.0** Swiss×NASA-punk 融合 UI 改造（全站）：Swiss 骨架（网格/左对齐/平涂/细线/编号）+ NASA 点缀（面板/标签/彩条/徽章/等宽）克制融合；NASA 手册配色（暗墨黑 / 亮米灰 #ECE5D6 + 强调红 #D63A2C）；字体换 Space Grotesk 硬朗无衬线；四色复古彩条页首 + 圆形任务徽章 + 卡片四角铆钉 + 黑白警示斜纹 + UNIT 编号标签，铺开全站卡片
- **v4.21.1** CDN 多源兜底 + PDF 解析修复：修「无法解读 pdfjs」报错——根因所有库只依赖 jsdelivr 单一 CDN（大陆被墙）。给全部 15 处 loadLib 加第二源 unpkg，pdf.js 加到 4 源（jsdelivr+unpkg+bootcdn+staticfile），pdf worker 换 BootCDN 国内源；测试断言过滤 CDN 兜底时首个源失败产生的 `Failed to load resource` 浏览器噪音
- **v4.21.2** 扫描件 OCR 修复（「解析失败undefined」）：根因 tesseract 的 worker/core/lang 三个内部路径仍硬编码 jsdelivr，v4.21.1 的多源只救了主脚本——worker 死 → reject `event.message`=undefined（即用户看到的 undefined）；lang 死 → 静默挂起卡 95%。修复：`tpTessPaths` 三路探测（unpkg→npmmirror→jsdelivr，HEAD 验证 MIME）选可达 worker/core；**语言包 chi_sim/eng.traineddata.gz 落到应用同源目录**（零 CDN、最快、不被墙）；`tpRecognize` 加 240s 看门狗防永久挂起 + errorHandler 防 pageerror；`errMsg` 兜底杜绝 undefined 文案；进度回调「下载OCR内核/语言包/初始化/识别中」上 fileBar
- **v4.21.3** 换行修复（「复制进 doc 保留格式仍不断行」）：根因两层——① `parsePdf` 文本层 `join(' ')` 把整页拍成一行（源 PDF 换行全丢，OCR 路径反而保 `\n`）；② 普通模式提示词无段落硬约束，AI 默认拍平多段。修复：`pdfTextLines` 按 Y 坐标分组还原行 + 字符过滤放行 `\n`；`buildSystem` 非文档模式注入【结构保持】硬约束（换行与分段必须与待校对译文一致、禁合并段落）。复制链路本身无损（剪贴板探针实测 HTML flavor 4 个 `<p>`、plain 含 `\r\n`）
- **v4.22.0** PDF 注释识别 + 翻译 + 按需贴入：整书 PDF 自动提取文中数字标号脚注与正文后尾注（pdfLineObjs 行聚簇/字号差识别上标标号、页底分隔线识别脚注块、H_END/H_STOP 标题识别尾注起止、编号递增收条目）；「🏷 本章注释」弹窗按章/标号/页码取注释，批量翻译（NOTE_SYS JSON）后三选一贴入译文尾（仅译文/仅原文/双语，防重复贴入，可移除）；buildSystem 注入【注释标号】原样保留约束；notes 随任务持久化。测试 `tests/24-notes.js` 27 断言，全量 24/24 全绿
- **v4.23.0** P2 多模型预设 + P1 两项收尾：①设置页服务商下拉扩为 **24 家**（国内 14 含小米 MiMo flash/pro、海外 8、聚合 2）按组动态生成，选中即回填接口地址与模型名，修掉「自定义」项两处老 bug（value 不匹配致回填字面 custom / 不回显）与尾斜杠预设回显问题；②翻译记忆模糊匹配双档（simScore bigram 余弦：≥0.90 近似命中微调复用 / 0.80–0.90 相关参考禁照抄 / 以下不注入，精确命中去重）；③导回 Word 修订模式：`#btn-trackdoc` 逐段 LCS 词级 diff 生成 `w:del/w:ins` 修订痕迹（作者 TransProof、w:id 递增、settings 开 trackChanges、pPr/rPr 保留），Word 审阅页可逐条接受/替换模式不受影响；另修 mammoth 缓存命中时 `window.mammoth` 不存在的隐患。测试 `25/26/27` 三件套，全量 **27/27 全绿**

- **v4.25.0** UI 融合改造（依据 UI-DESIGN-BRIEF.md，Swiss 栅格×屋顶现视研×纸墨朱印）：①**四层分区字体系统** --f-ui/--f-read/--f-mono/--f-quote（全系统栈零下载，删 Google Fonts 外链；结果区与大文本框 16px/1.8/.02em；计数器/正则框/开屏 .sp-deco 等接 --f-mono + tabular-nums；导出 Word 换 IBM Plex Serif+思源宋体栈）；②**4px 栅格**（_sweep4.js 清扫 margin/padding/gap 至 4 倍数，non-4px=0，.wrap 1500→1200px、卡片间距 24px、body 14→13px）；③**hairline --bd**（暗 rgba(237,232,216,.12)/亮 rgba(27,26,22,.15)）+ **明暗双字重** --fw-strong/--fw-title（暗 500/600、亮 600/700，约 30 处接线）+ 9/10px→11px；④**单字类型标签** 危/检/术/议（#out li[data-err]::before content:attr(data-tag)，markErrorLines 写 dataset.tag；.g-col::before='术'）；⑤**开屏零时长变化**——.7s/.12/.26/.42/.58s 全部换成 --sp-dur/--sp-d1..d4 变量（值逐毫秒复刻），字体接驳，动画逻辑一字未动。禁区全保（--bg/#d63a2c/--r:2px/--sh:none/八标签/id）。验收 7 项全过，全量 **29/29 全绿**（两轮）
- **v4.25.1** L1 架构拆分（零逻辑改动）：index.html 7035 → 1606 行，JS 全部切成 `js/01-core ～ 10-app-init` 十模块按序加载；唯一跨文件提升陷阱 `onclick = openCollectionPicker`（定义落 09 号文件）改惰性箭头；`_check.js` 升级为内联 + js/*.js 逐文件 node --check，`_verify-ui.js` 适配拆分后验收 7/7，全量 **29/29 两轮全绿**；**部署包必须带 js/ 目录**（deploy.sh 已补），版本号移至 `js/01-core.js:2`
- **v4.25.2** 使用指南「效果演示」卡（T-003）：帮助页「30 秒了解」后插入演示卡——双按钮切换「校对前·你贴进来的」/「校对后·它返给你的」，同屏对比英文原文 + 三处病译 → 修订后译文（err/ac 标色）+ 三条带 危/术/议 方章的批注 + 「顺手记住」；新内联 `tpDemo()` 只做显隐切换，全部新 id（dm-*），零旧锚点改动、纯前端零依赖。`_probe-demo.js` 实测卡片序位 1/13、双向切换、t-tag×3、亮暗截图清晰、**0 报错**；全量 **29/29 全绿**。版本号 `js/01-core.js:2` = 4.25.2
- **v4.26.0** 报错反馈自助提交 + 任务页展示：右下角常驻「📩 反馈」按钮（覆盖全功能区），弹窗必填 问题描述/出现时间/出现地点（操作路径）、选填 功能/联系方式，自动附带 版本号·当前页·最近 JS 报错（环形缓冲 20 条）；提交先落本地 `tp.fb.log` 再 POST 同源 `/api/feedback/submit`，成功给编号 FB-XXX，断网留本地可在「项目进度」页点「重发」；任务页新增「反馈记录」卡（计数 + 刷新 + 逐条列表）。架构：CF 边缘 Worker `_worker.js` 回源独立 Worker（transproof-feedback.transproof-tasks.workers.dev，OAuth 注册子域 transproof-tasks）→ Workers KV（binding `FB_KV`，namespace f22d5e2a…be463），后端校验必填与限长、id=FB-<base36>、list cap 500。新增 `js/11-feedback.js`（ALL_KEYS 加 tp.fb.log 共 14 键）与 `tests/30-feedback.js` 11 断言；顺手修 CDN 失联（tesseract 主脚本/mammoth/pdfjs 补 npmmirror 首选源，路径 `registry.npmmirror.com/<pkg>/<ver>/files/<path>`，救回 22/24 两测）。全量 **30/30 全绿**，版本号 `js/01-core.js:2` = 4.26.0
- **v4.27.0** 三问题改进（术语收录核查 / 误译修正流转 / 译文内联改错）：①**收录正确性核查**——术语库行、译词库行、决策面板 dp-foot 三个入口挂「🤖 核查」，`VERIFY_SYS` 让 AI 判 verdict（ok/doubt/bad+理由+建议译法），结果弹窗 `.vf-row` 一键采用（好选项直接入库、坏选项打回）；②**提醒→修正状态流转**——`AUDIT_FIX` 状态机（01-core 跨模块共享），批注卡「标记已修」按钮 + 「未修 N」筛选 chip + 「已修 x/N」进度，随任务 saveTask/restoreTask 持久化；③**译文标红就地改错**——`paintErrFixSpans` 按批注「新译」定位修订后译文包 `.err-fix` 标红，点击 `contenteditable` 直接编辑，`applyProofEdit` 回写 LAST_OUT+saveTask+全管线重渲。`_probe-fix.js` PROBE PASS（2→1→0 流转、标红、写回、持久化、核查采用、0 报错）；`_check` bad=0，全量 **30/30 全绿**。连带：伊里因科夫六机制登记（tips「📚 六机制·单人翻译版待办」节 M1-M6 + TASKS.md T-009～T-014 六卡）。版本号 `js/01-core.js:2` = 4.27.0
- **v4.28.0** 专名体检 + 编辑/查找替换：①**🔎 专名体检**（零 token 本地三类检测：同名异译/疑似未译/数字对不上，`proNounAudit` js/08，lookaround 修 `\b` 中文邻接失效坑），弹窗选译法「统一为所选」全局替换；②**✏️ 编辑/查找替换**（js/12-editbox.js，校对结果 + 翻译输出双入口，查找/替换/全部替换/计数/保存并重渲/放弃修改）；③**Word 式同错替换**（`applyProofEdit` 段内剩余相同文本 confirm 全替换）；④测试 33（8 断言）/34（9 断言），开发坑：正则 `\b` 中文邻接（改 lookaround）、`#ts-out` 在 `#p-trans` 页要先切页、`promptResumeTask` 400ms 定时器与夹具赛跑（测试先 waitForTimeout(800)）。`_check` bad=0、验收 7/7（non-4px 归零）、全量 **32/32 全绿**。版本号 `js/01-core.js:2` = 4.28.0
- **v4.29.0** 批注去重（真实用户反馈修复）+ 三段流水线 T-002：①**批注去重** `dedupAuditLines()` js/08-render-audit.js（按 `auditParseLi(li).fp` 分组，重复项 display:none + data-dedup=1，首条挂 `.ef-dedup` 角标『×N 重复已折叠』）；起因 = 反馈日志 `FB-MVBZVHKG-SOZ`「一直重复将 recuperation 改为后殖民」，grep 全仓 0 命中 → 定性**模型退化重复循环**（同一条修改重复 N 遍）而批注列表无去重导致刷屏；接线两处 = `run()` js/07-run-features.js:522 与 `restoreTask` js/05-files-docx.js:796。②**三段流水线** `js/13-pipeline.js`（新 13 号模块，`PL`/`plRun(n)`/`plOpen()`，入口 `#btn-pipeline` 翻译页）：翻译→批评→精修三段，callModelSimple 分段 maxTok 8000/3000/8000，失败给可读提示+「↻ 重试第 n 段」、可中断、第3段解锁「送去校对」回填 #dst；**批评段输入白名单**（T-010）= 只依据 原文/译稿/术语表、只产清单不改译文、类型 9 类枚举、优先硬伤。③测试 35-dedup（7 断言）/36-pipeline（14 断言，含批评段 sys/user 白名单断言）；开发坑 = `.ef-dedup` margin-left 6px 破 4px 网格（改 8px）。`_check` bad=0（js=13）、验收 7/7（non-4px 归零）、全量 **34/34 全绿**。版本号 `js/01-core.js:2` = 4.29.0
- **v4.30.0** 三栏逐句对照视图（T-001）：③校对结果卡新增「文档 / 三栏对照」切换条（`#btn-view-doc` / `#btn-view-tri`，新 id，旧按钮全不动），三栏 = 原文｜原译（送校）｜修订（模型改后）。实现 `js/08-render-audit.js` 末尾 `triSplitParas`/`triSplitSents`/`triMark`/`triBuild`/`triCopyTable`/`renderTriView`/`setOutView`/`syncOutView`，**纯本地解析、零 token**；**对齐策略** = 原文按段整段展示（`grid-row:span N` 跨行），原译与修订都按中文句末标点切句后同段内按序号配对——跨语言的句数天然不等，**不做中英句级硬配**，因此不会串行；改动片段沿用 `parseEdits()` 的 `to`（修订列 `.tri-add` 绿底 + 绿点）与 `from`（原译列 `.tri-del` 红删除线）高亮；顶部信息行「N 段 · N 句 · 批注 N 处（N 句含改动）· 本地生成，不花 token」，另有「⧉ 复制三栏表格」（TSV，可直接贴 Excel）「⧉ 复制修订全文」「↩ 回文档视图」；`#post-bar` 在三栏视图下暂存隐藏、切回原样恢复；每轮新 `run()` 与 `restoreTask()` 结束都会 `syncOutView()` 归位。测试 `tests/31-tri-column.js` 8 断言；`_check` bad=0、全量 **36/36 全绿**。版本号 `js/01-core.js:2` = 4.30.0
- **v4.31.0** 段落对齐体检（T-011 · 六机制 M3「block-id 同构物」）：🧰 工具组新增「🧩 段落对齐」按钮（`#btn-para-audit`，紧跟 专名体检，新 id、旧按钮全不动）。`js/08-render-audit.js` 新增纯函数 `paraAudit(srcText, dstText)`（按空行切段、口径与 `triSplitParas` 完全一致；首尾空壳剥掉、中间空段保留）返回 `{srcN, dstN, diff, status, blanks, missing, extra}`，status 三态 **equal / short（缺段）/ long（多段）**，blanks 记译文整段空白的位置；`showParaAudit()` 照 `showTermAudit` 面板样式逐位置标出「原文第 N 段 → 译文没有对应段落」「译文第 N 段 → 原文没有对应段落」「译文第 N 段是空的」并贴出对应原文/译文摘录（160 字截断），底部「本地比对 · 不调 AI · 不花 token」。接线两处：按钮绑定 `js/08-render-audit.js`（`$('#btn-para-audit') && …` 守卫写法）、`run()` 收尾自动体检 `js/07-run-features.js`（`typeof paraAudit === 'function'` 守卫，段数对不上 toast 提醒一次）。**纯本地零 token**。测试 `tests/38-para-audit.js` 8 断言（按钮/旧锚点不动/三态/空段/面板位置文案/关闭）；`_check` bad=0（js=13）、全量 **37/37 全绿**。版本号 `js/01-core.js:2` = 4.31.0
- **v4.33.0** 数字与格式体检（T-015 · P0 · 待办功能统一清单第 1 项）：`js/08-render-audit.js` 新增纯函数 `numAudit(srcText, dstText)` + 面板 `showNumAudit()`。四类硬伤逐处标位：①丢失/被改的数字（原文有、译文对不上）②凭空多出的数字 ③百分号丢失（原文有 `%`，译文既无 `%` 也无「百分之」）④疑似漏否定——段数对齐时按空行切段逐段查（原文段有 not/不/无/未 而对应译文段一个否定词都没有），对不齐时退化为否定词总量对比。**万/亿换算自动配对抵消**（`isWan()`：15,000↔1.5万、亿同理，只抵消「一边整条缺失」的，数量对不上的仍报），避免中文换算误报。数字全角转半角、`≥2 位`才查（单数字噪音大）、面板每类最多列 12 条带上下文。接线：`index.html` 🧰 工具组新按钮 `#btn-num-audit`（🔢 数字体检，插在 btn-para-audit 后，旧按钮 id 全不动）；`js/07-run-features.js` run() 收尾自动体检（`typeof numAudit` 守卫，有可疑即 toast）；`js/01-core.js:2` = 4.33.0。测试 `tests/40-num-audit.js` 8 断言（函数定义/丢失检出/多出检出/百分号/漏否定逐段/干净 clean/万换算不误报/按钮+旧锚点+面板开关）；`_check` bad=0（js=13）、全量 **39/39 全绿**
- **v4.34.0** 三段流水线卡死修复 + 线上报错自动上报（真实用户反馈「进入工作后直接无法使用卡顿」，v4.29.0 埋的三个 bug）：①**段号越位修复**——旧 \`#pl-next.onclick\` 先 \`PL.stage++\` 再检查，失败重试 3 次后 stage 顶到 4 且不回退，按钮永久失灵；改为段号由已完成内容推导（\`!PL.draft ? 1 : (!PL.critique ? 2 : 3)\`），失败/中断永远重跑同一段，\`PL.stage\` 只在 \`plRun\` 真正跑完后推进（stage=已完成到第几段，失败不前进）。②**关弹窗 running 卡死修复**——旧 \`pl-close\` 只 \`closeModal()\` 不清 running，跑到一半关闭再打开后 \`if(PL.running) return\` 把一切拦截；改为关闭即取消本段（\`PL.cancel=true\` + abort + \`PL.running=false\` + \`PL.ctrl=null\`），\`plOpen()\` 重开时也先掐掉残留调用再重置。③**中断立即生效**——\`callModelSimple(sys,user,maxTok, extSignal)\` 加第 4 参外部 AbortController，\`PL.ctrl\` 作运行凭证，「⏹ 中断」与关闭弹窗立即 abort，不再干等 CFG.timeout（默认 180s）；\`finally\` 只在 \`PL.ctrl===ctrl\` 时清 running（避免污染新一轮），弹窗被关/重开过的过期结果直接丢弃；主动中断不再算失败，给「已中断，可重试本段」提示。④**线上报错自动上报** \`js/11-feedback.js\` 新增 \`fbAutoReport(kind,msg)\`：\`unhandledrejection\` 监听（新增）+ 原 \`error\` 监听接入，**线上 https 才发**（本地 http 静默、无 /api 通道）、同报错去重、30 秒节流，走 \`/api/feedback/submit\` 进 KV；开发端 \`_errwatch.js\` 看门狗每 60s 经代理巡检 \`/api/feedback/list\`，发现新条目即退出提醒主控 → 在 DSH 聊天框告知用户。测试 \`tests/41-pipeline-recover.js\` 8 断言（失败后段号不越位/重试真重发×3/4 次后仍本段失败/关弹窗重开能重跑且发新请求）；\`_check\` bad=0（js=13）、全量 **40/40 全绿**。版本号 \`js/01-core.js:2\` = 4.34.0
- **v4.32.0** 术语权威分级（T-012 · 六机制 M4「approved 状态机」）：专有译词库（`GLOSS.terms`）词条 status 三态 **待审(pending) / 已批准(confirmed) / 已拒绝(rejected)**，校对提示词**只锁定「已批准」的译法**，待审与已拒绝不强制。①**唯一闸门** `approvedGloss()`（`js/09-gloss.js`）：所有提示词注入点必须走它——修掉 4 处泄漏/遗漏：`js/02-prompts-reverse.js` 提炼方针（原漏 status 过滤，`typeof approvedGloss` 守卫因 02 早于 09 加载）、`js/03-translate.js` 翻译段、`js/13-pipeline.js` 管线段、`js/07-run-features.js` buildSystem（原只注 TERMS 不含 GLOSS，现「已批准专有译词锁定一致」块受「术语」勾选控制）。②**状态机** `glossSetStatus(id, status)`（js/09-gloss.js）：迁移即 toast + `saveGloss()` 持久化 + `glossLog` 记录，状态徽章统一走 `G_ST_LABEL`（confirmed 显示「已批准」）；renderGlossTable 状态格下加快捷按钮 `data-approve`（✓ 批准）/`data-topend`（↺ 待审）/`data-toreject`（✗ 拒绝）按状态显隐。③**改已批准需再批**：`js/08-render-audit.js` `showVerifyResults` 新增 `opts.onApprove`——核查判定 `ok`（正确）时渲染「✓ 批准」一键把词条设为已批准；采纳建议（`data-adopt`）仍自动打回「待审核」。旧锚点（btn-audit/btn-view-doc/btn-view-tri）全不动。测试 `tests/39-gloss-approved.js` 7 断言（闸门只认已批准/buildSystem 注入只含已批准/快捷按钮显隐/点批准迁移持久化/glossSetStatus 打回/ok→一键批准/旧锚点不动）；`_check` bad=0（js=13）、全量 **38/38 全绿**。版本号 `js/01-core.js:2` = 4.32.0
- **v4.35.0** 三栏对照提速 + 翻译区直出（真实用户反馈「三栏对照功能仍然卡顿，我希望该功能成为翻译时的可选项而非翻译框外的工具」）：①**提速**——`js/08-render-audit.js` 原 `renderTriView` 每渲染一行就 `new RegExp()` 一次，O(行数×批注数)；新增 `triBuildRe(frags)`（排序去重后拼一次大正则）与 `triHit(re, s)`（每次 `lastIndex=0` 再 test），正则提到循环外只算一次，`triMark(text, frags, cls, re)` 加第 4 参复用；`missing` 改为按已扫命中的 `seen` 集合过滤。实测 300 段 × 3 次渲染仅 5ms。②**翻译区直出**——译文框下新增 `#btn-tri-inline` 开关与 `#tri-inline` 面板，`triInlineToggle`/`renderTriInline`（300ms 防抖、300 行上限、未校对时修订列标「（未校对）」），`syncOutView()` 末尾接线，`#src`/`#dst` input 监听实时刷新。⚠️ **坑**：按钮原本放在 `#dstFileBar` 里，被 `js/05-files-docx.js:546 renderFileBar()` 在启动时擦掉（该函数会重写 FileBar 的 innerHTML，由 `10-app-init.js:203` 调用）——**任何塞进 FileBar 容器的按钮都会被启动时擦除，必须放在容器外**。测试 `tests/42-tri-inline.js` 8 断言；全量 **41/41 全绿**。版本号 = 4.35.0
- **v4.36.0** 体检中心 + 译文总评分 + 风格简报（甲乙丙丁四功能，源自 dsh-plugin-translation 借鉴结论 + 排版整理）：①**排版**——🧰 工具组 8 个按钮减到 5 个（本章注释/配图/改动对照/**体检中心**/下载文档），术语·专名·段落·数字四项体检 + 新增总评分/风格简报全部收进隐藏容器 `#audit-center`，由 `#btn-audit-center` 开合；容器内 6 个勾选开关（`ao-term/pnoun/para/num/quality/tone`）+ `▶ 一键体检`，**四个旧按钮 id 一个没动**（tests/38/39/40/42 都断言它们存在）。②**甲 译文总评分** `qualityScore(src,dst)`：忠实度 60 起扣（数字 / 段落 / 术语未按已批准 / 占位符 / 未翻译残留 / 长度比）、流畅度 40 起扣（句数不匹配 / 重复标点 / 超长句），`score = fidelity + fluency`，`qLevel()` 给 S≥90/A≥85/B≥70/C≥50/D，刻度与「质量预估」一致；`showQuality()` 复用 88px 圆环 + 26px 大数字样式 + 逐条扣分明细。③**乙 漏译残留**——`runs = dst.match(/[A-Za-z][A-Za-z'’-]{3,}(?:\s+[A-Za-z][A-Za-z'’-]{2,}){2,}/g)` 抓成片未翻英文；另加「译文几乎没翻译」判定（原文中文 >20 字且译文中文字 <10%）。④**丙 占位符保护** `Q_PROT_RE`+`protectList()`——网址/邮箱/\`代码\`/（1）（2）编号，译文丢一个扣 4 分并点名。⑤**丁 风格简报** `TONE_BRIEF`（学术严谨/专业可读/大众科普/文学性/口语化 各 5 条）+ `showToneBrief()`。⑥**一键体检** `auditAll()` 按开关聚合各项、每行带「看细节」按函数名字符串跳回原面板。选项存 `tp.auditOpts`。⚠️ **开发坑**：新模块里两次把 `$$` 写成 `$`（querySelector 返回单元素，没有 `.forEach`），导致页面一开就报错、连带 `let TRI_INLINE_ON` 的 TDZ 错误——**绑定多个元素一律用 `$$`**。测试 `tests/43-audit-center.js` 13 断言；`_check` bad=0（js=13）、全量 **42/42 全绿**。版本号 = 4.36.0

- **v4.37.0** 标点·书名号对账（T-023 · audit_parity 取经）：原文 vs 译文《》/「」/括号/引号/问号/叹号/破折号/省略号逐个对账，悬空括号、漏标多标直接标出——纯本地零 token。测试 `tests/44-punct-audit.js`；`_check` bad=0、全量 **44/44 全绿**。版本号 = 4.37.0
- **v4.38.0** 翻译腔体检（T-025 · NO-FINAL-DE / 黑名单词 /「的」密度）：句末落「的」、「的」字堆叠、「作为…的东西/被…所」套话——纯本地零 token。测试 `tests/45-style-audit.js`；`_check` bad=0、全量 **45/45 全绿**。版本号 = 4.38.0
- **v4.38.1** 插件反馈路由补丁：`js/11-feedback.js` 按环境分流——真网页走自家接口，插件/本地一律发线上；`01-core.js` 只改版本号。

## 七、测试方式

```bash
cd transproof
node serve.js                       # 起本地服务（python 不可用，自写 node 静态服务器）
node tests/14-backup.js             # 跑某个测试（需 playwright-core）
```

- 测试用 Edge headless（`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`）。
- playwright-core 在 `C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core`。
- node 用 `C:/Program Files/nodejs/node.exe`（v24.21.0）。
- 已知 flaky：全量回归连续跑 14 个测试，末尾测试偶发卡住（浏览器资源），单独重跑即过，非产品 bug。

## 八、关键约定（务必遵守）
4. **【发版收尾铁律，用户 2026-10-14 指定（m04369）】** 每次功能更新 + 版本 bump 之后，除非用户提前另说，必须完成「自检 + 两份文档」：
   - 自检：`node _check.js`（bad=0）→ UI 改版轮加 `_verify-ui.js` → `node run-all.js` 全量（需先起 `node serve.js`，浏览器测试要 danger-full-access）→ bump 后**复跑一遍全量**；
   - 两份文档：①更新 index.html 的 `#p-help` 使用指南（本次新功能/新界面写成白话说明）；②更新 `transproof\乱风企划tips.md`（已上线表加行 + 计数、状态与 Top 清单）；
   - 然后才是三副本同步 → _stage → wrangler 发布 → 线上验证，答复带约定提醒（看 tips + 「革命尚未成功，同志仍需努力」）。

1. **术语一致性是用户最核心的诉求**，所有功能都围绕"省事 + 术语统一 + 省 token"。
2. 用户是文科生，功能要"零基础能懂、一键能用"，别搞复杂交互。
3. 用户偏好：结构化输出、表格、emoji 标记、多角度全面讲解。
4. **发布上线（重要，已改为自主发布）**：本项目已迁移到 **Cloudflare Pages** 托管，**不再依赖 WorkBuddy 的 `workbuddy_sites_deploy`**。
   ⚠️ **每次改完代码，立即执行一次发布（不要攒着、不要等下次）**。
   改完代码后，在本工作区直接执行：
   ```bash
   bash publish.sh
   ```
   或全路径：`bash ~/.transproof-deploy/deploy.sh`
   ⚠️ 本机若无 Git Bash（实测 2026-10-12 无 bash），可直接用 node 跑本机 wrangler：
   `C:\Users\Andrew\.workbuddy\binaries\node\versions\22.22.2-6\node.exe` 运行
   `...\node_modules\wrangler\bin\wrangler.js pages deploy <stage> --project-name=transproof --branch=main --commit-dirty=true`，
   stage 目录里放 index.html + config.js 即可；凭证走 OAuth（token 留空）。
   若要强制发布本工作区里这份：
   ```bash
   bash ~/.transproof-deploy/deploy.sh "$(pwd)/transproof"
   ```
   - 线上地址：**https://transproof.pages.dev**（链接固定，每次更新不变）
   - **智能选源**：不指定目录时，脚本会比较 WorkBuddy 副本与本工作区副本的修改时间，
     自动发布**较新**的那份；发布成功后会把这份**回写**到另一处，两边始终一致
     （加 `--no-sync` 关闭回写；`--dry-run` 只演练不上传）
   - **凭证已配置完毕，可直接使用。** 身份方式是 `wrangler login` 的 OAuth 授权
     （凭据在 `C:\Users\Andrew\AppData\Roaming\xdg.config\.wrangler\config\default.toml`），
     Account ID 已写在 `~/.transproof-deploy/env`。**没有手工建 API Token，也不需要建。**
     若将来提示授权失效：跑 `bash ~/.transproof-deploy/wrangler-login.sh` 重新授权一次。
   - wrangler 4.149.0 已装在本机（`~/.workbuddy/binaries/node/versions/22.22.2-6/`），
     脚本优先用它，**不会**联网下载；Cloudflare API 连通性已实测通过
   - 上传 `index.html`、`config.js`，以及** OCR 语言包 `chi_sim.traineddata.gz` + `eng.traineddata.gz`（v4.21.2 起必带，放同一 stage 目录，否则线上 OCR 回落 jsdelivr 又被墙）**；测试/备份/文档不上传
   - 旧链接 `https://transproof.app.workbuddy.host/` 已停止更新（保留最后一次内容作归档）

## 九、下一步方向（待办）

> 📌 **用户约定（务必遵守）**：用户要求每次完成一个请求后，都提醒他看 `乱风企划tips.md` 的未竟目标清单，并提醒「**革命尚未成功，同志仍需努力**」——持续用这份清单鞭策推进，别做完一件事就"收工忘事"。

**长期目标清单**（详见 `乱风企划tips.md`，含 GitHub / BelinDoc 取经结论）：

| 优先级 | 功能 | 可行度 |
|---|---|---|
| 🥉 P3 | 团队审校留痕 / 真·云端协作 | 低（大工程，暂缓）|

> ✅ 已完成：P1 导回 Word 修订模式（v4.23.0）、P1 翻译记忆模糊匹配（v4.23.0）、P2 多模型预设（v4.23.0）、3 秒开屏/工具栏分组/疑难标注（v4.24.0）、使用指南效果演示（v4.25.2）、三段流水线（v4.29.0）、修订对照三栏逐句视图（v4.30.0）、段落对齐体检 🧩（v4.31.0，六机制 M3 / T-011）、术语已批准分级 ✅（v4.32.0，六机制 M4 / T-012）、数字与格式体检 🔢（v4.33.0，待办统一清单第 1 项 / T-015）、三段流水线卡死修复 ⚙（v4.34.0）、三栏对照提速 + 翻译区直出 📊（v4.35.0）、体检中心 🩺 + 译文总评分 📊 + 风格简报 🎛（v4.36.0，甲乙丙丁四功能）、标点·书名号对账 🔣（v4.37.0）、翻译腔体检 📝（v4.38.0）。

## 十、关于"对话记录"

本项目原在 WorkBuddy 平台开发。完整的开发决策、版本演进、踩坑记录已浓缩在 `project-memory/` 的多个 md 日志里（按时间记录了每个版本改了什么、为什么、坑在哪）。接手时先读最新的 `project-memory/2026-10-14.md`，再往前读 `2026-10-12.md`（v4.21.1-4.23.0）`2026-10-11.md`（v4.21.0 UI 改造）→ `2026-10-10.md`（v4.17-4.20 术语/预估/查证/批量）→ `2026-10-09.md`（v4.16.1 自检）→ `2026-10-07.md` → `2026-09-24.md`（早期）。
