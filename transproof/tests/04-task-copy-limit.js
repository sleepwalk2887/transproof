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

  console.log('===== 需求2：原文字数上限可配置 =====');
  await T('设置页有字数输入框 + 预设按钮', async () => {
    await page.click('nav button[data-page="p-set"]');
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => ({
      hasInput: !!document.querySelector('#maxInChars'),
      presetCount: document.querySelectorAll('[data-preset-chars]').length,
    }));
    if (!r.hasInput) throw new Error('缺少 #maxInChars 输入框');
    if (r.presetCount < 4) throw new Error('字数预设按钮不足 4 个');
  });

  await T('点预设 20 万 → CFG.maxInChars 更新', async () => {
    await page.evaluate(() => document.querySelector('[data-preset-chars="200000"]').click());
    const r = await page.evaluate(() => ({ val: CFG.maxInChars, input: document.querySelector('#maxInChars').value }));
    if (r.val !== 200000) throw new Error('CFG.maxInChars 未更新: ' + r.val);
    if (r.input !== '200000') throw new Error('输入框未同步: ' + r.input);
  });

  console.log('\n===== 需求3：复制结果可选段落 =====');
  await T('点复制弹出段落勾选框', async () => {
    await page.click('nav button[data-page="p-work"]');
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      LAST_OUT = '## 一、修订后译文\n\n这是修订后的完整译文。\n\n## 二、逐条批注\n\n- 原文片段 → 改为新译：理由。\n\n## 四、注释建议\n\n建议加注：某处。';
      document.querySelector('#btn-copy').click();
    });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      modalOn: document.querySelector('#modal').classList.contains('on'),
      secCount: document.querySelectorAll('.copy-sec').length,
      hasCore: !!document.querySelector('#copy-core'),
    }));
    if (!r.modalOn) throw new Error('复制选项弹窗未打开');
    if (r.secCount !== 3) throw new Error('应识别 3 段，实际 ' + r.secCount);
    if (!r.hasCore) throw new Error('缺少「仅修订后译文」快捷按钮');
  });

  await T('仅复制修订后译文（排除批注与注释）', async () => {
    await page.evaluate(() => {
      // mock 剪贴板以捕获复制内容
      window.__copied = '';
      navigator.clipboard.writeText = async (t) => { window.__copied = t; };
      document.querySelector('#copy-core').click();   // 仅勾选修订后译文
      document.querySelector('#copy-do').click();     // 复制
    });
    await page.waitForTimeout(300);
    const copied = await page.evaluate(() => window.__copied);
    if (!copied.includes('这是修订后的完整译文')) throw new Error('未复制译文内容');
    if (copied.includes('逐条批注') || copied.includes('建议加注')) throw new Error('错误地复制了批注/注释');
    await page.evaluate(() => closeModal());
    console.log('      复制内容：' + copied.slice(0, 30) + '…');
  });

  console.log('\n===== 需求1：任务记忆/断点续传 =====');
  await T('saveTask 写入快照，restoreTask 恢复', async () => {
    await page.evaluate(() => {
      $('#src').value = '这是上次的原文内容。';
      $('#dst').value = '这是上次的译文。';
      LAST_OUT = '## 一、修订后译文\n\n上次的校对结果。';
      saveTask();
    });
    const saved = await page.evaluate(() => localStorage.getItem('tp.task'));
    if (!saved || !saved.includes('这是上次的原文内容')) throw new Error('快照未保存或内容缺失');
    // 清空后恢复
    await page.evaluate(() => {
      $('#src').value = ''; $('#dst').value = ''; LAST_OUT = '';
      restoreTask(JSON.parse(localStorage.getItem('tp.task')));
    });
    const r = await page.evaluate(() => ({
      src: $('#src').value,
      dst: $('#dst').value,
      outRestored: document.querySelector('#out').textContent.includes('上次的校对结果'),
    }));
    if (r.src !== '这是上次的原文内容。') throw new Error('原文未恢复');
    if (r.dst !== '这是上次的译文。') throw new Error('译文未恢复');
    if (!r.outRestored) throw new Error('输出未恢复');
    // 清理快照，避免影响后续测试
    await page.evaluate(() => localStorage.removeItem('tp.task'));
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
