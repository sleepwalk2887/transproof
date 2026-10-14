// 28-splash.js — 3 秒开屏动画：存在/穿透/自定义/按时移除/关闭不加载
const path = require('path');
const { chromium } = require(path.join('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core'));
const EXE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://127.0.0.1:8123/index.html';

let pass = 0, fail = 0;
async function T(name, fn) {
  try { await fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + ' → ' + (e && e.message)); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });

  console.log('===== 28 开屏动画 =====');

  // 场景 A：默认配置 —— 开屏存在、纯视觉、3 秒后出 DOM
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  let splash = await page.evaluate(() => {
    const el = document.querySelector('#tp-splash');
    if (!el) return { exists: false };
    const cs = getComputedStyle(el);
    return {
      exists: true,
      pe: cs.pointerEvents,
      hi: (el.querySelector('.sp-hi') || {}).textContent || '',
      slogan: (el.querySelector('.sp-slogan') || {}).textContent || '',
      meta: (el.querySelector('.sp-meta') || {}).textContent || '',
      deco: (el.querySelector('.sp-deco') || {}).textContent || '',
    };
  });

  await T('开屏层在加载后立即存在', async () => { if (!splash.exists) throw new Error('无 #tp-splash'); });
  await T('pointer-events:none（点击可穿透，不挡任何功能）', async () => { if (splash.pe !== 'none') throw new Error('pe=' + splash.pe); });
  await T('含时段问候语', async () => { if (!/^(早上好|中午好|下午好|晚上好|夜深了)/.test(splash.hi)) throw new Error('hi=' + JSON.stringify(splash.hi)); });
  await T('默认标语「译校有我，落笔无忧」', async () => { if (!splash.slogan.includes('译校有我')) throw new Error('slogan=' + splash.slogan); });
  await T('带版本号', async () => { if (!/v\d+\.\d+\.\d+/.test(splash.meta)) throw new Error('meta=' + splash.meta); });

  await T('开屏期间点击照常生效（穿透测试）', async () => {
    await page.click('nav button:nth-child(2)', { timeout: 3000 }); // 切页签
    const active = await page.evaluate(() => document.querySelector('nav button.on') ? true : false);
    if (!active) throw new Error('点击未生效');
  });

  await T('3.3 秒后开屏从 DOM 移除', async () => {
    await page.waitForFunction(() => !document.querySelector('#tp-splash'), null, { timeout: 6000 });
  });

  // 场景 B：自定义标语 + 装饰 + 关闭
  await page.addInitScript(() => {
    localStorage.setItem('tp.splash', JSON.stringify({ on: true, slogan: '自定义标语 ABC', deco: 'd4' }));
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  splash = await page.evaluate(() => {
    const el = document.querySelector('#tp-splash');
    if (!el) return { exists: false };
    return { exists: true, slogan: el.querySelector('.sp-slogan').textContent, deco: el.querySelector('.sp-deco').textContent };
  });
  await T('自定义标语生效', async () => { if (!splash.exists || !splash.slogan.includes('自定义标语 ABC')) throw new Error(JSON.stringify(splash)); });
  await T('自定义装饰符号生效（d4 花括号）', async () => { if (!splash.deco.includes('〔')) throw new Error('deco=' + splash.deco); });

  await page.waitForFunction(() => !document.querySelector('#tp-splash'), null, { timeout: 6000 });

  await page.addInitScript(() => {
    localStorage.setItem('tp.splash', JSON.stringify({ on: false, slogan: '', deco: 'd1' }));
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  splash = await page.evaluate(() => ({ exists: !!document.querySelector('#tp-splash') }));
  await T('关闭后完全不加载', async () => { if (splash.exists) throw new Error('开关关闭仍显示'); });

  await T('全程 0 console/page error', async () => { if (errors.length) throw new Error(errors.join(' | ')); });

  await browser.close();
  console.log('===== 结果: PASS=' + pass + ' FAIL=' + fail + ' =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
