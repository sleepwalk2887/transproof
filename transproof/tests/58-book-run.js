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
    bookRun: typeof window.bookRun,
    bookTierModal: typeof window.bookTierModal,
    bookProgress: typeof window.bookProgress,
    appv: (typeof APP_VERSION !== 'undefined') ? APP_VERSION : null,
    hasBtnBook: !!document.querySelector('#ts-btn-book'),
    btnBookDisabled: (document.querySelector('#ts-btn-book')||{}).disabled,
    hasBtnRun: !!document.querySelector('#ts-btn-run'),
    hasOutHint: !!document.querySelector('#ts-outHint')
  }));
  T('bookRun 导出', api.bookRun === 'function');
  T('bookTierModal 导出', api.bookTierModal === 'function');
  T('bookProgress 导出', api.bookProgress === 'function');
  T('APP_VERSION 三段式', typeof api.appv === 'string' && api.appv.split('.').length === 3);
  T('#ts-btn-book 存在', api.hasBtnBook);
  T('#ts-btn-book 初始 disabled', api.btnBookDisabled === true);
  T('旧锚点 #ts-btn-run 未动', api.hasBtnRun);
  T('#ts-outHint 在', api.hasOutHint);
  const ui = await page.evaluate(async () => {
    window._toast = '';
    window.toast = (m, t) => { window._toast = m + '|' + t; };
    window._modalH = '';
    window._modalT = '';
    window.modal = (t, h) => { window._modalT = t; window._modalH = h; };
    window.closeModal = () => {};
    TS_FILES.src = null;
    const r1 = await window.bookRun('fast');
    const toastHit = window._toast.indexOf('请先上传 EPUB') >= 0;
    window.bookProgress(1, 3, '测试章');
    const hintTxt = document.querySelector('#ts-outHint').textContent;
    window.bookTierModal();
    const hasFast = window._modalH.indexOf('bk-fast') >= 0;
    const hasQuality = window._modalH.indexOf('bk-quality') >= 0;
    return { r1: r1, toastHit: toastHit, hintTxt: hintTxt, hasFast: hasFast, hasQuality: hasQuality };
  });
  T('无文件时 toast 提示', ui.toastHit);
  T('无文件时返回 undefined', ui.r1 === undefined || ui.r1 === null);
  T('进度更新提示', ui.hintTxt.indexOf('第 1/3 章') >= 0);
  T('档位弹窗含快速档', ui.hasFast);
  T('档位弹窗含质量档', ui.hasQuality);
  const run = await page.evaluate(async () => {
    TS_FILES.src = { fileName: 't.epub', chapters: [
      { title: '第一章', text: 'hello one' },
      { title: '第二章', text: 'hello two' }
    ] };
    window.callModel = async () => ({ text: '译文X' });
    window.callModelSimple = async () => '[]';
    window.buildTransSystem = () => 'SYS';
    window.saveTask = () => {};
    window.toast = () => {};
    await window.bookRun('fast');
    const ch0 = TS_FILES.src.chapters[0];
    const ch1 = TS_FILES.src.chapters[1];
    const hint = document.querySelector('#ts-outHint').textContent;
    const stat = document.querySelector('#ts-runStat').textContent;
    const bookBtnDisabled = document.querySelector('#ts-btn-book').disabled;
    return {
      ch0Text: ch0.text,
      ch0Src: ch0._srcText,
      ch1Text: ch1.text,
      hintHasDone: hint.indexOf('完成') >= 0,
      statOk: stat === '✓',
      btnReEnabled: bookBtnDisabled === false
    };
  });
  T('章1 译文写回', run.ch0Text === '译文X');
  T('章1 原文备份', run.ch0Src === 'hello one');
  T('章2 译文写回', run.ch1Text === '译文X');
  T('完成提示', run.hintHasDone);
  T('状态 ✓', run.statOk);
  T('按钮恢复可用', run.btnReEnabled);
  T('无页面错误', pageErrors.length === 0);
  if(pageErrors.length) console.log('  pageErrors:', pageErrors.slice(0,3));
  await browser.close();
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('EXC', e); process.exit(1); });
