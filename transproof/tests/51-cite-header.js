const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let pass = 0, fail = 0;
const consoleErrs = [], pageErrors = [];
function T(name, ok){ if(ok){ pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } }

(async () => {
  console.log('===== v4.43.0 导出引用头（cite header）=====');
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => { if(m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const boot = await page.evaluate(() => ({
    fn: typeof window.citeBuildHeader === 'function',
    apa: typeof window.citeBuildApa === 'function',
    fromDialog: typeof window.citeBuildFromDialog === 'function',
    blockHtml: typeof window.citeHeaderBlockHtml === 'function',
    bind: typeof window.citeBindDialog === 'function',
    blockFor: typeof window.citeBlockForDialog === 'function',
    btnCopy: !!document.querySelector('#btn-copy'),
    btnPnoun: !!document.querySelector('#btn-pnoun'),
    appv: (function(){ try { return APP_VERSION; } catch(e){ return null; } })()
  }));
  T('citeBuildHeader 已导出', boot.fn);
  T('citeBuildApa 已导出', boot.apa);
  T('citeBuildFromDialog 已导出', boot.fromDialog);
  T('citeHeaderBlockHtml 已导出', boot.blockHtml);
  T('citeBindDialog 已导出', boot.bind);
  T('citeBlockForDialog 已导出', boot.blockFor);
  T('旧锚点 #btn-copy 未动', boot.btnCopy);
  T('旧锚点 #btn-pnoun 未动', boot.btnPnoun);
  T('APP_VERSION 为三段式', typeof boot.appv === 'string' && boot.appv.split('.').length === 3);

  const r = await page.evaluate(() => {
    const meta = {
      title_zh: '语言学习即语言使用：儿童语言发展的跨语言模型',
      author_zh: '麦考利',
      institution: '康奈尔大学心理学系',
      author_en: 'McCauley, S. M., & Christiansen, M. H.',
      year: '2019',
      article_title: 'Language learning as language use: A cross-linguistic model of child language development',
      journal: 'Psychological Review',
      volume: '126', issue: '1', pages: '1–51', doi: '10.1037/rev0000126'
    };
    const apa = citeBuildApa(meta);
    const full = citeBuildHeader(meta, { title:true, author:true, apa:true, license:true });
    const onlyLic = citeBuildHeader({}, { title:false, author:false, apa:false, license:true });
    const html = citeHeaderBlockHtml({});
    return {
      apa,
      full,
      onlyLic,
      html,
      nCheck: (html.match(/type="checkbox" id="cite-op-/g) || []).length,
      nInput: (html.match(/<input id="cite-/g) || []).length,
      hasExtract: html.indexOf('cite-extract') >= 0
    };
  });
  T('APA 输出正确', r.apa === 'McCauley, S. M., & Christiansen, M. H. (2019). Language learning as language use: A cross-linguistic model of child language development. Psychological Review, 126(1), 1–51. https://doi.org/10.1037/rev0000126');
  T('完整头含四样', r.full.indexOf('【标题】') === 0 && r.full.indexOf('【作者】') > 0 && r.full.indexOf('【APA 出处】') > 0 && r.full.indexOf('【版权声明】') > 0);
  T('仅版权声明时不带标题', r.onlyLic.indexOf('【标题】') < 0 && r.onlyLic.indexOf('【版权声明】') >= 0);
  T('引用头块含 4 个勾选框', r.nCheck === 4);
  T('引用头块含 11 个输入框', r.nInput === 11);
  T('引用头块含自动提取按钮', r.hasExtract);

  if(pageErrors.length){ console.log('  pageErrors: ' + pageErrors.slice(0, 5).join(' | ')); }
  if(consoleErrs.length){ console.log('  consoleErrs: ' + consoleErrs.slice(0, 5).join(' | ')); }
  T('无页面错误', pageErrors.length === 0 && consoleErrs.length === 0);
  await browser.close();
  console.log('通过: ' + pass + ' 失败: ' + fail);
  process.exit(fail ? 1 : 0);
})();
