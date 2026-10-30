const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let pass = 0, fail = 0;
const consoleErrs = [], pageErrors = [];
function T(name, ok){ if(ok){ pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } }

(async () => {
  console.log('===== v4.39.1 左下角版本显示（version tag）=====');
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => { if(m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // 1. 元素存在 + 文本 = v + APP_VERSION
  const info = await page.evaluate(() => ({
    tag: !!document.querySelector('#ver-tag'),
    txt: (document.querySelector('#ver-tag') || {}).textContent,
    appv: (function(){ try { return APP_VERSION; } catch(e){ return null; } })()
  }));
  T('#ver-tag 存在', info.tag);
  T('#ver-tag 文本 = v + APP_VERSION', info.txt === 'v' + info.appv);
  T('APP_VERSION 是 x.y.z 三段', !!info.appv && info.appv.split('.').length === 3);

  // 2. 位置：fixed，左下角
  const pos = await page.evaluate(() => {
    const el = document.querySelector('#ver-tag');
    if(!el) return null;
    const cs = getComputedStyle(el);
    return { position: cs.position, left: cs.left, bottom: cs.bottom };
  });
  T('版本标签 position:fixed 左下角', pos && pos.position === 'fixed' && pos.left === '12px' && pos.bottom === '8px');

  // 3. 反馈按钮不受影响
  T('#btn-fb 反馈按钮仍在', await page.evaluate(() => !!document.querySelector('#btn-fb')));

  if(pageErrors.length){ console.log('  pageErrors: ' + pageErrors.slice(0, 5).join(' | ')); }
  if(consoleErrs.length){ console.log('  consoleErrs: ' + consoleErrs.slice(0, 5).join(' | ')); }
  T('无页面错误', pageErrors.length === 0 && consoleErrs.length === 0);
  await browser.close();
  console.log('通过: ' + pass + ' 失败: ' + fail);
  process.exit(fail ? 1 : 0);
})();
