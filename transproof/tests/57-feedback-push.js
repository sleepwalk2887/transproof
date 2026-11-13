const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let pass = 0, fail = 0;
function T(name, ok){ if(ok){ pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } }
(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('http://127.0.0.1:8123/index.html');
  await page.waitForTimeout(1000);

  const api = await page.evaluate(() => ({
    gate: typeof window.fbAutoGate,
    report: typeof window.fbAutoReport,
    post: typeof window.fbPost,
    appv: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : null),
    hasBtnPnoun: !!document.querySelector('#btn-pnoun'),
    hasAoPnoun: !!document.querySelector('#ao-pnoun'),
    hasBtnFb: !!document.querySelector('#btn-fb')
  }));
  T('fbAutoGate 导出', api.gate === 'function');
  T('fbAutoReport 导出', api.report === 'function');
  T('fbPost 导出', api.post === 'function');
  T('APP_VERSION 三段式', typeof api.appv === 'string' && api.appv.split('.').length === 3);
  T('旧锚点 #btn-pnoun 未动', api.hasBtnPnoun);
  T('旧锚点 #ao-pnoun 未动', api.hasAoPnoun);
  T('#btn-fb 在', api.hasBtnFb);

  const g = await page.evaluate(() => {
    localStorage.removeItem('tp.fb.autosig');
    localStorage.removeItem('tp.fb.autots');
    const out = {};
    out.first = window.fbAutoGate('sig-a');
    out.dup = window.fbAutoGate('sig-a');
    let i, hits = 0;
    for (i = 0; i < 9; i++) { if (window.fbAutoGate('s' + i)) hits++; }
    out.hits9 = hits;
    out.eleventh = window.fbAutoGate('s-overflow');
    localStorage.removeItem('tp.fb.autosig');
    localStorage.removeItem('tp.fb.autots');
    out.reset = window.fbAutoGate('sig-after-reset');
    return out;
  });
  T('首次放行', g.first === true);
  T('同签名去重（第二次 false）', g.dup === false);
  T('9 条内放行（累计 10 条）', g.hits9 === 9);
  T('第 11 条限流', g.eleventh === false);
  T('清空后可重新上报', g.reset === true);

  const wl = await page.evaluate(async () => {
    const src = String(window.fbAutoReport);
    const bad = ['apiKey', 'CFG', 'GLOSS', 'TERMS'];
    const leaked = bad.filter(k => src.indexOf(k) >= 0);
    let captured = null;
    window.fetch = function(url, opt) {
      if (String(url).indexOf('/api/feedback/submit') >= 0) captured = JSON.parse(opt.body);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, id: 'FB-TEST' }) });
    };
    await window.fbPost({
      type: 'auto', desc: '测试错误', time: 'x', func: '其他',
      where: '自动捕获', contact: '', ver: '4.48.0', page: '翻译', path: '/',
      ua: 'ua', lastErr: 'err'
    });
    return {
      keys: captured ? Object.keys(captured).sort().join(',') : '',
      leaked: leaked,
      typeIsAuto: captured && captured.type === 'auto'
    };
  });
  T('fbAutoReport 源码无隐私字段（apiKey/CFG/GLOSS/TERMS）', wl.leaked.length === 0);
  T('请求体白名单字段', wl.keys === 'contact,desc,func,lastErr,page,path,time,type,ua,ver,where');
  T('type=auto 生效', wl.typeIsAuto === true);

  T('无页面错误', pageErrors.length === 0);
  await browser.close();
  console.log('===== 测试结果：通过 ' + pass + ' · 失败 ' + fail + ' =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试崩了:', e); process.exit(1); });
