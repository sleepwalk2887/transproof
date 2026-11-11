const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let pass = 0, fail = 0;
const consoleErrs = [], pageErrors = [];
function T(name, ok){ if(ok){ pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } }

(async () => {
  console.log('===== v4.44.0 规范包导入（specpack）=====');
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => { if(m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const boot = await page.evaluate(() => ({
    fnBlock: typeof window.specBlockForSystem === 'function',
    fnAdd: typeof window.specAdd === 'function',
    fnRender: typeof window.renderSpecPanel === 'function',
    impText: !!document.querySelector('#sp-import-text'),
    impUrl: !!document.querySelector('#sp-import-url'),
    impFile: !!document.querySelector('#sp-import-file'),
    spList: !!document.querySelector('#sp-list'),
    prefs: !!document.querySelector('#prefs'),
    prefSave: !!document.querySelector('#btn-pref-save'),
    btnPnoun: !!document.querySelector('#btn-pnoun'),
    appv: (function(){ try { return APP_VERSION; } catch(e){ return null; } })()
  }));
  T('specBlockForSystem 已导出', boot.fnBlock);
  T('specAdd 已导出', boot.fnAdd);
  T('renderSpecPanel 已导出', boot.fnRender);
  T('#sp-import-text 在', boot.impText);
  T('#sp-import-url 在', boot.impUrl);
  T('#sp-import-file 在', boot.impFile);
  T('#sp-list 在', boot.spList);
  T('旧锚点 #prefs 未动', boot.prefs);
  T('旧锚点 #btn-pref-save 未动', boot.prefSave);
  T('旧锚点 #btn-pnoun 未动', boot.btnPnoun);
  T('APP_VERSION 为三段式', typeof boot.appv === 'string' && boot.appv.split('.').length === 3);

  const r = await page.evaluate(() => {
    const empty = specBlockForSystem();
    const ok = specAdd('测试规范包', 'paste', '', '所有引文统一使用中文书名号');
    const block = specBlockForSystem();
    const stored = JSON.parse(localStorage.getItem('tp.specpack') || 'null');
    return {
      empty, ok, block,
      storedVer: stored && stored.version,
      storedLen: stored && stored.packs ? stored.packs.length : -1,
      storedName: stored && stored.packs && stored.packs[0] ? stored.packs[0].name : null,
      storedEnabled: stored && stored.packs && stored.packs[0] ? stored.packs[0].enabled : null
    };
  });
  T('空时 specBlockForSystem 返回空串', r.empty === '');
  T('specAdd 返回 true', r.ok === true);
  T('注入块含来源名', r.block.indexOf('测试规范包') >= 0);
  T('注入块含规范内容', r.block.indexOf('所有引文统一使用中文书名号') >= 0);
  T('tp.specpack version=1', r.storedVer === 1);
  T('tp.specpack packs 长度 1', r.storedLen === 1);
  T('包名正确', r.storedName === '测试规范包');
  T('默认启用', r.storedEnabled === true);

  if(pageErrors.length){ console.log('  pageErrors: ' + pageErrors.slice(0, 5).join(' | ')); }
  if(consoleErrs.length){ console.log('  consoleErrs: ' + consoleErrs.slice(0, 5).join(' | ')); }
  T('无页面错误', pageErrors.length === 0 && consoleErrs.length === 0);
  await browser.close();
  console.log('通过: ' + pass + ' 失败: ' + fail);
  process.exit(fail ? 1 : 0);
})();
