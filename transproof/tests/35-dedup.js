// tests/35-dedup.js — 批注去重回归（反馈 FB-MVBZVHKG-SOZ：模型退化重复刷屏）
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

  console.log('===== 批注去重（模型退化重复被折叠）=====');
  const FIX = [
    '## 一、修订后译文',
    '- [误译] recuperation → 改为「后殖民」',
    '- [误译] recuperation → 改为「后殖民」',
    '- [误译] recuperation → 改为「后殖民」',
    '- [误译] autre chose → 改为「其他事物」'
  ].join('\n');
  await pg.evaluate((f) => TransProof.setResult(f), FIX);
  const m = await pg.evaluate(() => { const x = document.querySelector('#modal'); if (x && x.classList.contains('on')) { if (window.closeModal) closeModal(); return 1; } return 0; });
  if (m) console.log('  [诊断] 自动弹层已关闭');

  // 跑真实渲染链 + 去重
  const r = await pg.evaluate(() => {
    markErrorLines(); renderAuditControls(); renderErrorFilter(LAST_OUT);
    const dupN = dedupAuditLines();
    const all = document.querySelectorAll('#out li[data-err]').length;
    const hidden = document.querySelectorAll('#out li[data-dedup]').length;
    const visErr = [...document.querySelectorAll('#out li[data-err]')].filter(l => l.style.display !== 'none').length;
    const badge = document.querySelector('#out .ef-dedup');
    return { dupN, all, hidden, visErr, badge: badge ? badge.textContent : '' };
  });
  console.log('  [诊断] ' + JSON.stringify(r));
  T(r.all === 4, '共 4 条批注', 'all=' + r.all);
  T(r.hidden === 2, '2 条重复被折叠', 'hidden=' + r.hidden);
  T(r.visErr === 2, '只剩 2 条可见（1 组重复 + 1 条独立）', 'visErr=' + r.visErr);
  T(r.dupN === 2, '返回折叠数 = 2', 'dupN=' + r.dupN);
  T(/×3\s*重复已折叠/.test(r.badge), '首条挂「×3 重复已折叠」角标', r.badge);

  // 不同批注不受影响
  const autre = await pg.evaluate(() => {
    const lis = [...document.querySelectorAll('#out li[data-err]')];
    const target = lis.find(l => /autre/.test(l.textContent));
    return target ? target.style.display !== 'none' : false;
  });
  T(autre, '不同批注（autre chose）不被误折叠');

  // 无重复时不应有角标
  const FIX2 = ['## 一、修订后译文', '- [误译] a → 改为「甲」', '- [误译] b → 改为「乙」'].join('\n');
  await pg.evaluate((f) => { TransProof.setResult(f); markErrorLines(); renderAuditControls(); renderErrorFilter(LAST_OUT); dedupAuditLines(); }, FIX2);
  const noBadge = await pg.evaluate(() => document.querySelectorAll('#out .ef-dedup').length);
  T(noBadge === 0, '无重复时不挂角标');

  console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
  if (errs.length) { console.log('❌ 页面报错:'); errs.forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
