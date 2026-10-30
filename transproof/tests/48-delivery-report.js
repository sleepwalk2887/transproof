const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let pass = 0, fail = 0;
const consoleErrs = [], pageErrors = [];
function T(name, ok){ if(ok){ pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } }

(async () => {
  console.log('===== v4.40.0 交付质检报告（delivery report）=====');
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => { if(m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // 1. 函数与按钮存在
  const boot = await page.evaluate(() => ({
    btn: !!document.querySelector('#btn-report'),
    oldBtn: !!document.querySelector('#btn-audit-center'),
    fns: ['deliveryReport','reportBuildData','reportMarkdown'].map(f => typeof window[f] === 'function'),
    appv: (function(){ try { return APP_VERSION; } catch(e){ return null; } })()
  }));
  T('#btn-report 按钮存在', boot.btn);
  T('旧按钮 #btn-audit-center 未动', boot.oldBtn);
  T('三个报告函数已导出', boot.fns.every(Boolean));
  T('APP_VERSION 是三段式版本号', String(boot.appv).split('.').length === 3);

  // 2. 纯函数汇总：错误分类 + 已修进度 + 修订正文抽取
  const fakeOut = '## 一、修订后译文\n\n这是第一段译文。\n\n这是第二段译文。\n\n## 二、逐条批注\n\n- [误译] **原文A** → 改为「译文甲」：理由一。\n- [术语不一致] **原文B** → 改为「译文乙」：理由二。\n- [误译] **原文C** → 改为「译文丙」：理由三。';
  const fakeSrc = 'This is paragraph one.\n\nThis is paragraph two.';
  const data = await page.evaluate(({ fakeOut, fakeSrc }) => {
    const d = reportBuildData(fakeOut, fakeSrc, 2, 3);
    return { totalAnn: d.totalAnn, cats: d.cats, rev: d.rev, q: d.q ? { ok: d.q.ok, score: d.q.score, level: d.q.level } : null, paras: d.srcParas };
  }, { fakeOut, fakeSrc });
  T('错误分类总数 = 3', data.totalAnn === 3);
  T('误译 = 2 条', data.cats['误译'] === 2);
  T('修订正文抽取干净（无批注）', data.rev.indexOf('第一段译文') >= 0 && data.rev.indexOf('逐条批注') < 0);
  T('质量评分 ok 且有分数', data.q && data.q.ok && data.q.score >= 0);

  // 3. Markdown 报告含关键区块与 TransProof 页脚
  const md = await page.evaluate(({ fakeOut, fakeSrc }) => {
    const d = reportBuildData(fakeOut, fakeSrc, 2, 3);
    return reportMarkdown(d);
  }, { fakeOut, fakeSrc });
  T('报告含标题 + 分类 + 进度 + 页脚', md.indexOf('# 交付质检报告') >= 0 && md.indexOf('错误分类') >= 0 && md.indexOf('已修进度') >= 0 && md.indexOf('TransProof') >= 0);
  T('报告页脚含版本号', md.indexOf('v' + boot.appv) >= 0);

  // 4. 点按钮出弹窗
  await page.evaluate(() => { LAST_OUT = '## 一、修订后译文\n\n这是译文。\n\n## 二、逐条批注\n\n- [误译] **A** → 改为「B」：理由。'; });
  await page.click('#btn-report');
  await page.waitForTimeout(400);
  const modalOn = await page.evaluate(() => ({
    on: document.querySelector('#modal') && document.querySelector('#modal').classList.contains('on'),
    title: (document.querySelector('#mTitle') || {}).textContent,
    copyBtn: !!document.querySelector('#rp-copy-md')
  }));
  T('点按钮弹出交付报告弹窗', modalOn.on && String(modalOn.title).indexOf('交付质检报告') >= 0);
  T('弹窗内有复制按钮', modalOn.copyBtn);

  if(pageErrors.length){ console.log('  pageErrors: ' + pageErrors.slice(0, 5).join(' | ')); }
  if(consoleErrs.length){ console.log('  consoleErrs: ' + consoleErrs.slice(0, 5).join(' | ')); }
  T('无页面错误', pageErrors.length === 0 && consoleErrs.length === 0);
  await browser.close();
  console.log('通过: ' + pass + ' 失败: ' + fail);
  process.exit(fail ? 1 : 0);
})();
