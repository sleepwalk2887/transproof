// tests/37-prompt-discipline.js — 制度纪律入提示词（tips 0-2；md §4 禁令1 + §5.2 优先级链）
const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://127.0.0.1:8123/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true });
  const pg = await b.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('page: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await pg.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pg.waitForFunction(() => window.TransProof && TransProof.version, null, { timeout: 20000 });
  await pg.waitForTimeout(800);
  let pass = 0, fail = 0;
  const T = (ok, name, extra) => { if (ok) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); } };

  console.log('===== 校对提示词纪律（0-2）=====');
  const sys = await pg.evaluate(() => buildSystem());

  T(/【不猜补】/.test(sys), '含【不猜补】条款');
  T(/【优先级链】/.test(sys), '含【优先级链】条款');

  // 不猜补：保留原文 + 标注存疑，且覆盖专名/数字/年代/引文
  T(/保留原文/.test(sys) && /存疑/.test(sys), '不猜补要求「保留原文 + 标注存疑」');
  T(/专名/.test(sys) && /数字/.test(sys) && /引文/.test(sys), '不猜补覆盖 专名/数字/引文');
  T(/绝不猜测|不得编造/.test(sys), '不猜补明令禁止猜测/编造');

  // 优先级链：准确性 > 语言自然度 > 术语一致性 + 不压平概念
  T(/准确性\s*>\s*语言自然度\s*>\s*术语一致性/.test(sys), '优先级链 = 准确性 > 语言自然度 > 术语一致性');
  T(/压平/.test(sys) && /(概念|区分)/.test(sys), '优先级链含「不得压平概念区分」');

  // 三条纪律同处一个提示词，且顺序在结构保持/注释标号之后（证明插在正确区块）
  const iP = sys.indexOf('【优先级链】'), iN = sys.indexOf('【不猜补】'), iZ = sys.indexOf('【注释标号】');
  T(iZ > -1 && iN > iZ && iP > iN, '顺序：注释标号 → 不猜补 → 优先级链', `z=${iZ} n=${iN} p=${iP}`);

  T(errs.length === 0, '0 报错', errs.join(' | '));

  await b.close();
  console.log(`\nPASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
