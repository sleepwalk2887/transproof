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
    dl: typeof window.dl,
    dlBlob: typeof window.dlBlob,
    appv: (window.__APP_INFO && window.__APP_INFO.appv) || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : null),
    hasBtnPnoun: !!document.querySelector('#btn-pnoun'),
    hasTsBtnDocout: !!document.querySelector('#ts-btn-docout'),
    hasBtnDocout: !!document.querySelector('#btn-docout')
  }));
  T('dl 导出', api.dl === 'function');
  T('dlBlob 导出', api.dlBlob === 'function');
  T('APP_VERSION 三段式', typeof api.appv === 'string' && api.appv.split('.').length === 3);
  T('旧锚点 #btn-pnoun 未动', api.hasBtnPnoun);
  T('翻译后下载按钮 #ts-btn-docout 在', api.hasTsBtnDocout);
  T('校对后下载按钮 #btn-docout 在', api.hasBtnDocout);

  // 核心：mock 下载触发，验证 <a> 真的挂到了 document.body（移动端修复点）
  const r1 = await page.evaluate(() => {
    const origCreate = URL.createObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = () => 'blob:fake';
    HTMLAnchorElement.prototype.click = function(){};
    let appendedTag = null, appendedDl = null, appendCount = 0;
    const origAppend = document.body.appendChild.bind(document.body);
    document.body.appendChild = function(n){ appendCount++; appendedTag = n.tagName; appendedDl = n.download; return origAppend(n); };
    let err = null;
    try { window.dl('测试下载.txt', '内容', 'text/plain'); }
    catch(e){ err = e.message; }
    finally {
      URL.createObjectURL = origCreate;
      HTMLAnchorElement.prototype.click = origClick;
      document.body.appendChild = origAppend;
    }
    return { appendedTag, appendedDl, appendCount, err };
  });
  T('dl 调用后 appendChild 被调用', r1.appendCount >= 1);
  T('dl 挂载的是 <a> 元素', r1.appendedTag === 'A');
  T('dl 的 download 属性正确', r1.appendedDl === '测试下载.txt');
  T('dl 无异常', !r1.err);

  const r2 = await page.evaluate(() => {
    const origCreate = URL.createObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = () => 'blob:fake';
    HTMLAnchorElement.prototype.click = function(){};
    let appendedTag = null, appendedDl = null, appendCount = 0;
    const origAppend = document.body.appendChild.bind(document.body);
    document.body.appendChild = function(n){ appendCount++; appendedTag = n.tagName; appendedDl = n.download; return origAppend(n); };
    let err = null;
    try { window.dlBlob('测试文档.docx', new Blob(['x'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })); }
    catch(e){ err = e.message; }
    finally {
      URL.createObjectURL = origCreate;
      HTMLAnchorElement.prototype.click = origClick;
      document.body.appendChild = origAppend;
    }
    return { appendedTag, appendedDl, appendCount, err };
  });
  T('dlBlob 调用后 appendChild 被调用', r2.appendCount >= 1);
  T('dlBlob 挂载的是 <a> 元素', r2.appendedTag === 'A');
  T('dlBlob 的 download 属性正确', r2.appendedDl === '测试文档.docx');
  T('dlBlob 无异常', !r2.err);

  T('无页面错误', pageErrors.length === 0);

  console.log('PASS=' + pass + ' FAIL=' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
