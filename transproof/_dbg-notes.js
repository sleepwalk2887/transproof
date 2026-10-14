const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', e => console.log('PAGEERR', String(e.message || e)));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.TransProof && typeof TransProof.parseFile === 'function');
  const b64 = fs.readFileSync(path.join(__dirname, '_sample-note.pdf')).toString('base64');
  const r = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const file = new File([bytes], 'n.pdf', { type: 'application/pdf' });
    const data = await TransProof.parseFile(file);
    return { fullText: data.fullText, chapters: data.chapters.map(c => ({ t: c.title, n: c.text.split('\n').length })) };
  }, b64);
  console.log('--- fullText lines ---');
  r.fullText.split('\n').forEach((l, i) => console.log('[' + i + '] ' + JSON.stringify(l)));
  console.log('chapters:', JSON.stringify(r.chapters));
  await browser.close();
})();
