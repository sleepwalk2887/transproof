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

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  console.log('===== 改动对照视图（P1 · 零 token） =====');

  await T('按钮存在 + parseEdits 解析批注', async () => {
    const r = await page.evaluate(() => {
      const text = '## 一、修订后译文\n\n译文。\n\n## 二、逐条批注\n\n- [误译] **原文A** → 改为「新译A」：理由A\n- [漏译] **原文B** → 改为「新译B」：理由B\n\n## 三、术语与争议点延伸\n\n无\n';
      return { btn: !!document.querySelector('#btn-diff'), edits: parseEdits(text) };
    });
    if (!r.btn) throw new Error('缺少改动对照按钮');
    if (r.edits.length !== 2) throw new Error('应解析 2 条改动，实际 ' + r.edits.length);
    const a = r.edits[0];
    if (a.type !== '误译' || a.from !== '原文A' || a.to !== '新译A' || a.reason !== '理由A') throw new Error('第一条解析错误: ' + JSON.stringify(a));
    if (r.edits[1].type !== '漏译') throw new Error('第二条类型错误');
    console.log('      解析：' + r.edits.map(e => e.type + ':' + e.from + '→' + e.to).join('，'));
  });

  await T('showEditDiff：对照弹窗渲染 + 复制按钮', async () => {
    await page.evaluate(() => {
      LAST_OUT = '## 一、修订后译文\n\n译文。\n\n## 二、逐条批注\n\n- [误译] **原文A** → 改为「新译A」：理由A\n- [术语不一致] **原文B** → 改为「新译B」：理由B\n';
      showEditDiff();
    });
    const r = await page.evaluate(() => ({
      rows: document.querySelectorAll('.diff-row').length,
      copyBtns: document.querySelectorAll('.diff-copy').length,
      copyAll: !!document.querySelector('#diff-copyall'),
      fromHasLine: (() => { const el = document.querySelector('.diff-from'); return el && getComputedStyle(el).textDecorationLine.includes('line-through'); })(),
    }));
    if (r.rows !== 2) throw new Error('应渲染 2 行对照，实际 ' + r.rows);
    if (r.copyBtns !== 2) throw new Error('应 2 个复制按钮');
    if (!r.copyAll) throw new Error('缺少复制全部按钮');
    if (!r.fromHasLine) throw new Error('原译应有删除线');
    await page.evaluate(() => closeModal());
  });

  await T('无批注时提示', async () => {
    await page.evaluate(() => {
      LAST_OUT = '## 一、修订后译文\n\n纯译文，无批注。';
      const before = document.querySelector('#modal').classList.contains('on');
      window.__noDiffToast = '';
      // 直接调 showEditDiff，捕获 toast
      showEditDiff();
    });
    const r = await page.evaluate(() => ({ modalOpen: document.querySelector('#modal').classList.contains('on') }));
    // 无批注时不应打开对照弹窗（走了 toast 分支）
    if (r.modalOpen) throw new Error('无批注时不应打开对照弹窗');
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
