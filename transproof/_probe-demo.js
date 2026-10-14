// 效果演示卡探针：切换按钮 / 明暗主题 / 卡片位置
const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = process.argv[2] || 'http://127.0.0.1:8123/index.html';

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage();
  const pageErrors = [], consoleErrs = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);

  // 先切到帮助页签
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('nav button')].find(x => (x.getAttribute('onclick') || '').includes('p-help') || x.textContent.includes('指南'));
    if (b) b.click();
  });
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const help = document.getElementById('p-help');
    const cards = [...help.querySelectorAll(':scope > .wrap > .card')];
    const idx = cards.findIndex(c => c.querySelector('#dm-btn-a'));
    const before = document.getElementById('dm-before');
    const after = document.getElementById('dm-after');
    const pos = { cardIndex: idx, total: cards.length, title: idx >= 0 ? cards[idx].querySelector('h3').textContent : '' };
    // 初始
    const init = { before: before.style.display !== 'none', after: after.style.display === 'none',
                   btnAPri: document.getElementById('dm-btn-a').classList.contains('pri') };
    // 切到校对后
    tpDemo('b');
    const toB = { beforeHidden: before.style.display === 'none', afterShown: after.style.display !== 'none',
                  btnBPri: document.getElementById('dm-btn-b').classList.contains('pri'),
                  afterTextOk: after.textContent.includes('搁置') && after.textContent.includes('术语不一致') };
    // 切回
    tpDemo('a');
    const back = { beforeShown: before.style.display !== 'none', afterHidden: after.style.display === 'none' };
    const tags = after.querySelectorAll('.t-tag').length;
    return { pos, init, toB, back, tags, hasFn: typeof tpDemo === 'function' };
  });

  // 明暗主题各截一张（演示卡区域）
  await page.evaluate(() => tpDemo('b'));
  const card = await page.$('#p-help .card:has(#dm-btn-a)');
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
  await page.waitForTimeout(300);
  if (card) await card.screenshot({ path: 'C:/Users/Andrew/.dsh/dsh_orb/transproof/_demo-dark.png' });
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); });
  await page.waitForTimeout(300);
  if (card) await card.screenshot({ path: 'C:/Users/Andrew/.dsh/dsh_orb/transproof/_demo-light.png' });

  console.log(JSON.stringify({ ...r, pageErrors, consoleErrs }, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
