// tests/33-pnoun.js — 专名一致性体检（proNounAudit 纯函数 + UI 统一替换）
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
  await pg.waitForTimeout(800); // 等 400ms 的「继续上次任务」定时器先落地（新库为空、不弹），避免与夹具写入赛跑后弹层挡点击
  let pass = 0, fail = 0;
  const T = (ok, name, extra) => { if (ok) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); } };

  console.log('===== 1. 纯函数三类识别 =====');
  const pure = await pg.evaluate(() => {
    const r1 = proNounAudit('黑格尔（Hegel）与黑格勒（Hegel）', '');
    const r2 = proNounAudit('Lukács György 写道 1848 年的事。', 'Lukács György und Hegel schrieben 1848, danach 2019.');
    return { r1n: r1.length, r1t: r1[0] && r1[0].t, r2: r2.map(x => x.t) };
  });
  T(pure.r1n === 1 && pure.r1t === '同名异译', '同名异译抓到 1 条', JSON.stringify(pure));
  T(pure.r2.includes('疑似未译') && pure.r2.includes('数字对不上'), '疑似未译 + 数字对不上', JSON.stringify(pure.r2));
  T(await pg.evaluate(() => proNounAudit('黑格尔（Hegel）一贯正确', '').length) === 0, '干净文本 0 条（低误报）');

  console.log('===== 2. UI：体检弹窗 + 统一替换 =====');
  await pg.evaluate(() => TransProof.setResult('## 一、修订后译文\n\n黑格尔（Hegel）说，历史在1848年转折。\n\n黑格勒（Hegel）不同意。\n\n## 二、批注'));
  const autoModal = await pg.evaluate(() => { const m = document.querySelector('#modal'); if (m && m.classList.contains('on')) { const t = m.textContent.slice(0, 60); if (window.closeModal) closeModal(); return t; } return ''; });
  if (autoModal) console.log('  [诊断] 页面自动开了弹层: ' + autoModal);
  await pg.evaluate(() => document.querySelector('nav button[data-page="p-work"]').click());
  await pg.evaluate(() => document.querySelector('#btn-pnoun').click());
  await pg.waitForSelector('#modal.on', { timeout: 5000 });
  const modalTxt = await pg.textContent('#modal');
  T(/专名体检/.test(modalTxt) && /同名异译/.test(modalTxt), '弹窗标题与内容');
  T((await pg.$$('#mBody input[type=radio]')).length === 2, '两个译法候选 radio');
  // 选「黑格勒」统一
  await pg.evaluate(() => { const r = document.querySelector('#mBody input[value="黑格勒"]'); if (r) r.checked = true; });
  await pg.click('#mBody [data-pn-unify]');
  const after = await pg.evaluate(() => TransProof.getResult());
  T(!/黑格尔/.test(after) && (after.match(/黑格勒（Hegel）/g) || []).length === 2, '统一替换全生效', after.slice(0, 60));
  T((await pg.textContent('#mBody')).includes('已统一'), '按钮态变为已统一');
  const btnTxt = await pg.textContent('#btn-pnoun');
  T(/专名体检/.test(btnTxt), '入口按钮存在');

  console.log('===== 汇总 =====');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  console.log('console errors: ' + errs.length); if (errs.length) console.log(errs.join('\n'));
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
