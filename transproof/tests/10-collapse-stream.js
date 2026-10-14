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

  console.log('===== 流式节流 + 区块折叠 + 注释可粘贴格式 =====');

  await T('collapseSections：批注/注释折叠、主体不折叠', async () => {
    await page.evaluate(() => {
      LAST_OUT = '## 一、修订后译文\n\n这是修订后的完整译文。\n\n## 二、逐条批注\n\n- [误译] A → 改为「B」：理由\n- [漏译] C → 改为「D」：理由\n\n## 三、术语与争议点延伸\n\n无\n\n## 四、注释建议\n\n① 译名注："x"译为"y"。\n\n## 五、待确认事项\n\n无\n';
      document.querySelector('#out').innerHTML = md(LAST_OUT);
      collapseSections();
    });
    const r = await page.evaluate(() => ({
      details: [...document.querySelectorAll('#out details.sec-fold')].map(d => d.querySelector('summary').textContent),
      openCount: [...document.querySelectorAll('#out details.sec-fold')].filter(d => d.open).length,
      hasMainH4: [...document.querySelectorAll('#out h4')].some(h => h.textContent.includes('修订后译文')),
      bodyHasTrans: document.querySelector('#out').textContent.includes('这是修订后的完整译文'),
    }));
    if (r.details.length < 3) throw new Error('折叠块应 ≥3（批注/争议/注释/待确认），实际 ' + r.details.length);
    if (r.openCount !== 0) throw new Error('折叠块应默认收起，实际展开 ' + r.openCount + ' 个');
    if (!r.hasMainH4) throw new Error('「修订后译文」应保持主动显示（不折叠）');
    if (!r.bodyHasTrans) throw new Error('译文正文丢失');
    console.log('      折叠块：' + r.details.join('、'));
  });

  await T('错误分类点击自动展开对应折叠块', async () => {
    await page.evaluate(() => {
      LAST_OUT = '## 一、修订后译文\n\n译文。\n\n## 二、逐条批注\n\n- [误译] A → 改为「B」：理由\n';
      document.querySelector('#out').innerHTML = md(LAST_OUT);
      collapseSections();
      markErrorLines();
      renderErrorFilter(LAST_OUT);
      renderPostBar();
      // 点「误译」chip
      [...document.querySelectorAll('#err-filter .ef-chip')].find(c => c.dataset.ef === '误译').click();
    });
    const r = await page.evaluate(() => ({
      detailsOpen: [...document.querySelectorAll('#out details.sec-fold')].some(d => d.open),
    }));
    if (!r.detailsOpen) throw new Error('点错误分类后应自动展开折叠块');
  });

  await T('注释建议模板：可粘贴编号尾注格式', async () => {
    const note = await page.evaluate(() => TPL.note);
    if (!note.includes('编号尾注')) throw new Error('note 模板缺少"编号尾注"');
    if (!note.includes('①')) throw new Error('note 模板缺少编号格式 ①');
    if (!note.includes('宁缺毋滥')) throw new Error('note 模板缺少精简约束');
  });

  await T('流式渲染节流：超长文本降级纯文本（防崩溃）', async () => {
    const r = await page.evaluate(() => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      const render = makeStreamRenderer(el);
      const long = '译'.repeat(16000);
      render(long);
      return {
        hasFn: typeof makeStreamRenderer === 'function',
        textLen: el.textContent.length,
        innerLen: el.innerHTML.length,
        noCaret: !el.querySelector('.caret'),
      };
    });
    if (!r.hasFn) throw new Error('makeStreamRenderer 不存在');
    if (r.textLen !== 16000) throw new Error('超长文本应降级纯文本，实际长度 ' + r.textLen);
    if (!r.noCaret) throw new Error('纯文本流式不应有 caret（避免 Markdown 重渲染）');
    console.log('      超长文本降级 textContent，长度 ' + r.textLen);
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
