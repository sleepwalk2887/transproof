const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

(async () => {
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrs = [], pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('dialog', d => d.accept());

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  console.log('===== T-023 标点·书名号 1:1 机械对账 =====');

  let pass = 0, fail = 0;
  const T = async (name, fn) => {
    try { await fn(); pass++; console.log('  ✅ ' + name); }
    catch (e) { fail++; console.log('  ❌ ' + name + ' → ' + e.message); }
  };

  await T('punctAudit / showPunctAudit 已定义', async () => {
    const ok = await page.evaluate(() => typeof punctAudit === 'function' && typeof showPunctAudit === 'function');
    if (!ok) throw new Error('punctAudit 或 showPunctAudit 未定义');
  });

  await T('悬空配对符号被检出（《 有 1 个、》 没有）', async () => {
    const r = await page.evaluate(() => punctAudit('《书名》', '《书名'));
    if (!r.unpaired || !r.unpaired.length) throw new Error('unpaired 应非空');
    if (!(r.issueCount >= 1)) throw new Error('issueCount 应 ≥1，实际 ' + r.issueCount);
  });

  await T('书名号数量对账（原文 1 个《，译文 0）', async () => {
    const r = await page.evaluate(() => punctAudit('《书名》', '书名'));
    const mm = (r.mismatch || []).map(x => x.name);
    if (mm.indexOf('书名号《') < 0) throw new Error('mismatch 未含书名号《 → ' + JSON.stringify(mm));
  });

  await T('干净文本判定 clean（issueCount=0）', async () => {
    const r = await page.evaluate(() => punctAudit('《书名》里的问号？和叹号！', '《书名》里的问号？和叹号！'));
    if (!r.clean || r.issueCount !== 0) throw new Error('应 clean，实际 clean=' + r.clean + ' n=' + r.issueCount);
  });

  await T('旧锚点 id 全部保留', async () => {
    const ok = await page.evaluate(() => !!document.querySelector('#btn-audit') && !!document.querySelector('#btn-num-audit') && !!document.querySelector('#btn-para-audit') && !!document.querySelector('#btn-view-doc') && !!document.querySelector('#btn-view-tri'));
    if (!ok) throw new Error('有旧锚点丢失');
  });

  await T('新按钮 btn-punct-audit 存在', async () => {
    const ok = await page.evaluate(() => !!document.querySelector('#btn-punct-audit'));
    if (!ok) throw new Error('btn-punct-audit 不存在');
  });

  await T('面板可打开且标题含「标点」', async () => {
    await page.evaluate(() => { document.querySelector('#src').value = '《书名》？'; document.querySelector('#dst').value = '书名'; showPunctAudit(); });
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({ on: document.querySelector('#modal').classList.contains('on'), t: (document.querySelector('#mTitle') || {}).textContent || '', b: ((document.querySelector('#mBody') || {}).textContent || '').length > 0 }));
    if (!r.on) throw new Error('modal 未打开');
    if (r.t.indexOf('标点') < 0) throw new Error('标题不含「标点」→ ' + r.t);
    if (!r.b) throw new Error('正文为空');
  });

  await T('关闭按钮可关闭面板', async () => {
    await page.evaluate(() => { const c = document.querySelector('#punct-close'); if (c) c.click(); });
    await page.waitForTimeout(150);
    const on = await page.evaluate(() => document.querySelector('#modal').classList.contains('on'));
    if (on) throw new Error('modal 仍开着');
  });

  if (pageErrors.length) { fail++; console.log('  ❌ 页面 JS 报错 → ' + pageErrors.slice(0, 3).join(' | ')); }

  console.log('通过: ' + pass + ' 失败: ' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
