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

  console.log('===== 术语一致性自动体检 =====');

  await T('体检按钮存在（校对工作台）', async () => {
    const r = await page.evaluate(() => !!document.querySelector('#btn-audit'));
    if (!r) throw new Error('缺少术语体检按钮');
  });

  await T('termAudit：术语库覆盖检查（used/conflict）', async () => {
    const r = await page.evaluate(() => {
      TERMS = [
        { src: 'hegemony', dst: '霸权' },
        { src: 'Aufhebung', dst: '扬弃' },
        { src: 'civil society', dst: '市民社会' },
      ];
      const text = '本文讨论霸权与扬弃，但用"支配"替代霸权。';
      const srcText = 'This text discusses hegemony and Aufhebung.';
      return termAudit(text, srcText);
    });
    if (r.used.length !== 2) throw new Error('used 应为 2（霸权、扬弃），实际 ' + r.used.length);
    if (r.conflict.length !== 0) throw new Error('conflict 应为 0，实际 ' + r.conflict.length);
    if (r.termTotal !== 3) throw new Error('termTotal 应为 3');
    console.log('      used=' + r.used.length + ', conflict=' + r.conflict.length + ', termTotal=' + r.termTotal);
  });

  await T('termAudit：原文有词但定稿未用术语库译法 → conflict', async () => {
    const r = await page.evaluate(() => {
      TERMS = [{ src: 'hegemony', dst: '霸权' }];
      const text = '本文通篇用"支配"来译该核心概念，前后皆如此。';
      const srcText = 'The concept of hegemony is central here.';
      return termAudit(text, srcText);
    });
    if (r.conflict.length !== 1) throw new Error('conflict 应为 1，实际 ' + r.conflict.length);
    if (r.conflict[0].src !== 'hegemony') throw new Error('conflict 词条错误: ' + r.conflict[0].src);
    if (r.conflict[0].dst !== '霸权') throw new Error('conflict 译法错误');
  });

  await T('termAudit：一词多译检测（中文（外文）标注）', async () => {
    const r = await page.evaluate(() => {
      TERMS = [];
      const text = 'representation（表象）与 representation（表征）混用；agency（能动性）与 agency（代理）也不统一。';
      return termAudit(text, '');
    });
    if (r.multi.length !== 2) throw new Error('multi 应为 2，实际 ' + r.multi.length);
    const words = r.multi.map(x => x.word.toLowerCase());
    if (!words.includes('representation')) throw new Error('应包含 representation');
    if (!words.includes('agency')) throw new Error('应包含 agency');
    const rep = r.multi.find(x => x.word.toLowerCase() === 'representation');
    if (!rep.cn.includes('表象') || !rep.cn.includes('表征')) throw new Error('representation 译法集错误: ' + rep.cn.join('/'));
    console.log('      多译词条：' + r.multi.map(x => x.word + ' → ' + x.cn.join('/')).join('，'));
  });

  await T('showTermAudit：弹窗展示 + 一键入术语库', async () => {
    await page.evaluate(() => {
      TERMS = [{ src: 'hegemony', dst: '霸权' }];
      LAST_OUT = '## 一、修订后译文\n\nrepresentation（表象）与 representation（表征）混用。';
      document.querySelector('#src').value = 'The hegemony concept.';
      document.querySelector('#btn-audit').click();
    });
    await page.waitForFunction(() => !!document.querySelector('#audit-close'), { timeout: 5000 });
    const before = await page.evaluate(() => ({
      multiCount: document.querySelectorAll('.audit-chips').length,
      importBtn: !!document.querySelector('#audit-import'),
      conflictCount: document.querySelectorAll('.seg').length,
    }));
    if (before.multiCount !== 1) throw new Error('应显示 1 个多译词条，实际 ' + before.multiCount);
    if (!before.importBtn) throw new Error('缺少"入术语库"按钮');
    // 点选第二个译法（表征），再入术语库
    await page.evaluate(() => {
      const chips = document.querySelectorAll('.audit-chips .dp-chip');
      chips[1].click();
      document.querySelector('#audit-import').click();
    });
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => ({
      terms: TERMS.map(t => t.src + '=' + t.dst),
      modalOpen: document.querySelector('#modal').classList.contains('on'),
    }));
    if (!after.terms.some(x => x === 'representation=表征')) throw new Error('未按选定译法入术语库: ' + after.terms.join(','));
    if (after.modalOpen) throw new Error('入术语库后应关闭弹窗');
    console.log('      术语库现含：' + after.terms.join('，'));
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
