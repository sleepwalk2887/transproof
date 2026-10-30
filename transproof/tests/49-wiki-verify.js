const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let pass = 0, fail = 0;
const consoleErrs = [], pageErrors = [];
function T(name, ok){ if(ok){ pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } }

(async () => {
  console.log('===== v4.41.0 专名百科自动查证（wiki verify）=====');
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => { if(m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // 1. 函数与结构存在
  const boot = await page.evaluate(() => ({
    fn1: typeof window.gvWikiLookup === 'function',
    fn2: typeof window.wikiCleanTitle === 'function',
    gvList: !!document.querySelector('#gv-list'),
    btnPnoun: !!document.querySelector('#btn-pnoun'),
    aoPnoun: !!document.querySelector('#ao-pnoun'),
    appv: (function(){ try { return APP_VERSION; } catch(e){ return null; } })()
  }));
  T('gvWikiLookup 已导出', boot.fn1);
  T('wikiCleanTitle 已导出', boot.fn2);
  T('#gv-list 面板容器在', boot.gvList);
  T('旧锚点 #btn-pnoun 未动', boot.btnPnoun);
  T('旧锚点 #ao-pnoun 未动', boot.aoPnoun);
  T('APP_VERSION = 4.41.0', boot.appv === '4.41.0');

  // 2. 标题清洗（去掉维基括号尾巴）
  const clean = await page.evaluate(() => ({
    a: wikiCleanTitle('让-雅克·卢梭（Jean-Jacques Rousseau）'),
    b: wikiCleanTitle('Immanuel Kant'),
    c: wikiCleanTitle('法国大革命 (1789)')
  }));
  T('中文括号尾巴被去掉', clean.a === '让-雅克·卢梭');
  T('无括号不变', clean.b === 'Immanuel Kant');
  T('英文括号尾巴被去掉', clean.c === '法国大革命');

  // 3. 专名核验行出现「🔎 查维基」按钮（注入 pending 词条再渲染）
  const rowBtn = await page.evaluate(() => {
    const t = { id: 999001, zh: '康德', foreign: 'Immanuel Kant', aliases: [], type: '人物', tags: [], status: 'pending', recommend: '', note: '', sources: [], occurrences: [], collections: [], url: '', created: Date.now(), updated: Date.now() };
    GLOSS.terms.push(t);
    renderGvPanel();
    const btn = document.querySelector('[data-gv-wiki="999001"]');
    const ok = !!btn;
    GLOSS.terms = GLOSS.terms.filter(x => x.id !== 999001);
    renderGvPanel();
    return ok;
  });
  T('专名核验行有「🔎 查维基」按钮', rowBtn);

  // 4. buildSystem 注入已批准专名的背景简介
  const briefHit = await page.evaluate(() => {
    const t = { id: 999002, zh: '康德', foreign: 'Immanuel Kant', aliases: [], type: '人物', tags: [], status: 'confirmed', recommend: 'rec', note: '', sources: [], occurrences: [], collections: [], url: 'https://zh.wikipedia.org/wiki/伊曼努尔·康德', brief: '伊曼努尔·康德是德国启蒙哲学家。', created: Date.now(), updated: Date.now() };
    GLOSS.terms.push(t);
    let sys = '';
    try { sys = buildSystem(); } catch(e){ sys = 'ERR:' + e.message; }
    const hit = sys.indexOf('德国启蒙哲学家') >= 0;
    GLOSS.terms = GLOSS.terms.filter(x => x.id !== 999002);
    return { hit, sample: sys.slice(0, 60) };
  });
  T('提示词带已批准专名背景简介', briefHit.hit);

  if(pageErrors.length){ console.log('  pageErrors: ' + pageErrors.slice(0, 5).join(' | ')); }
  if(consoleErrs.length){ console.log('  consoleErrs: ' + consoleErrs.slice(0, 5).join(' | ')); }
  T('无页面错误', pageErrors.length === 0 && consoleErrs.length === 0);
  await browser.close();
  console.log('通过: ' + pass + ' 失败: ' + fail);
  process.exit(fail ? 1 : 0);
})();
