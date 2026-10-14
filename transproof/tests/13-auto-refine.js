const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

(async () => {
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrs = [], pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  let pass = 0, fail = 0;
  const T = async (name, fn) => {
    try { await fn(); pass++; console.log('  ✅ ' + name); }
    catch (e) { fail++; console.log('  ❌ ' + name + ' → ' + e.message); }
  };

  await page.route('**/chat/completions', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    if (body.stream) {
      const content = '## 一、修订后译文\n\n本文用"支配"译该概念。\n';
      const chunk = JSON.stringify({ choices: [{ delta: { content } }] });
      await r.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: 'data: ' + chunk + '\n\ndata: [DONE]\n\n' });
    } else {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
    }
  });

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.TransProof.fill({ apiKey: 'sk-test', baseUrl: 'http://mock.local/v1' }));

  console.log('===== 理顺 tone/style + 自动化增强 =====');

  await T('提示词：tone/style 分工 + 读者优先规则', async () => {
    const sys = await page.evaluate(() => {
      document.querySelector('#dst').value = '译文。';
      document.querySelector('#src').value = '';
      STAGE = 'full';
      return buildSystem();
    });
    if (!sys.includes('目标读者')) throw new Error('缺少"目标读者"分工说明');
    if (!sys.includes('文字风格')) throw new Error('缺少"文字风格"分工说明');
    if (!sys.includes('读者优先')) throw new Error('缺少"读者优先"冲突规则');
    if (!sys.includes('语法/结构层面')) throw new Error('规则4 未标注语法层面');
  });

  await T('自动二校开关：一校完成自动接二校', async () => {
    await page.evaluate(() => {
      STAGE = 'pass1';
      document.querySelector('#c-autopass2').checked = true;
      renderStageNext();
    });
    const r = await page.evaluate(() => ({ stage: STAGE, txt: document.querySelector('#stage-next').textContent }));
    if (r.stage !== 'pass2') throw new Error('自动二校应切到 pass2，实际 ' + r.stage);
    if (!r.txt.includes('自动进入二校')) throw new Error('未显示自动接力提示');
    await page.evaluate(() => { STAGE = 'full'; document.querySelector('#c-autopass2').checked = false; });
  });

  await T('自动术语体检：校对完成发现问题自动提示', async () => {
    await page.evaluate(() => {
      TERMS = [{ src: 'hegemony', dst: '霸权' }];
      document.querySelector('#src').value = 'The hegemony concept is central.';
      document.querySelector('#dst').value = '该核心概念。';
      document.querySelector('#btn-run').click();
    });
    await page.waitForFunction(() => document.querySelector('#out').textContent.includes('修订后译文'), { timeout: 10000 });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const toasts = [...document.querySelectorAll('body > div.alert')].map(d => d.textContent);
      return { hasAuditToast: toasts.some(t => t.includes('术语体检发现')) };
    });
    if (!r.hasAuditToast) throw new Error('未出现自动术语体检提示');
    console.log('      校对完成后自动体检并提示 ✓');
  });

  console.log('\n========== 汇总 ==========');
  console.log('通过: ' + pass + '  失败: ' + fail);
  console.log('console errors: ' + consoleErrs.length);
  consoleErrs.slice(0, 10).forEach(e => console.log('  [console]', e));
  console.log('page errors: ' + pageErrors.length);
  pageErrors.slice(0, 10).forEach(e => console.log('  [pageerror]', e));

  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
