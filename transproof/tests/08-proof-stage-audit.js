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

  // mock：流式返回带错误分类标签的校对结果；非流式返回空对象
  await page.route('**/chat/completions', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    if (body.stream) {
      const content = '## 一、修订后译文\n\n这是修订后的完整译文。\n\n## 二、逐条批注\n\n- [误译] 原文A → 改为「新译A」：理由A\n- [漏译] 原文B → 改为「新译B」：理由B\n- [术语不一致] 原文C → 改为「新译C」：理由C\n\n## 三、术语与争议点延伸\n\n无\n';
      const chunk = JSON.stringify({ choices: [{ delta: { content } }] });
      await r.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: 'data: ' + chunk + '\n\ndata: [DONE]\n\n' });
    } else {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
    }
  });

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.TransProof.fill({ apiKey: 'sk-test', baseUrl: 'http://mock.local/v1' }));

  console.log('===== P0 双阶段 + 错误分类 + 一键修改 + 看板链接 =====');

  await T('阶段切换：3 个按钮 + 切换 STAGE', async () => {
    const r = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('#stage-seg .stage-btn')].map(b => b.dataset.stage);
      document.querySelector('#stage-seg [data-stage="pass1"]').click();
      return { btns, stage: STAGE, hint: document.querySelector('#stage-hint').textContent };
    });
    if (r.btns.join(',') !== 'full,pass1,pass2') throw new Error('阶段按钮不全: ' + r.btns.join(','));
    if (r.stage !== 'pass1') throw new Error('STAGE 未切换: ' + r.stage);
    if (!r.hint.includes('硬伤')) throw new Error('阶段提示错误: ' + r.hint);
    await page.evaluate(() => { STAGE = 'full'; document.querySelector('#stage-seg [data-stage="full"]').click(); });
  });

  await T('错误分类：解析统计 + chips 渲染 + 点击筛选高亮', async () => {
    await page.evaluate(() => {
      LAST_OUT = '## 一、修订后译文\n\n译文。\n\n## 二、逐条批注\n\n- [误译] A → 改为「B」：理由\n- [漏译] C → 改为「D」：理由\n- [误译] E → 改为「F」：理由\n';
      document.querySelector('#out').innerHTML = md(LAST_OUT);
      markErrorLines();
      renderErrorFilter(LAST_OUT);
      renderPostBar();
    });
    const r = await page.evaluate(() => {
      const chips = [...document.querySelectorAll('#err-filter .ef-chip')].map(c => c.textContent);
      return { chips, barShown: document.querySelector('#post-bar').style.display };
    });
    if (r.barShown !== 'flex') throw new Error('post-bar 应显示，实际 ' + r.barShown);
    if (!r.chips.some(c => c.includes('误译 2'))) throw new Error('误译应统计 2 次: ' + r.chips.join('|'));
    if (!r.chips.some(c => c.includes('漏译 1'))) throw new Error('漏译应统计 1 次: ' + r.chips.join('|'));
    // 点「误译」chip → 误译 li 高亮，漏译 li 淡化
    await page.evaluate(() => {
      [...document.querySelectorAll('#err-filter .ef-chip')].find(c => c.dataset.ef === '误译').click();
    });
    const hl = await page.evaluate(() => [...document.querySelectorAll('#out li')].map(li => ({ err: li.dataset.err, op: li.style.opacity })));
    const wuyi = hl.filter(x => x.err === '误译');
    const louyi = hl.filter(x => x.err === '漏译');
    if (wuyi.length !== 2 || wuyi.some(x => x.op !== '1')) throw new Error('误译应全部高亮');
    if (louyi.length !== 1 || louyi[0].op !== '0.3') throw new Error('漏译应淡化');
    console.log('      分类：' + r.chips.join('，'));
  });

  await T('一校→二校一键接力', async () => {
    await page.evaluate(() => { STAGE = 'pass1'; renderStageNext(); renderPostBar(); });
    const r = await page.evaluate(() => ({ hasBtn: !!document.querySelector('#btn-pass2'), shown: document.querySelector('#post-bar').style.display }));
    if (!r.hasBtn) throw new Error('缺少"进入二校"按钮');
    // 点击后 STAGE 应变 pass2（会触发 run，run 走 mock）
    await page.evaluate(() => { STAGE = 'pass1'; document.querySelector('#btn-pass2').click(); });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => STAGE);
    if (after !== 'pass2') throw new Error('接力后 STAGE 应为 pass2，实际 ' + after);
    await page.evaluate(() => { STAGE = 'full'; });
  });

  await T('术语体检：conflict 一键按术语库统一并重校', async () => {
    await page.evaluate(() => {
      TERMS = [{ src: 'hegemony', dst: '霸权' }];
      LAST_OUT = '## 一、修订后译文\n\n本文用"支配"译该概念。';
      document.querySelector('#src').value = 'The hegemony concept is central.';
      document.querySelector('#btn-audit').click();
    });
    await page.waitForFunction(() => !!document.querySelector('#audit-unify'), { timeout: 5000 });
    const before = await page.evaluate(() => ({ hasUnify: !!document.querySelector('#audit-unify'), extra: document.querySelector('#extra').value }));
    if (!before.hasUnify) throw new Error('缺少"一键统一"按钮');
    await page.evaluate(() => document.querySelector('#audit-unify').click());
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      extra: document.querySelector('#extra').value,
      modalOpen: document.querySelector('#modal').classList.contains('on'),
    }));
    if (!after.extra.includes('hegemony → 霸权')) throw new Error('extra 未写入统一指令: ' + after.extra);
    if (after.modalOpen) throw new Error('统一后应关闭弹窗');
  });

  await T('看板链接：设当前任务 + 校对后自动同步 proof', async () => {
    const r = await page.evaluate(() => {
      PROJECT = { name: '测试项目', currentId: null, tasks: [{ id: 't1', name: '翻译某章', owner: '张三', status: 'translating', updatedAt: Date.now() }] };
      PROJECT.currentId = 't1';
      saveProject();
      renderProject();
      // 模拟校对完成同步
      const text = '## 一、修订后译文\n\n译文。\n\n## 二、逐条批注\n\n- [误译] A → 改为「B」：理由\n';
      syncToProject(text, '译文');
      return {
        proof: PROJECT.tasks[0].proof,
        badges: document.querySelectorAll('#proj-list .proof-badge').length,
        curMark: document.querySelectorAll('#proj-list .cur-task').length,
      };
    });
    if (!r.proof) throw new Error('任务未写入 proof');
    if (!r.proof.errors || r.proof.errors['误译'] !== 1) throw new Error('errors 统计错误: ' + JSON.stringify(r.proof.errors));
    if (r.proof.stage !== 'full') throw new Error('stage 记录错误: ' + r.proof.stage);
    if (r.badges < 1) throw new Error('看板未渲染 proof 徽章');
    if (r.curMark !== 1) throw new Error('当前任务未高亮');
    console.log('      proof: stage=' + r.proof.stage + ', 误译=' + r.proof.errors['误译'] + ', 术语冲突=' + (r.proof.termAudit ? r.proof.termAudit.conflict : 0));
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
