const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

(async () => {
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrs = [], pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('dialog', d => d.accept()); // 自动接受 confirm

  // 预置 4 条术语
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.setItem('tp.gloss', JSON.stringify({
      version: 2, sources: [], tags: [], rules: [], log: [], collections: [],
      terms: [
        { id: 1, foreign: 'Aufhebung', zh: '扬弃', aliases: ['升华'], type: '概念', status: 'confirmed' },
        { id: 2, foreign: 'Hegel', zh: '黑格尔', type: '人物', status: 'confirmed' },
        { id: 3, foreign: 'Sein', zh: '存在', type: '概念', status: 'pending' },
        { id: 4, foreign: 'Dasein', zh: '此在', type: '概念', status: 'pending' }
      ]
    }));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.click('nav button[data-page="p-gloss"]');
  await page.waitForTimeout(300);

  console.log('===== 词条批量管理 + 删除 =====');
  const termCount = () => page.evaluate(() => window.TransProof.gloss.data().terms.length);

  // 1) 批量栏常显（不再 display:none）
  const barVisible = await page.evaluate(() => {
    const bar = document.getElementById('g-batch');
    return bar && bar.style.display !== 'none';
  });
  console.log('  ' + (barVisible ? '✅' : '❌') + ' 批量栏常显');

  // 2) 单条删除按钮存在
  const hasDel = await page.evaluate(() => !!document.querySelector('#g-tbody tr [data-del]'));
  console.log('  ' + (hasDel ? '✅' : '❌') + ' 操作列有单条删除 🗑 按钮');

  // 3) 未勾选时批量按钮禁用
  const disabledInit = await page.evaluate(() => {
    const bar = document.getElementById('g-batch');
    return [...bar.querySelectorAll('button')].every(b => b.disabled);
  });
  console.log('  ' + (disabledInit ? '✅' : '❌') + ' 未勾选时批量按钮禁用');

  // 4) 勾选 1 条 → 批量按钮启用
  await page.evaluate(() => document.querySelector('#g-tbody tr [data-ck]').click());
  await page.waitForTimeout(200);
  const enabledAfterCheck = await page.evaluate(() => {
    const bar = document.getElementById('g-batch');
    return [...bar.querySelectorAll('button')].every(b => !b.disabled);
  });
  console.log('  ' + (enabledAfterCheck ? '✅' : '❌') + ' 勾选后批量按钮启用');
  // 取消勾选
  await page.evaluate(() => document.querySelector('#g-tbody tr [data-ck]').click());
  await page.waitForTimeout(200);

  // 5) 单条删除：点第一条 🗑 → 4 条 → 3 条
  await page.evaluate(() => document.querySelector('#g-tbody tr [data-del]').click());
  await page.waitForTimeout(400);
  const afterSingleDel = await termCount();
  const ok5 = afterSingleDel === 3;
  console.log('  ' + (ok5 ? '✅' : '❌') + ' 单条删除后剩 3 条（实际 ' + afterSingleDel + '）');

  // 6) 批量删除：勾选 2 条 → g-b-del → 剩 1 条
  await page.evaluate(() => {
    document.querySelectorAll('#g-tbody tr [data-ck]').forEach((ck, i) => { if (i < 2) ck.click(); });
  });
  await page.waitForTimeout(200);
  await page.click('#g-b-del');
  await page.waitForTimeout(400);
  const afterBatchDel = await termCount();
  const ok6 = afterBatchDel === 1;
  console.log('  ' + (ok6 ? '✅' : '❌') + ' 批量删除后剩 1 条（实际 ' + afterBatchDel + '）');

  // 7) 批量合并：重新预置 2 条 → 勾选 2 条 → g-b-merge → 合并成 1 条且别名并入
  await page.evaluate(() => {
    localStorage.setItem('tp.gloss', JSON.stringify({
      version: 2, sources: [], tags: [], rules: [], log: [], collections: [],
      terms: [
        { id: 10, foreign: 'Aufhebung', zh: '扬弃', aliases: [], type: '概念', status: 'confirmed' },
        { id: 11, foreign: 'Aufhebung', zh: '升华', aliases: ['统摄'], type: '概念', status: 'confirmed' }
      ]
    }));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.click('nav button[data-page="p-gloss"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.querySelectorAll('#g-tbody tr [data-ck]').forEach(ck => ck.click());
  });
  await page.waitForTimeout(200);
  await page.click('#g-b-merge');
  await page.waitForTimeout(400);
  const mergeRes = await page.evaluate(() => {
    const g = window.TransProof.gloss.data();
    return { count: g.terms.length, zh: g.terms[0] ? g.terms[0].zh : null, aliases: g.terms[0] ? (g.terms[0].aliases || []) : [] };
  });
  const ok7 = mergeRes.count === 1 && mergeRes.zh === '扬弃' && mergeRes.aliases.includes('升华') && mergeRes.aliases.includes('统摄');
  console.log('  ' + (ok7 ? '✅' : '❌') + ' 批量合并：2 条 → 1 条，别名并入（实际 ' + JSON.stringify(mergeRes) + '）');

  const allOk = barVisible && hasDel && disabledInit && enabledAfterCheck && ok5 && ok6 && ok7;

  console.log('\n===== 错误汇总 =====');
  console.log('  console errors:', consoleErrs.length);
  consoleErrs.slice(0, 20).forEach(e => console.log('    [console]', e));
  console.log('  page errors:', pageErrors.length);
  pageErrors.slice(0, 20).forEach(e => console.log('    [pageerror]', e));

  const pass = allOk && consoleErrs.length === 0 && pageErrors.length === 0;
  console.log('\n===== 汇总 =====');
  console.log(pass ? '✅ 全部通过' : '❌ 存在失败');
  await browser.close();
  if (!pass) process.exit(1);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
