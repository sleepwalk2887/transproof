const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

(async () => {
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrs = [], pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  console.log('===== 测试 1：版本号接入（#g-version + TransProof.version）=====');
  const ver = await page.evaluate(() => ({
    gVersion: (document.getElementById('g-version') || {}).textContent,
    tpVersion: window.TransProof ? window.TransProof.version : null,
  }));
  console.log('  #g-version=' + ver.gVersion + '  TransProof.version=' + ver.tpVersion);
  const ok1 = ver.gVersion === 'v' + ver.tpVersion;
  console.log('  ' + (ok1 ? '✅' : '❌') + ' 两者一致');

  console.log('\n===== 测试 2：集合数据模型（GLOSS.version=2 + collections 数组）=====');
  const model = await page.evaluate(() => {
    const g = window.TransProof && window.TransProof.gloss ? window.TransProof.gloss.data() : null;
    return { version: g ? g.version : null, hasCollections: g ? Array.isArray(g.collections) : false, termCount: g ? g.terms.length : -1 };
  });
  console.log('  ' + JSON.stringify(model));
  const ok2 = model.version === 2 && model.hasCollections;
  console.log('  ' + (ok2 ? '✅' : '❌') + ' version=2 且 collections 为数组');

  console.log('\n===== 测试 3：p-gloss 集合卡渲染（无集合 → 空提示）=====');
  await page.click('nav button[data-page="p-gloss"]');
  await page.waitForTimeout(300);
  const colBox = await page.evaluate(() => {
    const box = document.getElementById('g-collections');
    return box ? box.innerHTML : null;
  });
  const ok3 = !!colBox && colBox.indexOf('暂无集合') >= 0;
  console.log('  ' + (ok3 ? '✅' : '❌') + ' 集合卡存在且显示空提示');

  console.log('\n===== 测试 4：翻译工作台「选集合」弹窗 =====');
  await page.click('nav button[data-page="p-trans"]');
  await page.waitForTimeout(300);
  const hasBtn = await page.evaluate(() => !!document.getElementById('ts-btn-collections'));
  const ok4a = hasBtn;
  console.log('  ' + (ok4a ? '✅' : '❌') + ' ts-btn-collections 按钮存在');
  await page.click('#ts-btn-collections');
  await page.waitForTimeout(300);
  const modal = await page.evaluate(() => {
    const m = document.getElementById('modal');
    const body = document.getElementById('mBody');
    return { on: m ? m.classList.contains('on') : false, bodyText: body ? body.innerText : '' };
  });
  const ok4b = modal.on && modal.bodyText.indexOf('暂无集合') >= 0;
  console.log('  ' + (ok4b ? '✅' : '❌') + ' 弹窗打开且提示暂无集合');
  await page.evaluate(() => document.getElementById('mClose').click());
  await page.waitForTimeout(200);

  console.log('\n===== 测试 5：termActive 向后兼容（未分组术语恒 true）=====');
  const ta = await page.evaluate(() => {
    const fn = window.termActive;
    if (typeof fn !== 'function') return { ok: false, reason: 'termActive 不在 window 上' };
    return { ok: true, ungrouped: fn({}) === true, emptyCol: fn({ collections: [] }) === true };
  });
  const ok5 = ta.ok && ta.ungrouped && ta.emptyCol;
  console.log('  ' + (ok5 ? '✅' : '❌') + ' termActive 存在且未分组/空集合返回 true' + (ta.reason ? '（' + ta.reason + '）' : ''));

  console.log('\n===== 错误汇总 =====');
  console.log('  console errors:', consoleErrs.length);
  consoleErrs.slice(0, 20).forEach(e => console.log('    [console]', e));
  console.log('  page errors:', pageErrors.length);
  pageErrors.slice(0, 20).forEach(e => console.log('    [pageerror]', e));

  const pass = ok1 && ok2 && ok3 && ok4a && ok4b && ok5 && consoleErrs.length === 0 && pageErrors.length === 0;
  console.log('\n===== 汇总 =====');
  console.log(pass ? '✅ 全部通过' : '❌ 存在失败');

  await browser.close();
  if (!pass) process.exit(1);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
