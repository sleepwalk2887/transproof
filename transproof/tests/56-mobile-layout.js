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

  const api = await page.evaluate(() => {
    const styleText = (document.querySelector('style') || {}).textContent || '';
    const navBtns = document.querySelectorAll('nav button').length;
    return {
      appv: (window.__APP_INFO && window.__APP_INFO.appv) || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : null),
      hasMedia: styleText.includes('@media (max-width:768px)'),
      hasPagePad: styleText.includes('.page{padding:12px}'),
      hasNavNowrap: styleText.includes('nav{flex-wrap:nowrap'),
      hasFont16: styleText.includes('font-size:16px'),
      hasSafeArea: styleText.includes('env(safe-area-inset-bottom)'),
      hasModalBox: styleText.includes('.modal .box{padding:16px'),
      navBtns: navBtns,
      hasBtnPnoun: !!document.querySelector('#btn-pnoun'),
      hasAoPnoun: !!document.querySelector('#ao-pnoun'),
      hasBtnFb: !!document.querySelector('#btn-fb'),
      hasVerTag: !!document.querySelector('#ver-tag'),
      hasTsRun: !!document.querySelector('#ts-btn-run')
    };
  });
  T('APP_VERSION 三段式', typeof api.appv === 'string' && api.appv.split('.').length === 3);
  T('@media 768px 块存在', api.hasMedia);
  T('.page 收紧为 12px', api.hasPagePad);
  T('页签横向滑动 (nav nowrap)', api.hasNavNowrap);
  T('输入框 16px 防 iOS 缩放', api.hasFont16);
  T('底部安全区适配 (safe-area)', api.hasSafeArea);
  T('弹层贴屏 (modal box 16px)', api.hasModalBox);
  T('页签按钮 8 个', api.navBtns === 8);
  T('旧锚点 #btn-pnoun 未动', api.hasBtnPnoun);
  T('旧锚点 #ao-pnoun 未动', api.hasAoPnoun);
  T('反馈按钮 #btn-fb 在', api.hasBtnFb);
  T('版本标签 #ver-tag 在', api.hasVerTag);
  T('翻译运行按钮 #ts-btn-run 在', api.hasTsRun);
  T('无页面错误', pageErrors.length === 0);
  if (pageErrors.length) console.log('  pageErrors:', pageErrors.join(' | '));

  await browser.close();
  console.log('PASS=' + pass + ' FAIL=' + fail + ' TOTAL=' + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('EXC ' + e.message); process.exit(1); });
