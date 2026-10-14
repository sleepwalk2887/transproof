// L1 拆分：把 index.html 主 <script> 按段落横幅切成 js/10 个文件（纯搬运，零逻辑改动）
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const HTML = path.join(ROOT, 'index.html');
const raw = fs.readFileSync(HTML, 'utf8');
const lines = raw.split(/\r?\n/);

// 1-based 行号 → 0-based 索引；每个文件从 startLine 开始（必须是 /* ═ 横幅行）
const FILES = [
  { start: 1595, name: '01-core.js' },        // 配置与状态 + 翻译记忆 + 基础 helpers
  { start: 1816, name: '02-prompts-reverse.js' }, // 页面切换 + Prompt 库 + 反向翻译 + callModelSimple
  { start: 2317, name: '03-translate.js' },   // 翻译工作台 ts*
  { start: 2743, name: '04-settings-data.js' },   // 设置页 + 术语库 + 云端同步 + 数据管理 + 示例
  { start: 3142, name: '05-files-docx.js' },  // 文档解析(pdf/ocr/docx) + 导出 + 断点续传 + 回写引擎
  { start: 3976, name: '06-track-scan.js' },  // 修订模式 diff + 智能扫描抽词
  { start: 4639, name: '07-run-features.js' },    // 提示词构建 + 调用模型 + 运行/进度/预估/疑难/整理
  { start: 5299, name: '08-render-audit.js' },    // 阶段/统计/MD渲染/折叠/决策面板/导出/注释/体检/配图/对照/历史
  { start: 6090, name: '09-gloss.js' },       // 专有译词库
  { start: 6812, name: '10-app-init.js' },    // 项目看板 + 主题 + 开屏 + 初始化
];
const SCRIPT_OPEN = 1594;  // '<script>'
const SCRIPT_CLOSE = 7032; // '</script>'

// —— 断言边界真实可靠 ——
function assertLine(n, expectPrefix, what) {
  const l = lines[n - 1];
  if (l === undefined || !l.startsWith(expectPrefix)) {
    console.error(`FATAL: line ${n} (${what}) 应以 "${expectPrefix}" 开头，实际: ${JSON.stringify(l)}`);
    process.exit(1);
  }
}
assertLine(SCRIPT_OPEN, '<script>', 'script 开始');
assertLine(SCRIPT_CLOSE, '</script>', 'script 结束');
for (const f of FILES) assertLine(f.start, '/* ═', f.name + ' 切点');

// —— 切片 ——
fs.mkdirSync(path.join(ROOT, 'js'), { recursive: true });
const bounds = FILES.map(f => f.start).concat([SCRIPT_CLOSE]); // 每段 [start, 下一个start)
let bad = 0;
for (let i = 0; i < FILES.length; i++) {
  const from = bounds[i];                       // 1-based 首行
  const to = (i + 1 < bounds.length ? bounds[i + 1] : SCRIPT_CLOSE) - 1; // 1-based 末行（下一段开始前一行；末段到 </script> 前）
  const chunk = lines.slice(from - 1, to).join('\n');
  const out = path.join(ROOT, 'js', FILES[i].name);
  fs.writeFileSync(out, chunk, 'utf8');
  // 语法校验（真实 script 解析）
  const chk = spawnSync(process.execPath, ['--check', out], { encoding: 'utf8' });
  const ok = chk.status === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'BAD '} ${FILES[i].name}  行 ${from}-${to} (${to - from + 1} 行)`);
  if (!ok) console.log(chk.stderr);
}
if (bad) { console.error(`FATAL: ${bad} 个文件语法失败，index.html 未动`); process.exit(1); }

// —— 生成 index.html：把 1594-7032 整块替换为 script 标签列表 ——
const tags = FILES.map(f => `<script src="js/${f.name}"></script>`);
const rebuilt = lines.slice(0, SCRIPT_OPEN - 1)   // 1..1593
  .concat(tags)                                     // 替换块
  .concat(lines.slice(SCRIPT_CLOSE))                // 7033..end
  .join('\n');
fs.writeFileSync(HTML, rebuilt, 'utf8');
console.log('index.html 已重写，行数:', lines.length, '→', rebuilt.split('\n').length);
console.log('SPLIT DONE');
