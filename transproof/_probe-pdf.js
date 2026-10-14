// 复现用户「解析失败」：文字型 PDF + 扫描件 OCR 路径，捕获失败的具体网络请求
const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const path = require('path');
const PDF_TEXT = path.resolve(__dirname, '_sample.pdf');
const PDF_SCAN = path.resolve(__dirname, '_sample-scan.pdf');

async function feed(page, file, tag, waitMs) {
  await page.evaluate(() => {
    window.__toasts = [];
    if (!window.__toastHooked) {
      window.__toastHooked = 1;
      const orig = window.toast;
      window.toast = function (msg, type) { window.__toasts.push((type || 'i') + '|' + msg); return orig.apply(this, arguments); };
    } else { window.__toasts = []; }
  });
  await page.setInputFiles('#srcFile', file);
  let toast = null;
  const t0 = Date.now();
  while (Date.now() - t0 < waitMs) {
    await page.waitForTimeout(1000);
    const t = await page.evaluate(() => window.__toasts.slice());
    if (t.length) { toast = t; break; }
    if ((Date.now() - t0) % 5000 < 1100) {
      const bar = await page.evaluate(() => { const b = document.querySelector('#srcFileBar'); return b ? b.textContent : null; });
      console.log('  [' + tag + '] +' + Math.round((Date.now() - t0) / 1000) + 's bar:', JSON.stringify(bar));
    }
  }
  console.log('  [' + tag + '] toasts:', JSON.stringify(toast || '(等待中/无)'));
  const bar = await page.evaluate(() => { const b = document.querySelector('#srcFileBar'); return b ? b.textContent : null; });
  console.log('  [' + tag + '] fileBar:', JSON.stringify(bar));
}

(async () => {
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrs = [], pageErrors = [], netFail = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('requestfailed', r => netFail.push(r.url() + '  ==> ' + (r.failure() ? r.failure().errorText : '?')));

  console.log('===== 扫描件 PDF（无文字层 → OCR 路径）=====');
  await page.goto('https://transproof.pages.dev/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  console.log('  version:', await page.evaluate(() => window.TransProof.version));
  await feed(page, PDF_SCAN, 'scan', 330000);

  console.log('\n  --- 网络失败请求 ---');
  [...new Set(netFail)].forEach(u => console.log('    ' + u));
  console.log('  --- console errors ---');
  consoleErrs.slice(0, 30).forEach(e => console.log('    [console]', e));
  console.log('  --- page errors ---');
  pageErrors.slice(0, 10).forEach(e => console.log('    [pageerror]', e));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
