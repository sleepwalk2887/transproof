const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const fs = require('fs');

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

  console.log('===== 完整备份（迁移用） =====');

  await T('导出备份包含全部 14 类本地数据', async () => {
    // 设置所有 14 个 key
    await page.evaluate(() => {
      ['tp.cfg','tp.terms','tp.prefs','tp.history','tp.memory','tp.project','tp.prompts','tp.gloss','tp.task','tp.stage','tp.theme','tp.accent','tp.splash','tp.fb.log']
        .forEach((k, i) => localStorage.setItem(k, '值' + i));
    });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(() => document.querySelector('#btn-backup').click()),
    ]);
    const path = await download.path();
    const j = JSON.parse(fs.readFileSync(path, 'utf8'));
    if (j.v !== 2) throw new Error('备份版本应为 v2');
    const keys = Object.keys(j.data || {});
    const ALL = ['tp.cfg','tp.terms','tp.prefs','tp.history','tp.memory','tp.project','tp.prompts','tp.gloss','tp.task','tp.stage','tp.theme','tp.accent','tp.splash','tp.fb.log'];
    const missing = ALL.filter(k => !keys.includes(k));
    if (missing.length) throw new Error('备份缺少 key: ' + missing.join(','));
    console.log('      备份含 ' + keys.length + ' 个 key，完整 ✓');
  });

  await T('导入 v2 备份：完整写回全部数据', async () => {
    // 构造 v2 备份文件并上传
    const bak = { v: 2, data: { 'tp.cfg': '{"apiKey":"sk-migrated"}', 'tp.memory': '[{"src":"hegemony","dst":"霸权"}]', 'tp.theme': '"light"' } };
    const tmp = 'C:/Users/Andrew/.dsh/dsh_orb/transproof/_bak.json';
    fs.writeFileSync(tmp, JSON.stringify(bak));
    await page.setInputFiles('#bakFile', tmp);
    await page.waitForTimeout(1200); // 等 location.reload
    const r = await page.evaluate(() => ({
      cfg: localStorage.getItem('tp.cfg'),
      memory: localStorage.getItem('tp.memory'),
      theme: localStorage.getItem('tp.theme'),
    }));
    if (!r.cfg || !r.cfg.includes('sk-migrated')) throw new Error('cfg 未恢复: ' + r.cfg);
    if (!r.memory || !r.memory.includes('hegemony')) throw new Error('翻译记忆未恢复: ' + r.memory);
    if (r.theme !== '"light"') throw new Error('主题未恢复: ' + r.theme);
    fs.unlinkSync(tmp);
    console.log('      完整恢复 cfg/记忆/主题 ✓');
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
