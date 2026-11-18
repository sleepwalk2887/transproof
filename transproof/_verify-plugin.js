const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', 'transproof-plugin', 'app');
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.gz':'application/gzip', '.ico':'image/x-icon' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if(p.endsWith('/')) p = path.join(p, 'index.html');
  fs.readFile(p, (err, data) => {
    if(err){ res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});
server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  let ok = true;
  const ck = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if(!cond) ok = false; };
  try {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto('http://127.0.0.1:' + port + '/index.html');
    await page.waitForTimeout(1000);
    const r = await page.evaluate(() => {
      const tabs = document.querySelectorAll('[data-page]').length;
      const ver = document.querySelector('#ver-tag');
      return { tabs, verText: ver ? ver.textContent.trim() : '', appv: (typeof APP_VERSION === 'string' ? APP_VERSION : '') };
    });
    await browser.close();
    ck('0 pageerror', errors.length === 0);
    ck('版本号可见（#ver-tag = v' + r.appv + '）', r.verText === 'v' + r.appv);
    ck('八页签存在（实际 ' + r.tabs + '）', r.tabs === 8);
  } catch(e){
    console.error('ERR ' + e.message);
    ok = false;
  }
  server.close();
  console.log(ok ? '冒烟通过' : '冒烟失败');
  process.exit(ok ? 0 : 1);
});
