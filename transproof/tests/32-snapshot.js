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
    snapAdd: typeof window.snapAdd,
    snapRestore: typeof window.snapRestore,
    snapOpen: typeof window.snapOpen,
    snapAll: typeof window.snapAll,
    appv: (typeof APP_VERSION !== 'undefined') ? APP_VERSION : null,
    hasBtnSnap: !!document.querySelector('#btn-snap'),
    hasBtnMd: !!document.querySelector('#btn-md'),
    hasBtnCopy: !!document.querySelector('#btn-copy')
  }));
  T('snapAdd 导出', api.snapAdd === 'function');
  T('snapRestore 导出', api.snapRestore === 'function');
  T('snapOpen 导出', api.snapOpen === 'function');
  T('snapAll 导出', api.snapAll === 'function');
  T('APP_VERSION 三段式', typeof api.appv === 'string' && api.appv.split('.').length === 3);
  T('#btn-snap 存在', api.hasBtnSnap);
  T('旧锚点 #btn-md 未动', api.hasBtnMd);
  T('旧锚点 #btn-copy 未动', api.hasBtnCopy);
  // 快照核心
  const core = await page.evaluate(async () => {
    localStorage.removeItem('tp.snapshot');
    const empty = window.snapAll().length;
    const a = window.snapAdd('export-md', '定稿内容A');
    const b = window.snapAdd('copy', '定稿内容B');
    const all = window.snapAll();
    // 回填
    LAST_OUT = '旧结果';
    const ok = window.snapRestore(a.rev);
    const outTxt = document.querySelector('#out').textContent;
    return {
      empty: empty,
      aRev: a.rev, aParent: a.parent, aType: a.type, aPayload: a.payload,
      bRev: b.rev, bParent: b.parent,
      len: all.length,
      restoreOk: ok,
      lastOut: LAST_OUT,
      outHasA: outTxt.indexOf('定稿内容A') >= 0
    };
  });
  T('初始空快照', core.empty === 0);
  T('快照1 rev=1 parent=0', core.aRev === 1 && core.aParent === 0);
  T('快照1 type/payload', core.aType === 'export-md' && core.aPayload === '定稿内容A');
  T('快照2 rev=2 parent=1', core.bRev === 2 && core.bParent === 1);
  T('快照列表 2 条', core.len === 2);
  T('回填返回 true', core.restoreOk === true);
  T('回填 LAST_OUT 恢复', core.lastOut === '定稿内容A');
  T('回填 #out 重渲', core.outHasA);
  // 挂点：点复制结果按钮，自动留痕
  const hook = await page.evaluate(async () => {
    localStorage.removeItem('tp.snapshot');
    LAST_OUT = '挂点测试内容';
    document.querySelector('#btn-copy').click();
    await new Promise(r => setTimeout(r, 400));
    const all = window.snapAll();
    const hit = all.filter(s => s.type === 'copy' && s.payload === '挂点测试内容');
    return { len: all.length, hit: hit.length };
  });
  T('点复制自动留痕', hook.hit >= 1);
  T('无页面错误', pageErrors.length === 0);
  if(pageErrors.length) console.log('  pageErrors:', pageErrors.slice(0,3));
  await browser.close();
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('EXC', e); process.exit(1); });
