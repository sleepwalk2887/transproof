const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

(async () => {
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrs = [], pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('dialog', d => d.accept());

  // 预置：2 已批准 + 1 待审核 + 1 已拒绝
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.setItem('tp.gloss', JSON.stringify({
      version: 2, sources: [], tags: [], rules: [], log: [], collections: [],
      terms: [
        { id: 1, foreign: 'Aufhebung', zh: '扬弃', type: '概念', status: 'confirmed' },
        { id: 2, foreign: 'Hegel', zh: '黑格尔', type: '人物', status: 'confirmed' },
        { id: 3, foreign: 'Sein', zh: '存在', type: '概念', status: 'pending' },
        { id: 4, foreign: 'Dasein', zh: '此在', type: '概念', status: 'rejected' }
      ]
    }));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.click('nav button[data-page="p-gloss"]');
  await page.waitForTimeout(300);

  console.log('===== T-012 术语权威分级（approved 状态机）=====');

  let pass = 0, fail = 0;
  const T = async (name, fn) => {
    try { await fn(); pass++; console.log('  ✅ ' + name); }
    catch (e) { fail++; console.log('  ❌ ' + name + ' → ' + e.message); }
  };

  await T('approvedGloss 闸门只认已批准（confirmed）', async () => {
    const r = await page.evaluate(() => {
      const a = approvedGloss();
      return { n: a.length, all: a.every(t => t.status === 'confirmed' && t.foreign && t.zh), has: a.map(t => t.foreign) };
    });
    if (r.n !== 2) throw new Error('应只含 2 条已批准，实际 ' + r.n + ' → ' + JSON.stringify(r.has));
    if (!r.all) throw new Error('闸门混入非已批准或空词条');
    if (r.has.indexOf('Sein') >= 0 || r.has.indexOf('Dasein') >= 0) throw new Error('待审核/已拒绝被闸门放行: ' + JSON.stringify(r.has));
  });

  await T('buildSystem 只注入已批准专有译词（待审核/已拒绝不进）', async () => {
    const out = await page.evaluate(() => {
      document.querySelector('#c-term').checked = true;
      document.querySelector('#src').value = 'test';
      return buildSystem();
    });
    if (out.indexOf('Aufhebung') < 0 || out.indexOf('Hegel') < 0) throw new Error('已批准词条未注入提示词');
    if (out.indexOf('已批准专有译词') < 0) throw new Error('缺少「已批准专有译词」锁定块标题');
    if (out.indexOf('Sein') >= 0) throw new Error('待审核词条 Sein 被注入提示词');
    if (out.indexOf('Dasein') >= 0) throw new Error('已拒绝词条 Dasein 被注入提示词');
  });

  await T('状态格快捷按钮按状态显隐', async () => {
    const r = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#g-tbody tr[data-id]')];
      const rowOf = id => rows.find(tr => +tr.dataset.id === id);
      return {
        confirmed: { approve: !!rowOf(1).querySelector('[data-approve]'), topend: !!rowOf(1).querySelector('[data-topend]'), reject: !!rowOf(1).querySelector('[data-toreject]') },
        pending:   { approve: !!rowOf(3).querySelector('[data-approve]'), topend: !!rowOf(3).querySelector('[data-topend]'), reject: !!rowOf(3).querySelector('[data-toreject]') }
      };
    });
    if (r.confirmed.approve) throw new Error('已批准行不应再显示「批准」按钮');
    if (!r.confirmed.topend || !r.confirmed.reject) throw new Error('已批准行应有「待审/拒绝」按钮');
    if (!r.pending.approve) throw new Error('待审行应有「批准」按钮');
    if (r.pending.topend) throw new Error('待审行不应显示「待审」按钮');
  });

  await T('点「批准」→ 迁移为已批准并持久化', async () => {
    await page.evaluate(() => document.querySelector('#g-tbody tr[data-id="3"] [data-approve]').click());
    await page.waitForTimeout(300);
    const st = await page.evaluate(() => ({
      inMem: (GLOSS.terms.find(t => t.id === 3) || {}).status,
      saved: ((JSON.parse(localStorage.getItem('tp.gloss')).terms.find(t => t.id === 3)) || {}).status,
      badge: (document.querySelector('#g-tbody tr[data-id="3"] .g-status') || {}).textContent
    }));
    if (st.inMem !== 'confirmed') throw new Error('内存状态未变 confirmed，实际 ' + st.inMem);
    if (st.saved !== 'confirmed') throw new Error('未持久化到 localStorage，实际 ' + st.saved);
    if ((st.badge || '').indexOf('已批准') < 0) throw new Error('徽章应显示「已批准」，实际 ' + st.badge);
  });

  await T('glossSetStatus 打回「待审」', async () => {
    const r = await page.evaluate(() => glossSetStatus(1, 'pending'));
    const st = await page.evaluate(() => (GLOSS.terms.find(t => t.id === 1) || {}).status);
    if (!r) throw new Error('glossSetStatus 应返回 true');
    if (st !== 'pending') throw new Error('状态应为 pending，实际 ' + st);
  });

  await T('核查结果 ok → 一键批准按钮（onApprove）', async () => {
    const r = await page.evaluate(() => {
      let called = 0;
      const items = [{ src: 'Aufhebung', dst: '扬弃' }];
      const verdicts = [{ i: 0, verdict: 'ok', reason: '正确', conf: '高' }];
      showVerifyResults(items, verdicts, { onApprove: () => { called++; } });
      const btn = document.querySelector('#mBody [data-approve]');
      const has = !!btn;
      if (btn) btn.click();
      return { has, called };
    });
    if (!r.has) throw new Error('ok 判定未渲染「批准」按钮');
    if (r.called !== 1) throw new Error('点批准未触发 onApprove，实际 ' + r.called);
    await page.evaluate(() => closeModal());
  });

  await T('旧锚点一个没动（btn-audit / btn-view-doc / btn-view-tri）', async () => {
    const r = await page.evaluate(() => ({
      audit: !!document.querySelector('#btn-audit'),
      doc: !!document.querySelector('#btn-view-doc'),
      tri: !!document.querySelector('#btn-view-tri')
    }));
    if (!r.audit || !r.doc || !r.tri) throw new Error('旧锚点缺失: ' + JSON.stringify(r));
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
