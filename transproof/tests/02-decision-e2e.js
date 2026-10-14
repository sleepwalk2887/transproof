const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

(async () => {
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrs = [], pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  let calls = 0, lastSys = '';
  // mock 两次：第一次含 2 组争议词条，第二次（重校对）简洁输出
  await page.route('**/chat/completions', async r => {
    calls++;
    const body = JSON.parse(r.request().postData() || '{}');
    lastSys = body.messages?.[0]?.content || '';
    const out = calls === 1
      ? '## 一、修订后译文\n\n黑格尔在市民社会语境中论述领导权与扬弃。\n\n## 三、术语与争议点延伸\n\n### 词条：hegemony\n\n**字面/词源**：领导权\n\n**通行译法**：\n- 霸权（主流政治学译法）：强调支配与压制\n- 领导权（葛兰西学派）：强调文化与意识形态的引领\n\n**本语境推荐**：领导权，因为本句讨论的是葛兰西意义上的市民社会\n\n### 词条：Aufhebung\n\n**字面/词源**：扬弃\n\n**通行译法**：\n- 扬弃（黑格尔传统）：保留矛盾意涵\n- 废弃（恩格斯通俗化）：丢失保留义\n\n**本语境推荐**：扬弃\n\n## 四、注释建议\n\n无需加注。'
      : '## 一、修订后译文\n\n按终审译法重校完成。';
    const sse = out.split('').map(c => 'data: ' + JSON.stringify({ choices: [{ delta: { content: c } }] }) + '\n\n').join('') + 'data: [DONE]\n\n';
    await r.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: sse });
  });

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // 配置 + 填原文译文
  await page.evaluate(() => window.TransProof.fill({ apiKey: 'sk-test', baseUrl: 'http://mock.local/v1' }));
  await page.fill('#src', 'Hegel discusses hegemony and Aufhebung.');
  await page.fill('#dst', '黑格尔讨论霸权与扬弃。');

  // 点运行
  await page.click('#btn-run');
  // 等待输出完成
  await page.waitForFunction(() => {
    const el = document.querySelector('#out');
    return el && el.textContent.includes('修订后译文') && !document.querySelector('#out .caret');
  }, { timeout: 20000 });

  const r1 = await page.evaluate(() => ({
    outHasHeading: document.querySelector('#out').textContent.includes('一、修订后译文'),
    outHasTerm: document.querySelector('#out').textContent.includes('hegemony'),
    panelShown: getComputedStyle(document.querySelector('#decision-panel')).display !== 'none',
    chipCount: document.querySelectorAll('#decision-panel .dp-chip').length,
    itemCount: document.querySelectorAll('#decision-panel .dp-item').length,
    dpApply: !!document.querySelector('#dp-apply'),
    dpTolib: !!document.querySelector('#dp-tolib'),
    recSelected: document.querySelectorAll('#decision-panel .dp-chip.rec.sel').length,
  }));
  console.log('========== 第一次校对后 ==========');
  console.log(JSON.stringify(r1, null, 2));

  // 点选第一个词条的「霸权」chip（非推荐项，验证切换），第二个词条保持推荐「扬弃」
  await page.evaluate(() => {
    const items = document.querySelectorAll('#decision-panel .dp-item');
    const chip = [...items[0].querySelectorAll('.dp-chip')].find(c => c.dataset.val === '霸权');
    chip.click();
  });
  const selInfo = await page.evaluate(() => ({
    selVals: [...document.querySelectorAll('#decision-panel .dp-chip.sel')].map(c => c.dataset.val),
    applyText: document.querySelector('#dp-apply').textContent,
  }));
  console.log('\n========== 点选译法后 ==========');
  console.log(JSON.stringify(selInfo, null, 2));

  const callsBefore = calls;
  await page.click('#dp-apply');
  await page.waitForFunction(() => {
    const el = document.querySelector('#out');
    return el && el.textContent.includes('重校完成') && !document.querySelector('#out .caret');
  }, { timeout: 20000 });

  const r2 = await page.evaluate(() => ({
    autoReRan: true,
    outUpdated: document.querySelector('#out').textContent.includes('重校完成'),
    extraHasInst: document.querySelector('#extra').value.includes('hegemony → 霸权'),
    extraHasAuf: document.querySelector('#extra').value.includes('Aufhebung → 扬弃'),
    termsCount: window.TransProof.getTerms().length,
    termsHaveHegemony: window.TransProof.getTerms().some(t => t.src.toLowerCase() === 'hegemony'),
    panelHiddenAfter: getComputedStyle(document.querySelector('#decision-panel')).display === 'none',
  }));
  console.log('\n========== 应用并重校对后 ==========');
  console.log(JSON.stringify(r2, null, 2));
  console.log('\n调用次数: 第一次后=' + callsBefore + ' 第二次后=' + calls);
  console.log('决策指令已写入系统提示词: ' + /hegemony\s*→\s*霸权/.test(lastSys) + ' / ' + /Aufhebung\s*→\s*扬弃/.test(lastSys));

  console.log('\n========== 错误汇总 ==========');
  console.log('  console errors:', consoleErrs.length);
  consoleErrs.slice(0, 10).forEach(e => console.log('    [console]', e));
  console.log('  page errors:', pageErrors.length);
  pageErrors.slice(0, 10).forEach(e => console.log('    [pageerror]', e));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
