const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

(async () => {
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrs = [], pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  // 预置一个争议术语到 tp.gloss
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.setItem('tp.gloss', JSON.stringify({
      version: 2, sources: [], tags: [], rules: [], log: [], collections: [],
      terms: [{
        id: 1, foreign: 'Aufhebung', zh: '扬弃', aliases: ['升华'], type: '概念',
        tags: ['哲学'], sources: [], occurrences: [], recommend: 'rec',
        status: 'confirmed', note: '', collections: []
      }]
    }));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);

  console.log('===== 争议术语联网查证（P2 #8）=====');

  // 1) 切到译词库页，术语行有「🔎」按钮
  await page.click('nav button[data-page="p-gloss"]');
  await page.waitForTimeout(300);
  const btnExists = await page.evaluate(() => !!document.querySelector('#g-tbody tr [data-lookup]'));
  console.log('  ' + (btnExists ? '✅' : '❌') + ' 术语行存在 🔎 查证按钮');

  // 2) 点击 🔎 → 弹窗打开 + 标题/术语正确
  // 3) 4 个搜索源按钮存在
  // 4) 点 scholar → window.open 被调用且 URL 正确
  const res = await page.evaluate(async () => {
    const opened = [];
    window.open = (url) => { opened.push(url); return null; };
    document.querySelector('#g-tbody tr [data-lookup]').click();
    await new Promise(r => setTimeout(r, 300));
    const title = document.getElementById('mTitle').textContent;
    const bodyText = document.getElementById('mBody').textContent;
    const lkButtons = [...document.querySelectorAll('#mBody [data-lk]')].map(b => b.dataset.lk);
    document.querySelector('#mBody [data-lk="scholar"]').click();
    return { opened, title, bodyText, lkButtons };
  });

  console.log('  title=' + res.title);
  const checks = {
    modalTitle: res.title.includes('术语查证'),
    showsTerm: res.bodyText.includes('Aufhebung') && res.bodyText.includes('扬弃'),
    hasScholar: res.lkButtons.includes('scholar'),
    hasBaidu: res.lkButtons.includes('baidu'),
    hasCnki: res.lkButtons.includes('cnki'),
    hasWiki: res.lkButtons.includes('wiki'),
    scholarOpened: res.opened.length === 1 && res.opened[0].includes('scholar.google.com'),
    urlHasTerm: res.opened.length === 1 && decodeURIComponent(res.opened[0]).includes('Aufhebung') && decodeURIComponent(res.opened[0]).includes('扬弃'),
  };
  for (const [k, v] of Object.entries(checks)) console.log('  ' + (v ? '✅' : '❌') + ' ' + k);

  const allOk = btnExists && Object.values(checks).every(Boolean);

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
