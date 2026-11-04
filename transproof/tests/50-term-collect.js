const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let pass = 0, fail = 0;
const consoleErrs = [], pageErrors = [];
function T(name, ok){ if(ok){ pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } }

(async () => {
  console.log('===== v4.42.0 一边译一边填术语表（term collect）=====');
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => { if(m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const boot = await page.evaluate(() => ({
    fn: typeof window.tsCollectTerms === 'function',
    termChk: !!document.querySelector('#ts-c-term'),
    termChecked: (function(){ const e = document.querySelector('#ts-c-term'); return e ? e.checked : null; })(),
    nounChk: (function(){ const e = document.querySelector('#ts-c-noun'); return e ? e.checked : null; })(),
    btnPnoun: !!document.querySelector('#btn-pnoun'),
    aoPnoun: !!document.querySelector('#ao-pnoun'),
    appv: (function(){ try { return APP_VERSION; } catch(e){ return null; } })()
  }));
  T('tsCollectTerms 已导出', boot.fn);
  T('#ts-c-term 勾选框在', boot.termChk);
  T('#ts-c-term 默认不勾选（按企划）', boot.termChecked === false);
  T('#ts-c-noun 默认勾选（旧锚点未动）', boot.nounChk === true);
  T('旧锚点 #btn-pnoun 未动', boot.btnPnoun);
  T('旧锚点 #ao-pnoun 未动', boot.aoPnoun);
  T('APP_VERSION 为三段式', typeof boot.appv === 'string' && boot.appv.split('.').length === 3);

  const guard = await page.evaluate(async () => { return await tsCollectTerms(''); });
  T('空输入返回 null（不炸）', guard === null);

  if(pageErrors.length){ console.log('  pageErrors: ' + pageErrors.slice(0, 5).join(' | ')); }
  if(consoleErrs.length){ console.log('  consoleErrs: ' + consoleErrs.slice(0, 5).join(' | ')); }
  T('无页面错误', pageErrors.length === 0 && consoleErrs.length === 0);
  await browser.close();
  console.log('通过: ' + pass + ' 失败: ' + fail);
  process.exit(fail ? 1 : 0);
})();
