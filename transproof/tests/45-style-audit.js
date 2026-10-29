const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let pass = 0, fail = 0;
const consoleErrs = [], pageErrors = [];
function T(name, ok){ if(ok){ pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } }

(async () => {
  console.log('===== T-025 翻译腔体检（styleAudit）=====');
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => { if(m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // 1. 函数已定义
  const fnDefined = await page.evaluate(() => typeof window.styleAudit === 'function' && typeof window.showStyleAudit === 'function');
  T('styleAudit/showStyleAudit 已定义', fnDefined);

  // 2. 句末落「的」检出
  const r1 = await page.evaluate(() => window.styleAudit('这是一个非常美丽的夜晚的。我们继续往前走着。'));
  T('句末落「的」检出（deFinal>0）', (r1.deFinal || []).length > 0);

  // 3. 「的」字堆叠检出
  const r2 = await page.evaluate(() => window.styleAudit('他的朋友的家的花园里的花的美丽令人惊叹。'));
  T('「的」字堆叠检出（deDense>0）', (r2.deDense || []).length > 0 && r2.deDense[0].n >= 4);

  // 4. 套话/直译黑名单检出
  const r3 = await page.evaluate(() => window.styleAudit('作为一个研究者的东西，他在这种情况下对于这个问题来说进行了分析。'));
  T('套话/直译黑名单检出（black>0）', (r3.black || []).length > 0 && r3.issueCount > 0);

  // 5. 干净文本 clean
  const r4 = await page.evaluate(() => window.styleAudit('今天天气很好。我们去公园散步。他买了一本书。'));
  T('干净文本 clean=true', r4.clean === true && r4.issueCount === 0);

  // 6. 按钮存在 + 旧锚点不动
  const anchors = await page.evaluate(() => ({
    style: !!document.querySelector('#btn-style-audit'),
    audit: !!document.querySelector('#btn-audit'),
    num: !!document.querySelector('#btn-num-audit'),
    para: !!document.querySelector('#btn-para-audit'),
    punct: !!document.querySelector('#btn-punct-audit'),
    doc: !!document.querySelector('#btn-view-doc'),
    tri: !!document.querySelector('#btn-view-tri')
  }));
  T('按钮 #btn-style-audit 存在', anchors.style);
  T('旧锚点全部保留（btn-audit/num/para/punct/view-doc/view-tri）', anchors.audit && anchors.num && anchors.para && anchors.punct && anchors.doc && anchors.tri);

  // 7. 先展开体检中心（按钮在折叠面板里），再点按钮测面板
  await page.click('#btn-audit-center');
  await page.waitForTimeout(250);
  const visible = await page.evaluate(() => {
    const b = document.querySelector('#btn-style-audit');
    return !!b && b.offsetParent !== null;
  });
  T('展开体检中心后按钮可见', visible);
  await page.fill('#src', '这是一个非常美丽的夜晚的。');
  await page.fill('#dst', '这是一个非常美丽的夜晚的。他的朋友的家的花园里的花的美丽令人惊叹。');
  await page.click('#btn-style-audit');
  await page.waitForTimeout(300);
  const panel = await page.evaluate(() => {
    const on = document.querySelector('#modal') && document.querySelector('#modal').classList.contains('on');
    const title = (document.querySelector('#mTitle') || {}).textContent || '';
    const body = (document.querySelector('#mBody') || {}).innerHTML || '';
    return { on, title, body };
  });
  T('面板打开（#modal.on + 标题含「翻译腔」）', panel.on && panel.title.indexOf('翻译腔') >= 0);
  T('面板含「句末落」或「的」堆叠提示', panel.body.indexOf('句末落') >= 0 || panel.body.indexOf('堆叠') >= 0);
  await page.click('#style-close');
  await page.waitForTimeout(200);
  const closed = await page.evaluate(() => !document.querySelector('#modal').classList.contains('on'));
  T('关闭按钮有效（#modal 收起）', closed);

  if(pageErrors.length){ console.log('  pageErrors: ' + pageErrors.slice(0, 5).join(' | ')); }
  await browser.close();
  console.log('通过: ' + pass + ' 失败: ' + fail);
  process.exit(fail ? 1 : 0);
})();
