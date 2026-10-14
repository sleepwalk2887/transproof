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

  console.log('===== 项目进度看板 =====');
  await T('页签存在且可切换到项目进度', async () => {
    await page.click('nav button[data-page="p-project"]');
    await page.waitForTimeout(250);
    const visible = await page.evaluate(() => getComputedStyle(document.querySelector('#p-project')).display !== 'none');
    if (!visible) throw new Error('项目进度页未显示');
  });

  await T('添加任务 + 状态切换 + 进度更新', async () => {
    await page.evaluate(() => { PROJECT = { name: '', tasks: [] }; renderProject(); });
    // 添加两个任务
    await page.fill('#task-name', '第一章翻译');
    await page.fill('#task-owner', '小明');
    await page.click('#task-add');
    await page.fill('#task-name', '第二章校对');
    await page.click('#task-add');
    await page.waitForTimeout(200);
    let r = await page.evaluate(() => ({
      count: PROJECT.tasks.length,
      rows: document.querySelectorAll('#proj-list .mini-status').length,
      bar: document.querySelector('#proj-bar').style.width,
    }));
    if (r.count !== 2) throw new Error('任务数应为 2，实际 ' + r.count);
    if (r.rows !== 8) throw new Error('状态按钮应为 2×4=8，实际 ' + r.rows);
    if (r.bar !== '0%') throw new Error('初始进度应为 0%');
    // 把第一个任务切成「已完成」
    await page.evaluate(() => {
      const b = document.querySelectorAll('#proj-list [data-i="0"]')[0];
      document.querySelector('#proj-list [data-i="0"][data-s="done"]').click();
    });
    await page.waitForTimeout(200);
    r = await page.evaluate(() => ({
      st: PROJECT.tasks[0].status,
      done: PROJECT.tasks.filter(t => t.status === 'done').length,
      bar: document.querySelector('#proj-bar').style.width,
      stat: document.querySelector('#proj-stat').textContent,
    }));
    if (r.st !== 'done') throw new Error('第一任务状态应为 done');
    if (r.done !== 1) throw new Error('已完成应 1，实际 ' + r.done);
    if (r.bar !== '50%') throw new Error('进度应为 50%，实际 ' + r.bar);
    if (!r.stat.includes('已完成 1')) throw new Error('统计未更新: ' + r.stat);
    console.log('      2 任务，1 完成 → 进度 ' + r.bar);
  });

  await T('删除任务', async () => {
    await page.evaluate(() => { document.querySelector('#proj-list [data-del="1"]').click(); });
    await page.waitForTimeout(200);
    const cnt = await page.evaluate(() => PROJECT.tasks.length);
    if (cnt !== 1) throw new Error('删除后应剩 1 任务，实际 ' + cnt);
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
