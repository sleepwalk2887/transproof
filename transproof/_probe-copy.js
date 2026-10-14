/* 复制链路探针：md() 渲染态选中复制，剪贴板 HTML/plain 里换行是否存活 */
const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const path = require('path');

const SAMPLE = [
  '## 一、修订后译文', '',
  '黑格尔的《精神现象学》出版于1807年，标志着德国古典哲学的开端。',   // 行1
  '本书探讨了意识从感性确定性到绝对知识的发展过程。',               // 行2
  '第二段第一句，包含术语：精神（Geist）。',                          // 行3
  '第二段第二句，术语统一为「扬弃」。',                               // 行4
  '', '## 二、逐条批注', '',
  '1. 原文 Hegemony 译为「霸权主义」不准确，应译为「霸权」。',
  '2. 原文漏译最后半句 insofar as it。',
].join('\n');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true, args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e.message || e)));

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);

  // 注入渲染态结果（与主流程收尾一致：out.innerHTML = md(text)）
  await page.evaluate((sample) => {
    const out = document.querySelector('#out');
    out.innerHTML = md(sample);
  }, SAMPLE);

  // 选中整个输出区并真按 Ctrl+C
  await page.evaluate(() => {
    const out = document.querySelector('#out');
    const r = document.createRange();
    r.selectNodeContents(out);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  });
  await page.keyboard.press('Control+c');
  await page.waitForTimeout(300);

  const clip = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const res = { types: items.map(i => i.types) };
    for (const item of items) {
      if (item.types.includes('text/html')) res.html = await (await item.getType('text/html')).text();
      if (item.types.includes('text/plain')) res.text = await (await item.getType('text/plain')).text();
    }
    return res;
  });

  console.log('=== 剪贴板类型 ===', JSON.stringify(clip.types));
  console.log('=== text/plain（前300字，\\n 可见性）===');
  console.log(JSON.stringify((clip.text || '').slice(0, 300)));
  console.log('=== text/html（前900字）===');
  console.log((clip.html || '').slice(0, 900));
  const htmlN = (clip.html || '').match(/\n/g);
  const brCount = (clip.html || '').match(/<br/gi);
  const pCount = (clip.html || '').match(/<p/gi);
  console.log('=== 统计 ===');
  console.log('html 内 \\n 数:', htmlN ? htmlN.length : 0, '| <br> 数:', brCount ? brCount.length : 0, '| <p 数:', pCount ? pCount.length : 0);
  console.log('plain 内 \\n 数:', ((clip.text || '').match(/\n/g) || []).length);
  console.log('page errors:', pageErrors.length);
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
