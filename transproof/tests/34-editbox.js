// tests/34-editbox.js — 结果/译文编辑 + Word 式查找替换
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
  await pg.waitForTimeout(800); // 等 400ms 的「继续上次任务」定时器先落地（新库为空、不弹），避免它与夹具写入赛跑后弹层挡点击
  let pass = 0, fail = 0;
  const T = (ok, name, extra) => { if (ok) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); } };

  console.log('===== 1. 校对结果：编辑 + 查找替换 =====');
  const FIX = '## 一、修订后译文\n\n第一处黑格勒。\n\n第二处黑格勒。\n';
  await pg.evaluate((f) => TransProof.setResult(f), FIX);
  const autoModal = await pg.evaluate(() => { const m = document.querySelector('#modal'); if (m && m.classList.contains('on')) { const t = m.textContent.slice(0, 60); if (window.closeModal) closeModal(); return t; } return ''; });
  if (autoModal) console.log('  [诊断] 页面自动开了弹层: ' + autoModal);
  await pg.evaluate(() => document.querySelector('#btn-out-edit').click());
  await pg.waitForSelector('.eb-wrap', { timeout: 5000 });
  T((await pg.inputValue('.eb-ta')) === FIX, '编辑框载入原文本');
  T(!(await pg.isVisible('#out')), '渲染区已隐藏');
  await pg.fill('.eb-find', '黑格勒');
  await pg.fill('.eb-repl', '黑格尔');
  T((await pg.textContent('.eb-count')).includes('找到 2 处'), '计数=找到 2 处', await pg.textContent('.eb-count'));
  await pg.click('.eb-repall');
  const taV = await pg.inputValue('.eb-ta');
  T(!/黑格勒/.test(taV) && (taV.match(/黑格尔/g) || []).length === 2, '全部替换生效');
  await pg.click('.eb-save');
  await pg.waitForSelector('.eb-wrap', { state: 'detached', timeout: 5000 });
  const res = await pg.evaluate(() => TransProof.getResult());
  T((res.match(/黑格尔/g) || []).length === 2, '保存后 LAST_OUT 更新', res.slice(0, 40));
  T(await pg.isVisible('#out'), '渲染区恢复显示');

  console.log('===== 2. 放弃修改不落盘 =====');
  await pg.evaluate(() => document.querySelector('#btn-out-edit').click());
  await pg.fill('.eb-ta', '被丢弃的内容');
  await pg.evaluate(() => document.querySelector('.eb-cancel').click());
  T(!/被丢弃的内容/.test(await pg.evaluate(() => TransProof.getResult())), '取消后结果不变');

  console.log('===== 3. 译文输出编辑 =====');
  // ts 卡在 #p-trans 页（默认隐藏），先切到翻译流程页再操作
  await pg.evaluate(() => window.__EB.setTs('甲行\n\n乙行'));
  await pg.evaluate(() => { const btn = document.querySelector('nav button[data-page="p-trans"]'); if (btn) btn.click(); });
  await pg.waitForSelector('#p-trans', { state: 'visible', timeout: 5000 });
  const autoModal2 = await pg.evaluate(() => { const m = document.querySelector('#modal'); if (m && m.classList.contains('on')) { const t = m.textContent.slice(0, 60); if (window.closeModal) closeModal(); return t; } return ''; });
  if (autoModal2) console.log('  [诊断] 切页后弹层: ' + autoModal2);
  await pg.evaluate(() => document.querySelector('#btn-ts-edit').click());
  await pg.waitForSelector('.eb-wrap', { timeout: 5000 });
  T((await pg.inputValue('.eb-ta')).includes('甲行'), '译文编辑框载入');
  await pg.fill('.eb-find', '行');
  await pg.fill('.eb-repl', '段');
  await pg.evaluate(() => document.querySelector('.eb-repall').click());
  await pg.click('.eb-save');
  const tsTxt = await pg.evaluate(() => document.querySelector('#ts-out').textContent);
  T(/甲段/.test(tsTxt) && /乙段/.test(tsTxt), '译文保存重渲生效', tsTxt.slice(0, 20));

  console.log('===== 汇总 =====');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  console.log('console errors: ' + errs.length); if (errs.length) console.log(errs.join('\n'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
