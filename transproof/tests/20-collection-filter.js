const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

(async () => {
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrs = [], pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  // 预置 2 个集合 + 4 个术语（2 在 c1、1 在 c2、1 无集合）
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.setItem('tp.gloss', JSON.stringify({
      version: 2, sources: [], tags: [], rules: [], log: [],
      collections: [
        { id: 'c1', name: '精神现象学', source: 'scan', enabled: true },
        { id: 'c2', name: '逻辑学', source: 'scan', enabled: true }
      ],
      terms: [
        { id: 1, foreign: 'Aufhebung', zh: '扬弃', type: '概念', collections: ['c1'], status: 'confirmed' },
        { id: 2, foreign: 'Hegel', zh: '黑格尔', type: '人物', collections: ['c1'], status: 'confirmed' },
        { id: 3, foreign: 'Sein', zh: '存在', type: '概念', collections: ['c2'], status: 'confirmed' },
        { id: 4, foreign: 'Dasein', zh: '此在', type: '概念', collections: [], status: 'pending' }
      ]
    }));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.click('nav button[data-page="p-gloss"]');
  await page.waitForTimeout(300);

  console.log('===== 集合筛选（UI 优化）=====');

  // 1) 集合下拉存在，且有 2 个集合选项
  const sel = await page.evaluate(() => {
    const el = document.getElementById('g-f-col');
    if (!el) return null;
    return { exists: true, options: [...el.options].map(o => o.value).filter(v => v) };
  });
  const ok1 = sel && sel.exists && sel.options.length === 2;
  console.log('  ' + (ok1 ? '✅' : '❌') + ' 集合筛选下拉存在且含 2 个集合 ' + (sel ? JSON.stringify(sel.options) : 'null'));

  const count = () => page.evaluate(() => document.getElementById('g-count').textContent);

  // 2) 默认全部 → 4 条
  console.log('  默认计数=' + await count());

  // 3) 选 c1 → 只显示 2 条（Aufhebung / Hegel）
  await page.selectOption('#g-f-col', 'c1');
  await page.waitForTimeout(200);
  const c1 = await page.evaluate(() => ({
    count: document.getElementById('g-count').textContent,
    body: document.getElementById('g-tbody').textContent,
  }));
  const ok3 = c1.count.startsWith('2 /') && c1.body.includes('Aufhebung') && c1.body.includes('Hegel') && !c1.body.includes('Sein') && !c1.body.includes('Dasein');
  console.log('  ' + (ok3 ? '✅' : '❌') + ' 选 c1 只显示 2 条（Aufhebung/Hegel） count=' + c1.count);

  // 4) 选 c2 → 只显示 1 条（Sein）
  await page.selectOption('#g-f-col', 'c2');
  await page.waitForTimeout(200);
  const c2 = await page.evaluate(() => ({
    count: document.getElementById('g-count').textContent,
    body: document.getElementById('g-tbody').textContent,
  }));
  const ok4 = c2.count.startsWith('1 /') && c2.body.includes('Sein') && !c2.body.includes('Aufhebung');
  console.log('  ' + (ok4 ? '✅' : '❌') + ' 选 c2 只显示 1 条（Sein） count=' + c2.count);

  // 5) 重置 → 4 条
  await page.click('#g-f-reset');
  await page.waitForTimeout(200);
  const afterReset = await count();
  const ok5 = afterReset.startsWith('4 /');
  console.log('  ' + (ok5 ? '✅' : '❌') + ' 重置后恢复 4 条 count=' + afterReset);

  const allOk = ok1 && ok3 && ok4 && ok5;

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
