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

  console.log('===== 段落对齐体检（M3 / T-011）=====');

  await T('段落对齐按钮存在（🧰 工具组）', async () => {
    const r = await page.evaluate(() => !!document.querySelector('#btn-para-audit'));
    if (!r) throw new Error('缺少 #btn-para-audit 按钮');
  });

  await T('旧按钮一个没动（btn-audit / btn-view-doc / btn-view-tri）', async () => {
    const r = await page.evaluate(() => ({
      audit: !!document.querySelector('#btn-audit'),
      doc: !!document.querySelector('#btn-view-doc'),
      tri: !!document.querySelector('#btn-view-tri'),
    }));
    if (!r.audit) throw new Error('术语体检按钮丢失');
    if (!r.doc || !r.tri) throw new Error('三栏对照切换按钮丢失');
  });

  await T('paraAudit：段数相等 → equal', async () => {
    const r = await page.evaluate(() => paraAudit('第一段甲\n\n第二段乙\n\n第三段丙', '第一段译文\n\n第二段译文\n\n第三段译文'));
    if (r.status !== 'equal') throw new Error('status 应为 equal，实际 ' + r.status);
    if (r.srcN !== 3 || r.dstN !== 3) throw new Error('段数应为 3/3，实际 ' + r.srcN + '/' + r.dstN);
    if (r.diff !== 0) throw new Error('diff 应为 0，实际 ' + r.diff);
    if (r.missing.length || r.extra.length || r.blanks.length) throw new Error('equal 态不应有问题行');
  });

  await T('paraAudit：译文缺段 → short + 位置', async () => {
    const r = await page.evaluate(() => paraAudit('第一段甲\n\n第二段乙\n\n第三段丙', '第一段译文\n\n第二段译文'));
    if (r.status !== 'short') throw new Error('status 应为 short，实际 ' + r.status);
    if (r.diff !== -1) throw new Error('diff 应为 -1，实际 ' + r.diff);
    if (r.missing.length !== 1) throw new Error('missing 应为 1 行，实际 ' + r.missing.length);
    if (r.missing[0].i !== 3) throw new Error('缺段位置应为第 3 段，实际 ' + (r.missing[0] && r.missing[0].i));
    if (r.missing[0].src.indexOf('第三段丙') < 0) throw new Error('missing 行没带原文内容: ' + r.missing[0].src);
  });

  await T('paraAudit：译文多段 → long + 位置', async () => {
    const r = await page.evaluate(() => paraAudit('第一段甲\n\n第二段乙', '第一段译文\n\n第二段译文\n\n第三段译文'));
    if (r.status !== 'long') throw new Error('status 应为 long，实际 ' + r.status);
    if (r.diff !== 1) throw new Error('diff 应为 +1，实际 ' + r.diff);
    if (r.extra.length !== 1) throw new Error('extra 应为 1 行，实际 ' + r.extra.length);
    if (r.extra[0].i !== 3) throw new Error('多段位置应为第 3 段，实际 ' + (r.extra[0] && r.extra[0].i));
    if (r.extra[0].dst.indexOf('第三段译文') < 0) throw new Error('extra 行没带译文内容: ' + r.extra[0].dst);
  });

  await T('paraAudit：译文中夹空段 → blanks 标位', async () => {
    const r = await page.evaluate(() => paraAudit('第一段甲\n\n第二段乙\n\n第三段丙', '第一段译文\n\n \n\n第二段译文'));
    if (r.blanks.indexOf(2) < 0) throw new Error('blanks 应含第 2 段，实际 ' + JSON.stringify(r.blanks));
    if (r.status !== 'short') throw new Error('空段应计为缺段，status=' + r.status);
  });

  await T('showParaAudit：缺段面板标出位置', async () => {
    await page.evaluate(() => {
      LAST_OUT = '';
      document.querySelector('#src').value = '第一段甲\n\n第二段乙\n\n第三段丙';
      document.querySelector('#dst').value = '第一段译文\n\n第二段译文';
      document.querySelector('#btn-para-audit').click();
    });
    await page.waitForFunction(() => !!document.querySelector('#para-close'), { timeout: 5000 });
    const info = await page.evaluate(() => ({
      title: document.querySelector('#mTitle').textContent,
      body: document.querySelector('#mBody').innerText,
      open: document.querySelector('#modal').classList.contains('on'),
    }));
    if (!info.open) throw new Error('面板未打开');
    if (info.title.indexOf('段落对齐') < 0) throw new Error('标题错误: ' + info.title);
    if (info.body.indexOf('原文第 3 段') < 0) throw new Error('未标出缺段位置: ' + info.body.slice(0, 200));
    if (info.body.indexOf('少 1 段') < 0) throw new Error('未显示缺段数: ' + info.body.slice(0, 200));
    if (info.body.indexOf('不花 token') < 0) throw new Error('缺少零 token 说明');
    console.log('      ' + info.body.split('\n').slice(0, 3).join(' / '));
  });

  await T('showParaAudit：相等面板显示通过 + 关闭按钮可用', async () => {
    await page.evaluate(() => {
      LAST_OUT = '';
      document.querySelector('#src').value = '第一段甲\n\n第二段乙\n\n第三段丙';
      document.querySelector('#dst').value = '第一段译文\n\n第二段译文\n\n第三段译文';
      document.querySelector('#btn-para-audit').click();
    });
    await page.waitForFunction(() => !!document.querySelector('#para-close'), { timeout: 5000 });
    const info = await page.evaluate(() => ({
      body: document.querySelector('#mBody').innerText,
      ok: !!document.querySelector('.alert.ok'),
    }));
    if (!info.ok) throw new Error('相等态应显示通过提示');
    if (info.body.indexOf('逐段一一对应') < 0) throw new Error('缺少对齐文案: ' + info.body.slice(0, 200));
    await page.evaluate(() => document.querySelector('#para-close').click());
    await page.waitForTimeout(200);
    const still = await page.evaluate(() => document.querySelector('#modal').classList.contains('on'));
    if (still) throw new Error('点关闭后弹窗应关闭');
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
