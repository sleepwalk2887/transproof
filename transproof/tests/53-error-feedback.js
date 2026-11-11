const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let pass = 0, fail = 0;
const consoleErrs = [], pageErrors = [];
function T(name, ok){ if(ok){ pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } }

(async () => {
  console.log('===== v4.45.0 错误回流（error-feedback）=====');
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => { if(m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const boot = await page.evaluate(() => ({
    fnTerm: typeof window.efPromoteTerm === 'function',
    fnBan: typeof window.efPromoteBan === 'function',
    fnStyle: typeof window.efPromoteStyle === 'function',
    btnPnoun: !!document.querySelector('#btn-pnoun'),
    aoPnoun: !!document.querySelector('#ao-pnoun'),
    prefs: !!document.querySelector('#prefs'),
    appv: (function(){ try { return APP_VERSION; } catch(e){ return null; } })()
  }));
  T('efPromoteTerm 已导出', boot.fnTerm);
  T('efPromoteBan 已导出', boot.fnBan);
  T('efPromoteStyle 已导出', boot.fnStyle);
  T('旧锚点 #btn-pnoun 未动', boot.btnPnoun);
  T('旧锚点 #ao-pnoun 未动', boot.aoPnoun);
  T('旧锚点 #prefs 未动', boot.prefs);
  T('APP_VERSION 为三段式', typeof boot.appv === 'string' && boot.appv.split('.').length === 3);

  const r = await page.evaluate(() => {
    document.querySelector('#c-term').checked = true;
    const t1 = efPromoteTerm({ type:'误译', frag:'测试误译A', fix:'测试正确A', reason:'测试理由A' });
    const t1b = GLOSS.terms.find(t => t.foreign === '测试误译A');
    const t2 = efPromoteBan({ type:'中式英语', frag:'测试禁用B', fix:'测试正确B', reason:'' });
    const t2b = GLOSS.terms.find(t => t.foreign === '测试禁用B');
    const t3 = efPromoteStyle({ type:'语体不当', frag:'', fix:'', reason:'测试文风规则C' });
    const sys = buildSystem();
    return {
      t1, t2, t3,
      t1ok: !!(t1b && t1b.zh === '测试正确A' && t1b.status === 'confirmed' && t1b.recommend === 'rec'),
      t2ok: !!(t2b && t2b.status === 'rejected' && t2b.recommend === 'ban'),
      t3ok: (t3 === true && PREFS.indexOf('测试文风规则C') >= 0),
      sysTerm: sys.indexOf('测试误译A') >= 0,
      sysBan: sys.indexOf('禁用译法') >= 0 && sys.indexOf('测试禁用B') >= 0,
      sysStyle: sys.indexOf('测试文风规则C') >= 0,
      tagT1: !!(t1b && (t1b.tags || []).indexOf('错误回流') >= 0)
    };
  });
  T('efPromoteTerm 返回 true', r.t1 === true);
  T('升为术语：词库有 confirmed+rec 项、zh 正确', r.t1ok);
  T('升为术语：打上「错误回流」标签', r.tagT1);
  T('efPromoteBan 返回 true', r.t2 === true);
  T('升为禁用：词库有 rejected+ban 项', r.t2ok);
  T('efPromoteStyle 返回 true 且 PREFS 含规则', r.t3ok);
  T('buildSystem 含升为术语的译法', r.sysTerm);
  T('buildSystem 含禁用译法段', r.sysBan);
  T('buildSystem 含文风规则', r.sysStyle);

  const dom = await page.evaluate(() => {
    const out = document.querySelector('#out');
    out.innerHTML = '<ul><li data-err="误译">[误译] **测试误译A**→ 改为「测试正确A」：测试理由A</li></ul>';
    markErrorLines();
    renderAuditControls();
    const promo = out.querySelector('.ef-promote');
    const btns = promo ? promo.querySelectorAll('button.ef-p') : [];
    return { has: !!promo, n: btns.length };
  });
  T('批注卡出现 .ef-promote 容器', dom.has);
  T('批注卡有 3 个回流按钮', dom.n === 3);
  T('无页面错误', pageErrors.length === 0 && consoleErrs.length === 0);

  await browser.close();
  console.log('===== ' + pass + ' 通过 / ' + fail + ' 失败 =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('EXC', e); process.exit(1); });