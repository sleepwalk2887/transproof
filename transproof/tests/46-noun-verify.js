const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let pass = 0, fail = 0;
const consoleErrs = [], pageErrors = [];
function T(name, ok){ if(ok){ pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } }

(async () => {
  console.log('===== T-022 专名核验 + 术语表回填（noun verify）=====');
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => { if(m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // 1. 函数导出
  const fns = await page.evaluate(() => ({
    unify: typeof window.gvUnifyInText === 'function',
    collect: typeof window.tsCollectNouns === 'function',
    panel: typeof window.renderGvPanel === 'function'
  }));
  T('window.gvUnifyInText 已定义', fns.unify);
  T('window.tsCollectNouns 已定义', fns.collect);
  T('window.renderGvPanel 已定义', fns.panel);

  // 2. DOM 锚点
  const dom = await page.evaluate(() => ({
    cNoun: !!document.querySelector('#ts-c-noun'),
    cNounChecked: !!(document.querySelector('#ts-c-noun') || {}).checked,
    gvCard: !!document.querySelector('#gv-card'),
    batch: !!document.querySelector('#btn-gv-batch'),
    unifyBtn: !!document.querySelector('#btn-gv-unify'),
    list: !!document.querySelector('#gv-list'),
    pnoun: !!document.querySelector('#btn-pnoun'),
    aoPnoun: !!document.querySelector('#ao-pnoun'),
    script: !!Array.from(document.querySelectorAll('script')).find(s => s.src.indexOf('14-noun-verify.js') >= 0)
  }));
  T('#ts-c-noun 存在且默认勾选', dom.cNoun && dom.cNounChecked);
  T('#gv-card/#btn-gv-batch/#btn-gv-unify/#gv-list 存在', dom.gvCard && dom.batch && dom.unifyBtn && dom.list);
  T('旧锚点 #btn-pnoun / #ao-pnoun 未动', dom.pnoun && dom.aoPnoun);
  T('script js/14-noun-verify.js 已加载', dom.script);

  // 3. gvUnifyInText 别名统一
  const u1 = await page.evaluate(() => window.gvUnifyInText('卢梭（Jean-Jacques Rousseau）说过，卢梭（Jean-Jacques Rousseau）又说了。', [{ foreign: 'Jean-Jacques Rousseau', zh: '让-雅克·卢梭', aliases: ['卢梭'] }]));
  T('别名「卢梭」统一为批准译法（2 处）', u1.n === 2 && u1.out.split('让-雅克·卢梭（Jean-Jacques Rousseau）').length === 3);

  // 4. 已是批准译法则不动
  const u2 = await page.evaluate(() => window.gvUnifyInText('让-雅克·卢梭（Jean-Jacques Rousseau）', [{ foreign: 'Jean-Jacques Rousseau', zh: '让-雅克·卢梭', aliases: ['卢梭'] }]));
  T('批准译法本身不改（n=0）', u2.n === 0 && u2.out.indexOf('让-雅克·卢梭（Jean-Jacques Rousseau）') >= 0);

  // 5. 空面板渲染
  const empty = await page.evaluate(() => { const el = document.querySelector('#gv-list'); return el && el.innerHTML.indexOf('没有待核验') >= 0; });
  T('无待审核词条时面板给空状态提示', empty);

  if(pageErrors.length){ console.log('  pageErrors: ' + pageErrors.slice(0, 5).join(' | ')); }
  if(consoleErrs.length){ console.log('  consoleErrs: ' + consoleErrs.slice(0, 5).join(' | ')); }
  await browser.close();
  console.log('通过: ' + pass + ' 失败: ' + fail);
  process.exit(fail ? 1 : 0);
})();
