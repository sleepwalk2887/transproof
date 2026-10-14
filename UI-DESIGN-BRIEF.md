# 译校助手 · UI 融合设计任务书（给 dsh 的提示词）

> **用法**：把本文件整个交给 dsh，或对它说「读一下 UI-DESIGN-BRIEF.md，按里面的规范做一版 UI 融合改造，先给方案再动手」。
> 生成时间：2026-10-14（v2 · 新增第 4 节字体系统、第 6 节开屏动画预留）
> 基于对线上 v4.24.0 及三副本源码的实读。

---

## 0. 一句话目标

把 **Swiss 现代主义的栅格与留白**、**屋顶现视研的编辑排印气质**，注入译校助手现有的**「纸墨朱印」文人风**——
不换血，只淬火：**底色、朱红点缀、锐利直角、八标签页结构全部保留**，让界面从"能用"升级到"像一本安静的学术工具书"。

**本轮两个重点**：① 建立**分区字体系统**（第 4 节，最主要的工作量）；② 为下一轮的开屏动画改造**预留骨架**（第 6 节，本轮不做动画）。

---

## 1. 三种参照风格的共性（改造的理论依据）

| 共性 | Minimalism & Swiss | Swiss Modernism 2.0 | 屋顶现视研 |
|---|---|---|---|
| 栅格是骨架 | strict grid | 12-column grid | 12 栏 + 680px 正文宽 |
| 留白是材料 | white space | mathematical spacing | 大量呼吸空间 |
| 单一强调色 | high contrast | 蓝色单点 | 米白底 + 深靛蓝单点 |
| 字体即装饰 | disciplined typography | 无衬线大标题 | 思源宋体 + Newsreader 双轨 |
| 内容优先 | only elements that earn their place | asymmetric balance | 类型标签 + 作/校署名 |

**翻译成一句设计法则：层级靠字号、字重与留白建立，不靠颜色、边框和阴影。**

---

## 2. 保留清单（改动禁区，违反即返工）

1. **八个标签页**结构与全部功能入口；所有按钮 `id`、交互逻辑、测试锚点
2. **配色基座**：暗 `--bg:#1a1915` / 亮 `--bg:#ece5d6`、朱红 `--ac:#d63a2c` 及其语义（朱红 = 主动作/当前/错误，禁止挪作他用）
3. **锐利气质**：`--r:2px` 圆角、`--sh-*:none` 无阴影——这本身就是 Swiss 血统，是工具的性格
4. 明暗双主题机制与用户自定义 `ACCENT` 能力
5. 信息密度：这是生产力工具，**禁止为美感牺牲单屏信息量**
6. **开屏动画现有逻辑不动**（`#tp-splash`、`splash-on` 开关、`splash-slogan`、`splash-deco` 的行为与时长本轮一律不改，只做第 6 节的字体接驳与变量预留）

---

## 3. 要引入的六项新品质

### 3.1 数学间距（mathematical spacing）
- 基准 4px，只允许：`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`
- 现有 `body padding:16px` → `20px`（160px 节奏的约数）；卡片内边距统一 `16px`；区块间距统一 `24px`
- **删掉多余边框**：能用 24px 留白分隔的，不再画线；`--bd` 建议改半透明（暗 `rgba(237,232,216,.12)` / 亮 `rgba(27,26,22,.15)`），形成 hairline 质感

### 3.2 严格栅格（strict grid）
- 全局内容最大宽 `1200px` 居中（现 1500px 偏散）
- 术语库/卡片流维持 `repeat(auto-fill,minmax(280px,1fr))`，卡片高度对齐
- 断点保留 768 / 1100，别动

### 3.3 非对称平衡（asymmetric balance，只用于两处）
- **结果展示区**：译文主栏 + 批注侧栏，比例 `minmax(640px,2fr) / minmax(280px,1fr)`（大:小 ≈ 2:1）
- **详情/弹窗**：标题区窄 + 内容区宽
- ⚠️ 表单、设置页、术语表格**禁用**非对称——那里要的是整齐

### 3.4 分区字体系统（**本轮核心**，详见第 4 节）
把现有"全站一套字体"拆成**四层分区**，中西文各守一族。

### 3.5 类型标签系统（向屋顶现视研借）
- 结果区条目、术语卡片左上角加**单字标签**：`检`（逻辑问题）`议`（建议）`危`（高风险）`术`（术语）
  用现有 `--err/--warn/--ac` 着色，样式统一为：11px mono + 1px 边框 + 直角，**不引入新颜色**
- 沿用「论/评/译/访/社」的思路：**标签分类别，颜色表级别**

### 3.6 高对比（high contrast）
- 正文对背景对比度 ≥ 7:1；`--warn:#a89f8d`（暗）偏灰，提为 `#c9c0ac`
- 朱红仅作小面积点缀，单屏朱红面积 < 5%

---

## 4. 字体系统 · 分区双轨（本轮最主要的工作）

### 4.0 先说一个必须澄清的前提

用户点名的 **Neo Sans Pro 是商业字体**（Seb Lester 设计 / Monotype 发行），**不可内置、不可随项目分发**。
它的开源等价物是 **IBM Plex Sans**（SIL OFL，机械感硬朗、x-height 大、笔画末端平切），气质最接近；次选 **Inter**（OFL，中性偏理性）。

因此本方案确立一条**总原则**：

> **西文用真·开源字体（IBM Plex 家族，体积小可加载）；
> 中文用思源家族系统栈（黑体 / 宋体 / 等宽三兄弟）——因为中文字体动辄 10MB+，无法内置。**

这正好满足"中文在不同分区采用同一系列的不同类字体"：思源黑体（界面）、思源宋体（阅读）、更纱黑体（数据），**同一家族、三种气质**。

### 4.1 四层分区定义

| 层 | 代号 | 用在哪 | 西文 | 中文 |
|---|---|---|---|---|
| **A 界面层** | `--f-ui` | 导航、标签页、按钮、表单、设置项、表格表头、卡片标题 | IBM Plex Sans → Inter → Helvetica Neue → Segoe UI → system-ui | 思源黑体 → Noto Sans SC → 苹方 → 微软雅黑 |
| **B 阅读层** | `--f-read` | 校对结果正文、译文、批注长文、术语释义、弹窗正文 | IBM Plex Serif → Source Serif 4 → Newsreader → Georgia | 思源宋体 → Noto Serif SC → 宋体-简 → SimSun |
| **C 数据层** | `--f-mono` | 时间戳、字数统计、编号、术语 ID、正则、diff、行号、`kbd`、卡片右上角的 `UNIT 0X` | IBM Plex Mono → JetBrains Mono → SF Mono → ui-monospace | 更纱黑体 Sarasa Mono SC → 思源黑体 |
| **D 题注层** | `--f-quote` | 引文、古文原文、题跋、例句原文（**可选层**，无字体时回落 B 层） | EB Garamond → IBM Plex Serif | 朱雀仿宋 → FangSong → 楷体 |

**为什么西文也用"一族多类"**：IBM Plex 是唯一同时具备 Sans / Serif / Mono / Condensed 且**全部开源**的大家族，与思源家族的中英气质天然对齐——英文是 Plex 的衬线，中文是思源的宋体，两者并排不打架。这正是屋顶现视研那套"中西文双轨"的精髓。

### 4.2 直接可用的 CSS（贴进 `:root`）

```css
:root{
  /* —— A 界面层：硬朗 neo-grotesque —— */
  --f-ui: "IBM Plex Sans","Inter","Helvetica Neue","Segoe UI",system-ui,
          "Source Han Sans SC","Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;

  /* —— B 阅读层：编辑排印衬线 —— */
  --f-read:"IBM Plex Serif","Source Serif 4",Newsreader,Georgia,
           "Source Han Serif SC","Noto Serif SC","Songti SC",SimSun,serif;

  /* —— C 数据层：等宽 + 表格数字 —— */
  --f-mono:"IBM Plex Mono","JetBrains Mono","SF Mono",ui-monospace,
           "Sarasa Mono SC","Sarasa Fixed SC","Source Han Sans SC","Noto Sans SC",monospace;

  /* —— D 题注层：仿宋 / 古典 —— */
  --f-quote:"Zhuque Fangsong",FangSong,STFangsong,KaiTi,STKaiti,
            "EB Garamond","IBM Plex Serif",serif;

  /* —— 字号阶梯（同屏不超过四档）—— */
  --fs-meta:12px; --fs-ui:13px; --fs-sm:15px; --fs-body:16px;
  --fs-h3:18px;   --fs-h2:22px; --fs-h1:28px;

  /* —— 行高 —— */
  --lh-ui:1.5; --lh-body:1.8; --lh-mono:1.6;
}
body{ font-family:var(--f-ui); font-size:var(--fs-ui); line-height:var(--lh-ui); }
```

### 4.3 分区接线表（dsh 按此对号入座）

| 目标 | 改成 |
|---|---|
| `body`（现 `Space Grotesk,...`） | `font-family:var(--f-ui)`——**建议移除 Space Grotesk**，字形偏俏皮，与"硬朗干净"冲突；如保留请置于 Inter 之后作兜底 |
| 校对结果输出区、译文本框、批注正文 | `font-family:var(--f-read); font-size:16px; line-height:1.8; letter-spacing:.02em` |
| 所有 `ui-monospace` 出现处（第 388、431、440 行等） | 统一换 `var(--f-mono)`；并加 `font-variant-numeric:tabular-nums`（数字等宽对齐） |
| `input,textarea,select` | 界面表单用 `--f-ui`；**但译文输入/编辑大文本框用 `--f-read`**（写译文本就要有书写感） |
| 导出的 Word HTML（第 5901 行内联 style） | `--f-read` 对应的宋体栈 + 16px/1.8 |
| 正则输入框（第 6479 行 `monospace`） | `var(--f-mono)` |
| `#tp-splash .sp-deco / .sp-meta` | `var(--f-mono)`（见第 6 节） |
| `#tp-splash .sp-slogan` | `var(--f-read)` + 字重 600 |
| 引文块 / 原文例句 | `var(--f-quote)` |

### 4.4 「硬朗」的四条硬规则

1. **字重下限**：正文不低于 `400`，界面不低于 `500`，按钮/当前标签 `600`。**禁用 100–300 细体**（细笔画在中文下极糊，是伤眼首因）
2. **只用 neo-grotesque / 机械感字形**：x-height 大、笔画末端平切。**禁止圆头字体**（Quicksand、Nunito、Comfortaa、Varela Round）
3. **全大写只允许出现在 C 层**（mono 标签 + `letter-spacing:.06em`）；界面文案禁止 `text-transform:uppercase` 的长句
4. **禁止中文斜体**（`font-style:italic` 对中文是伪斜体，字形被强行倾斜，极难看）——引文改用仿宋或字距区分

### 4.5 「不伤眼」的六条硬规则

1. **字号下限**：界面 13px、正文 16px、元信息 12px——**不允许再小**（现 9px/10px 的小标签统一提到 11px）
2. **行高**：界面 1.5 / 正文 1.8 / mono 1.6；段落间距 ≥ 1em
3. **中文字距**：正文 `letter-spacing:.02em`，界面层 **不加**（加了反而糊）
4. **不用纯黑纯白**：已有暖墨 `#1a1915` / 宣纸 `#ece5d8` 正是护眼配置，**保持不动**
5. **暗色模式字重降一档**：亮色 `600` 的地方暗色用 `500`，避免浅色字在深底上产生光晕（halation）
6. **不要全局开 `-webkit-font-smoothing:antialiased`**：macOS 下会让笔画变细，正文层尤其明显

### 4.6 字体加载策略（分层，默认零依赖）

| 档位 | 做法 | 状态 |
|---|---|---|
| **档 1（本轮必做）** | 纯系统字体栈，**零下载、离线可用、无 FOUT**。装了 Plex/思源就自动命中，没装就逐级回落 | ✅ 必做 |
| **档 2（预留，本轮不实现）** | 可选增强层：从 jsDelivr 加载 IBM Plex 的 **拉丁子集 woff2**（Sans/Serif/Mono 三档合计约 60–90KB），`font-display:swap`，中文仍走系统栈 | ⏳ 只留注释与开关 |

档 2 的预留方式（本轮**只写注释，不写 @font-face**）：

```css
/* TODO(v-next) 字体增强层：开关 FONT_CDN=true 时启用
   - 仅加载拉丁子集（unicode-range: U+0000-00FF, U+2000-206F）
   - 中文永不外链（体积过大 + 国内网络不可靠）
   - font-display:swap，避免阻塞首屏
   - 失败时静默回落档 1，不得影响渲染 */
```

> ⚠️ **中文绝不上 CDN**：思源宋体全量 10MB+，即使按 unicode-range 分片，首屏也可能下载数百 KB 且国内网络不稳定。**中文永远靠系统栈。** 想获得最佳效果的用户，可自行安装思源黑体/宋体全家桶（免费开源），全部分区即刻命中。

---

## 5. 明暗主题各调一套（不做简单反色）

| 变量 | 暗（现值→新值） | 亮（现值→新值） |
|---|---|---|
| bg | `#1a1915` 不变 | `#ece5d6` 不变 |
| tx | `#ede8d8` 不变 | `#1b1a16` 不变 |
| bd | `#3a362a` → `rgba(237,232,216,.12)` | `#b9af97` → `rgba(27,26,22,.15)` |
| accent | `#d63a2c` 不变 | `#d63a2c` 不变 |
| warn | `#a89f8d` → `#c9c0ac` | `#8a8271` → `#6f6754` |

（用户自定义 ACCENT 的逻辑不动；上表是默认值。）

**字体层面的明暗微调**（第 4.5 条第 5 点的落地）：

```css
:root[data-theme="dark"]{
  /* 暗底浅字易产生光晕：字重整体降一档 */
  --fw-strong:500; --fw-title:600;
}
:root[data-theme="light"]{
  --fw-strong:600; --fw-title:700;
}
```

---

## 6. 开屏动画（下一轮做，本轮只做准备）

`#tp-splash` 已在 v4.24.0 存在（含 `splash-on` 开关、`splash-slogan`、`splash-deco` 配置）。
**本轮不动它的时长、结构与显示逻辑**，只完成三件准备工作，让下一轮可以直接接动画：

### 6.1 字体接驳（本轮做）
- `.sp-deco`、`.sp-meta` → `var(--f-mono)`，配 `letter-spacing`（现有 `.4em` / `.3em` 保留）
- `.sp-slogan` → `var(--f-read)`，字重 600（暗色主题下按第 5 节降为 500）
- `.sp-hi` → `var(--f-ui)`

### 6.2 动画编排变量（本轮只声明，下一轮用）
```css
:root{
  --sp-dur:700ms;        /* 单段时长 */
  --sp-ease:cubic-bezier(.22,.61,.36,1);
  --sp-stagger:140ms;    /* 四段之间的错峰 */
  --sp-total:1180ms;     /* = dur + 3×stagger，供 JS 收尾计时用 */
}
```
把现有 `#tp-splash` 里写死的 `.7s / .12s / .26s / .42s / .58s` **替换成上述变量**（视觉效果不变，只是参数化）。

### 6.3 下一轮动画的设计意图（先记录，不实现）
- **意象**：宣纸渐显 → 朱印落章（一枚 `2px` 直角的朱红方块从 `scale(1.4)` 收到位），呼应"纸墨朱印"
- **时长**：总时长 ≤ 900ms（现约 1.18s，偏长）；分段 ≤ 4 段
- **可跳过**：任意点击 / 按键立即结束
- **无障碍**：`@media (prefers-reduced-motion:reduce)` 直接跳过播放
- **节流**：`sessionStorage` 标记，同一会话只播一次；`splash-on=false` 时完全不注入 DOM
- **禁止**：旋转、弹跳、缩放过冲、粒子、渐变流光——与 Swiss 气质冲突

---

## 7. 禁止清单（已按本次新增内容更新）

- ❌ 渐变、发光、大圆角（>4px）、重阴影、拟物
- ❌ 移动任何按钮 / 改任何 `id` / 删任何功能
- ❌ **内置或外链中文字体**（体积与网络双重风险；中文永远走系统栈）
- ❌ 使用商业字体（Neo Sans Pro 等）——只能用于视觉参照，不得写入代码
- ❌ 圆头字体、中文斜体、字重低于 400 的正文
- ❌ 引入非 `IBM Plex / Inter / 思源 / 更纱 / 朱雀仿宋` 系列之外的第四种字体家族（家族数 ≤ 4，否则气质散）
- ❌ 动画超过 200ms（开屏动画除外，见第 6 节）
- ❌ 为对称而对称——Swiss 的精髓是不对称里的秩序

---

## 8. 验收标准

1. `node run-all.js` 29/29 全绿，0 console error（DOM id 未动）
2. 所有间距值是 4 的倍数（可 grep 抽查）
3. 正文对比度 ≥ 7:1，警告色 ≥ 4.5:1
4. **字体检查**：
   - `grep -c "font-family"` 中，非 `var(--f-*)` 的裸字体声明 ≤ 3 处（其余全部走变量）
   - 结果区 `computed font-family` 命中 `--f-read`（衬线优先）
   - 界面区 `--f-ui`、元信息区 `--f-mono` 各就各位
   - 全站无 `font-weight` 低于 400 的正文文本
   - 无 `font-style:italic` 作用于中文节点
5. **离线检查**：断网后打开 `index.html`，界面不塌、无字体加载报错（证明档 1 生效）
6. 截图对比：改造前后布局骨架不变，气质从"紧凑工具"变为"安静的书"
7. 亮暗两套主题截图各一张，确认 accent 双调（不是反色）、暗色字重确实降了一档

---

## 9. 给 dsh 的一句话启动指令

> 读 `UI-DESIGN-BRIEF.md`，按第 3、4、5 节做 UI 融合改造：
> 保留第 2 节禁区里的一切；间距对齐 4px 网格；
> **建立第 4 节的四层分区字体系统（重点）**；bd 改 hairline；加单字类型标签；
> 明暗主题字重各调一套；第 6 节只做字体接驳与变量参数化，**不要改开屏动画的时长和逻辑**。
> 先输出改动计划（文件/行号级）等我确认，再动手；完成后跑全量测试并发布。

---

## 附录 A · 字体速查

| 字体 | 授权 | 体积 | 用途 | 获取 |
|---|---|---|---|---|
| IBM Plex Sans / Serif / Mono | SIL OFL | 拉丁子集各 ~20-30KB | 西文三层 | github.com/IBM/plex |
| Inter | SIL OFL | ~25KB | Plex 的次选 | rsms.me/inter |
| Source Han Sans SC（思源黑体） | SIL OFL | ~10MB 全量 | 中文界面 | 系统 / 自装 |
| Source Han Serif SC（思源宋体） | SIL OFL | ~10MB 全量 | 中文正文 | 系统 / 自装 |
| Sarasa Mono SC（更纱黑体） | SIL OFL | — | 中文等宽 | github.com/be5invis/Sarasa-Gothic |
| Zhuque Fangsong（朱雀仿宋） | SIL OFL | — | 中文题注 | github.com/lishaobos/Thin-House-Fangsong |
| Newsreader / Source Serif 4 | SIL OFL | — | 西文衬线次选 | Google Fonts |
