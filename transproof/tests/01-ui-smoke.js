const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

(async () => {
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const SHOT = 'C:/Users/Andrew/.dsh/dsh_orb/transproof/_verify.png';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrs = [], pageErrors = [], failed = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('requestfailed', r => failed.push(r.url() + ' :: ' + (r.failure() ? r.failure().errorText : '')));

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  console.log('========== 1. 基础信息 ==========');
  const base = await page.evaluate(() => ({
    title: document.title,
    version: window.TransProof ? window.TransProof.version : null,
    transProofKeys: window.TransProof ? Object.keys(window.TransProof) : [],
    hasTP_CONFIG: !!window.TP_CONFIG,
  }));
  console.log(JSON.stringify(base, null, 2));

  console.log('\n========== 2. 七个页签逐个点击 ==========');
  const tabs = ['p-work', 'p-trans', 'p-term', 'p-gloss', 'p-prompt', 'p-set', 'p-help'];
  for (const t of tabs) {
    await page.click(`nav button[data-page="${t}"]`);
    await page.waitForTimeout(250);
    const visible = await page.evaluate((id) => {
      const sec = document.getElementById(id);
      return sec ? getComputedStyle(sec).display !== 'none' : false;
    }, t);
    console.log(`  [${t}] 显示=${visible}`);
  }

  console.log('\n========== 3. 校对工作台元素 ==========');
  await page.click('nav button[data-page="p-work"]');
  await page.waitForTimeout(300);
  const els = await page.evaluate(() => {
    const ids = ['src','dst','extra','out','btn-run','btn-stop','decision-panel','dp-apply','dp-tolib',
      'apiKey','baseUrl','timeout','c-ask','c-deai','c-ext','c-format','c-note','c-term','c-docmode'];
    const r = {};
    for (const id of ids) r[id] = !!document.getElementById(id);
    return r;
  });
  console.log(JSON.stringify(els, null, 2));

  console.log('\n========== 4. 翻译工作台元素 ==========');
  await page.click('nav button[data-page="p-trans"]');
  await page.waitForTimeout(300);
  const tels = await page.evaluate(() => {
    const ids = ['ts-src','ts-prompt','ts-lang','ts-len','ts-mode','ts-term','ts-notes',
      'ts-btn-run','ts-btn-stop','ts-out','ts-btn-sendproof','ts-btn-docout','ts-btn-export-md','ts-btn-notes'];
    const r = {};
    for (const id of ids) r[id] = !!document.getElementById(id);
    return r;
  });
  console.log(JSON.stringify(tels, null, 2));

  console.log('\n========== 5. 术语库 / 词库 / Prompt 库 / 设置元素 ==========');
  for (const t of ['p-term','p-gloss','p-prompt','p-set']) {
    await page.click(`nav button[data-page="${t}"]`);
    await page.waitForTimeout(250);
    const info = await page.evaluate((id) => {
      const sec = document.getElementById(id);
      const btns = sec ? sec.querySelectorAll('button').length : 0;
      const inputs = sec ? sec.querySelectorAll('input,select,textarea').length : 0;
      return { btns, inputs };
    }, t);
    console.log(`  [${t}] 按钮=${info.btns} 输入控件=${info.inputs}`);
  }

  console.log('\n========== 6. 错误汇总 ==========');
  console.log('  console errors:', consoleErrs.length);
  consoleErrs.slice(0, 20).forEach(e => console.log('    [console]', e));
  console.log('  page errors:', pageErrors.length);
  pageErrors.slice(0, 20).forEach(e => console.log('    [pageerror]', e));
  console.log('  request failed:', failed.length);
  failed.slice(0, 10).forEach(e => console.log('    [reqfail]', e));

  await page.click('nav button[data-page="p-work"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOT, fullPage: true });
  console.log('\n截图已保存:', SHOT);

  await browser.close();
  console.log('浏览器已关闭');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
