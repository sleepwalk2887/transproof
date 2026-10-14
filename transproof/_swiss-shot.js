const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrs = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => consoleErrs.push('PAGEERROR: ' + e.message));

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const setTheme = (t) => page.evaluate((tt) => { document.documentElement.dataset.theme = tt; }, t);
  const shot = (path) => page.screenshot({ path, fullPage: false });

  // 1. 校对工作台 · 亮色
  await setTheme('light');
  await page.waitForTimeout(400);
  await shot('C:/Users/Andrew/.dsh/dsh_orb/transproof/_nasa-work-light.png');
  console.log('1 校对台亮色 done');

  // 2. 校对工作台 · 暗色
  await setTheme('dark');
  await page.waitForTimeout(400);
  await shot('C:/Users/Andrew/.dsh/dsh_orb/transproof/_nasa-work-dark.png');
  console.log('2 校对台暗色 done');

  // 3. 术语库 · 亮色（验证铆钉/斜纹铺开）
  await setTheme('light');
  await page.click('nav button[data-page="p-gloss"]');
  await page.waitForTimeout(600);
  await shot('C:/Users/Andrew/.dsh/dsh_orb/transproof/_nasa-gloss-light.png');
  console.log('3 术语库亮色 done');

  // 4. 翻译工作台 · 亮色（验证配色/字体铺开）
  await page.click('nav button[data-page="p-trans"]');
  await page.waitForTimeout(600);
  await shot('C:/Users/Andrew/.dsh/dsh_orb/transproof/_nasa-trans-light.png');
  console.log('4 翻译台亮色 done');

  console.log('console errors:', consoleErrs.length);
  consoleErrs.slice(0, 20).forEach(e => console.log('  ', e));
  await browser.close();
  console.log('done');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
