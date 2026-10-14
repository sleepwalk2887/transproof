const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext()).newPage();
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof loadLib === 'function');
  const b64 = fs.readFileSync(path.join(__dirname, '_sample-note.pdf')).toString('base64');
  const items = await page.evaluate(async (b64) => {
    await loadLib('pdfjs', ['https://cdn.bootcdn.net/ajax/libs/pdf.js/3.11.174/pdf.min.js']);
    const lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = 'https://cdn.bootcdn.net/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const doc = await lib.getDocument({ data: bytes }).promise;
    const pg = await doc.getPage(1);
    const tc = await pg.getTextContent();
    return tc.items.filter(i => (i.transform[5] === 700)).map(i => ({ s: i.str, x: Math.round(i.transform[4]), y: i.transform[5], height: i.height, h0: Math.hypot(i.transform[2], i.transform[3]) }));
  }, b64);
  console.log(JSON.stringify(items, null, 1));
  const bodyH = await page.evaluate(() => {
    const objs = [{ h: 12, s: 'long line of body text ................' }, { h: 9, s: '1' }];
    return null;
  });
  await browser.close();
})();
