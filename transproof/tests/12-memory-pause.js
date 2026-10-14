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
      const content = '## 一、修订后译文\n\n续写后的译文。\n';
      const chunk = JSON.stringify({ choices: [{ delta: { content } }] });
      await r.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: 'data: ' + chunk + '\n\ndata: [DONE]\n\n' });
    } else {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }) });
    }
  });

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.TransProof.fill({ apiKey: 'sk-test', baseUrl: 'http://mock.local/v1' }));

  console.log('===== 进度条 + 暂停 + 精修 + 翻译记忆 =====');

  await T('进度条容器 + 暂停按钮存在', async () => {
    const r = await page.evaluate(() => ({
      progress: !!document.querySelector('#progress-wrap'),
      tsProgress: !!document.querySelector('#ts-progress-wrap'),
      pause: !!document.querySelector('#btn-pause'),
    }));
    if (!r.progress) throw new Error('缺少校对进度条');
    if (!r.tsProgress) throw new Error('缺少翻译进度条');
    if (!r.pause) throw new Error('缺少暂停按钮');
  });

  await T('进度条显示/更新/隐藏', async () => {
    const r = await page.evaluate(() => {
      showProgress();
      updateProgress(500, 1000);
      const mid = { disp: document.querySelector('#progress-wrap').style.display, w: document.querySelector('#progress-bar').style.width, txt: document.querySelector('#progress-txt').textContent };
      hideProgress();
      const after = document.querySelector('#progress-wrap').style.display;
      return { mid, after };
    });
    if (r.mid.disp !== 'flex') throw new Error('进度条应显示');
    if (r.mid.w !== '50%') throw new Error('进度应为 50%，实际 ' + r.mid.w);
    if (r.after !== 'none') throw new Error('进度条应隐藏');
  });

  await T('精修模式：depth=精修 输出"关键改动说明"', async () => {
    const sys = await page.evaluate(() => {
      document.querySelector('#depth').value = '精修';
      STAGE = 'full';
      document.querySelector('#src').value = '';
      document.querySelector('#dst').value = '待校对译文。';
      return buildSystem();
    });
    if (!sys.includes('关键改动说明')) throw new Error('精修模式应输出"关键改动说明"');
    if (sys.includes('## 二、逐条批注')) throw new Error('精修模式不应有全文逐条批注输出格式');
  });

  await T('翻译记忆：学习句对 + 匹配 + 注入提示词', async () => {
    const r = await page.evaluate(() => {
      TM = [];
      const src = 'The concept of hegemony is central here. Aufhebung is a key term.';
      const proof = '霸权概念在此处是核心。扬弃是一个关键术语。';
      const added = learnFromResult(src, proof);
      const hits = findMemoryMatches('The concept of hegemony is central here.');
      document.querySelector('#src').value = 'The concept of hegemony is central here.';
      const sys = buildSystem();
      return { added, hitCount: hits.length, hitSrc: hits[0] && hits[0].src, injected: sys.includes('历史定稿') && sys.includes('霸权概念') };
    });
    if (r.added !== 2) throw new Error('应学习 2 条句对，实际 ' + r.added);
    if (r.hitCount !== 1) throw new Error('应命中 1 条，实际 ' + r.hitCount);
    if (!r.injected) throw new Error('历史定稿未注入提示词');
    console.log('      学习 ' + r.added + ' 条，命中 ' + r.hitCount + ' 条，注入 ✓');
  });

  await T('翻译记忆：句数不等不配对（防错配）', async () => {
    const r = await page.evaluate(() => {
      TM = [];
      const added = learnFromResult('一句话而已。', '翻译成很长很长\n很多很多句。');
      return added;
    });
    if (r !== 0) throw new Error('句数不等应跳过学习，实际 ' + r);
  });

  await T('翻译记忆：UI 渲染 + 清空', async () => {
    await page.evaluate(() => { TM = [{ src: 'hegemony', dst: '霸权', ts: Date.now() }]; save(LS.memory, TM); renderMemory(); });
    const r = await page.evaluate(() => ({ count: document.querySelector('#tm-count').textContent, hasItem: document.querySelector('#tm-list').innerHTML.includes('霸权') }));
    if (!r.count.includes('1')) throw new Error('记忆条数显示错误: ' + r.count);
    if (!r.hasItem) throw new Error('记忆列表未渲染');
    await page.evaluate(() => document.querySelector('#tm-clear').click());
    const after = await page.evaluate(() => TM.length);
    if (after !== 0) throw new Error('清空后应为 0，实际 ' + after);
  });

  await T('暂停点击逻辑 + 续写', async () => {
    // 暂停：RUNNING=true 时点暂停 → PAUSE_REQUESTED
    await page.evaluate(() => { RUNNING = true; document.querySelector('#btn-pause').disabled = false; document.querySelector('#btn-pause').click(); });
    const pr = await page.evaluate(() => PAUSE_REQUESTED);
    if (!pr) throw new Error('暂停点击应置 PAUSE_REQUESTED');
    // 续写：预设 PAUSE，点继续
    await page.evaluate(() => {
      RUNNING = false; PAUSE_REQUESTED = false;
      PAUSE = { extOnly: false, full: '## 一、修订后译文\n\n已有内容', sys: 'sys', user: 'user', total: 100 };
      document.querySelector('#btn-pause').textContent = '▶ 继续';
      document.querySelector('#btn-pause').click();
    });
    await page.waitForFunction(() => LAST_OUT && LAST_OUT.includes('续写后的译文'), { timeout: 5000 });
    const after = await page.evaluate(() => ({ lastOut: LAST_OUT, pauseNull: PAUSE === null }));
    if (!after.pauseNull) throw new Error('续写完成后 PAUSE 应清空');
    if (!after.lastOut.includes('已有内容')) throw new Error('续写应保留原内容');
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
