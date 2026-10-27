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

  console.log('===== T-015 数字与格式体检 =====');

  let pass = 0, fail = 0;
  const T = async (name, fn) => {
    try { await fn(); pass++; console.log('  ✅ ' + name); }
    catch (e) { fail++; console.log('  ❌ ' + name + ' → ' + e.message); }
  };

  await T('numAudit / showNumAudit 已定义', async () => {
    const ok = await page.evaluate(() => typeof numAudit === 'function' && typeof showNumAudit === 'function');
    if (!ok) throw new Error('numAudit 或 showNumAudit 未定义');
  });

  await T('丢失的数字被检出（30 天 → 没了）', async () => {
    const r = await page.evaluate(() => numAudit('合同总金额为 1,500 万元，工期 30 天。', '合同总金额为 1,500 万元，工期很短。'));
    const names = (r.missing || []).map(x => x.n);
    if (names.indexOf('30') < 0) throw new Error('missing 未含 30 → ' + JSON.stringify(names));
    if (!(r.issueCount >= 1)) throw new Error('issueCount 应 ≥1，实际 ' + r.issueCount);
    if (r.clean) throw new Error('不应判定为 clean');
  });

  await T('凭空多出的数字被检出（30 → 45）', async () => {
    const r = await page.evaluate(() => numAudit('工期 30 天。', '工期 45 天。'));
    const miss = (r.missing || []).map(x => x.n);
    const extra = (r.extra || []).map(x => x.n);
    if (miss.indexOf('30') < 0) throw new Error('missing 未含 30 → ' + JSON.stringify(miss));
    if (extra.indexOf('45') < 0) throw new Error('extra 未含 45 → ' + JSON.stringify(extra));
  });

  await T('百分号丢失被检出（92% → 92）', async () => {
    const r = await page.evaluate(() => numAudit('合格率达到 92%。', '合格率达到 92。'));
    if (!r.pctLost) throw new Error('pctLost 应为 true');
    if (!(r.issueCount >= 1)) throw new Error('issueCount 应 ≥1，实际 ' + r.issueCount);
  });

  await T('疑似漏否定被逐段检出（not → 没了）', async () => {
    const r = await page.evaluate(() => numAudit('This is not acceptable.\n\nSecond one.', '这是可以接受的。\n\n第二段。'));
    if (!r.negDiff || r.negDiff.length !== 1) throw new Error('negDiff 应为 1 处，实际 ' + JSON.stringify(r.negDiff));
    if (r.negDiff[0].i !== 1) throw new Error('位置应为第 1 段，实际 ' + r.negDiff[0].i);
  });

  await T('干净文本判定 clean（issueCount=0）', async () => {
    const r = await page.evaluate(() => numAudit('价格 100 元，共 200 元。', '价格 100 元，共 200 元。'));
    if (!r.clean || r.issueCount !== 0) throw new Error('应 clean 且 issueCount=0，实际 clean=' + r.clean + ' n=' + r.issueCount);
  });

  await T('万/亿换算不误报（15,000 → 1.5万 仍算对齐）', async () => {
    const r = await page.evaluate(() => numAudit('总产量达到 15,000 吨。', '总产量达到 1.5 万吨。'));
    if (!r.clean) throw new Error('换算对齐不该被报，实际 missing=' + JSON.stringify(r.missing) + ' extra=' + JSON.stringify(r.extra));
  });

  await T('按钮存在 + 旧锚点不动 + 面板可开关', async () => {
    const info = await page.evaluate(() => ({
      btn: !!document.querySelector('#btn-num-audit'),
      oldAudit: !!document.querySelector('#btn-audit'),
      oldPara: !!document.querySelector('#btn-para-audit'),
      oldViewDoc: !!document.querySelector('#btn-view-doc'),
      oldViewTri: !!document.querySelector('#btn-view-tri')
    }));
    if (!info.btn) throw new Error('按钮 #btn-num-audit 缺失');
    if (!info.oldAudit || !info.oldPara || !info.oldViewDoc || !info.oldViewTri)
      throw new Error('旧锚点被改动 → ' + JSON.stringify(info));
    await page.evaluate(() => {
      document.querySelector('#src').value = '合同金额 500 元。';
      document.querySelector('#dst').value = '合同金额 800 元。';
    });
    await page.evaluate(() => { const c = document.querySelector('#btn-audit-center'); if(c) c.click(); });
    await page.waitForTimeout(200);   // v4.36.0 起数字体检按钮收在「体检中心」里，先展开
    await page.click('#btn-num-audit');
    await page.waitForTimeout(300);
    const panel = await page.evaluate(() => ({
      on: document.querySelector('#modal').classList.contains('on'),
      title: document.querySelector('#mTitle').textContent,
      close: !!document.querySelector('#num-close'),
      body: document.querySelector('#mBody').textContent
    }));
    if (!panel.on) throw new Error('面板未打开');
    if (panel.title.indexOf('数字') < 0) throw new Error('标题不对 → ' + panel.title);
    if (!panel.close) throw new Error('关闭按钮缺失');
    if (panel.body.indexOf('丢失') < 0) throw new Error('面板未列出丢失数字 → ' + panel.body.slice(0, 120));
    await page.click('#num-close');
    await page.waitForTimeout(200);
    const closed = await page.evaluate(() => !document.querySelector('#modal').classList.contains('on'));
    if (!closed) throw new Error('关闭按钮无效');
  });

  if (pageErrors.length) {
    console.log('  页面 JS 错误 ' + pageErrors.length + ' 条：');
    pageErrors.slice(0, 10).forEach(e => console.log('    - ' + e));
    fail++;
  }

  console.log('通过: ' + pass + ' 失败: ' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
