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

  console.log('===== 明暗主题 + 自定义主题色 =====');

  await T('主题按钮 + 设置页选项 + 色块存在', async () => {
    const r = await page.evaluate(() => ({
      toggle: !!document.querySelector('#themeToggle'),
      opts: [...document.querySelectorAll('.theme-opt')].map(b => b.dataset.themeMode),
      swatches: document.querySelectorAll('.accent-swatch').length,
      picker: !!document.querySelector('#accentPicker'),
    }));
    if (!r.toggle) throw new Error('缺少主题切换按钮');
    if (r.opts.join(',') !== 'auto,dark,light') throw new Error('主题选项不全: ' + r.opts.join(','));
    if (r.swatches < 6) throw new Error('主题色块不足: ' + r.swatches);
    if (!r.picker) throw new Error('缺少自定义颜色选择器');
  });

  await T('浅色/深色切换：data-theme 与背景色变化', async () => {
    await page.evaluate(() => setTheme('light'));
    const light = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor }));
    if (light.theme !== 'light') throw new Error('data-theme 应为 light: ' + light.theme);
    const m1 = light.bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!m1 || (+m1[1] + +m1[2] + +m1[3]) < 600) throw new Error('浅色背景偏暗: ' + light.bg);
    await page.evaluate(() => setTheme('dark'));
    const dark = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor }));
    if (dark.theme !== 'dark') throw new Error('data-theme 应为 dark: ' + dark.theme);
    const m2 = dark.bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!m2 || (+m2[1] + +m2[2] + +m2[3]) > 300) throw new Error('深色背景偏亮: ' + dark.bg);
    console.log('      浅色 bg=' + light.bg + '，深色 bg=' + dark.bg);
  });

  await T('状态色变量随主题切换（--warn-tx 等）', async () => {
    await page.evaluate(() => setTheme('light'));
    const lt = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--warn-tx').trim());
    await page.evaluate(() => setTheme('dark'));
    const dt = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--warn-tx').trim());
    if (lt === dt) throw new Error('深浅主题 --warn-tx 应不同');
    if (!lt) throw new Error('浅色 warn-tx 为空');
  });

  await T('自动模式：跟随系统配色', async () => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.evaluate(() => setTheme('auto'));
    const light = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => applyTheme());
    const dark = await page.evaluate(() => document.documentElement.dataset.theme);
    if (light !== 'light') throw new Error('系统浅色时自动应 light: ' + light);
    if (dark !== 'dark') throw new Error('系统深色时自动应 dark: ' + dark);
    await page.emulateMedia({ colorScheme: 'dark' });
  });

  await T('自定义主题色：点色块 → --ac 更新 + 持久化', async () => {
    await page.evaluate(() => document.querySelector('.accent-swatch[data-hex="#e24b4a"]').click());
    const r = await page.evaluate(() => ({
      ac: getComputedStyle(document.documentElement).getPropertyValue('--ac').trim(),
      saved: load('tp.accent'),
    }));
    if (!r.ac.toLowerCase().includes('e24b4a')) throw new Error('--ac 未更新: ' + r.ac);
    if ((r.saved || '').toLowerCase() !== '#e24b4a') throw new Error('accent 未持久化: ' + r.saved);
    await page.evaluate(() => applyAccent('#4f8cff'));
  });

  await T('主题持久化：刷新后保持', async () => {
    await page.evaluate(() => setTheme('dark'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const r = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, saved: load('tp.theme') }));
    if (r.theme !== 'dark' || r.saved !== 'dark') throw new Error('刷新后主题应保持 dark: ' + r.theme + '/' + r.saved);
    await page.evaluate(() => setTheme('auto'));
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
