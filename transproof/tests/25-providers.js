/* 25: 服务商预设下拉（v4.23.0 P2 多模型）
   覆盖：选项由 PROVIDERS 动态生成、分组 optgroup、MiMo 等新预设、
   选中即回填 baseUrl/model、自定义项 value='custom' 的两个历史 bug 修复。 */
const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.log('  ❌ ' + label + (extra !== undefined ? '  → ' + extra : '')); }
};

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true, args: ['--no-sandbox']
  });
  const page = await (await browser.newContext()).newPage();
  const consErr = [], pageErr = [];
  page.on('console', m => { if (m.type() === 'error') consErr.push(m.text()); });
  page.on('pageerror', e => pageErr.push(String(e.message || e)));

  try {
    await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.TransProof && typeof fillCfg === 'function');

    console.log('===== 1) 选项生成与分组 =====');
    const gen = await page.evaluate(() => ({
      optCount: document.querySelectorAll('#provider option').length,
      provCount: PROVIDERS.length,
      groups: Array.from(document.querySelectorAll('#provider optgroup')).map(g => g.label),
      first: (document.querySelector('#provider option') || {}).textContent,
      last: (Array.from(document.querySelectorAll('#provider option')).pop() || {}).value
    }));
    ok(gen.optCount === gen.provCount + 1, '选项数 = PROVIDERS + 自定义', gen.optCount + ' vs ' + gen.provCount);
    ok(gen.groups.length === 3, '3 个 optgroup 分组', JSON.stringify(gen.groups));
    ok(/国内主流/.test(gen.groups[0]) && /海外/.test(gen.groups[1]) && /聚合/.test(gen.groups[2]),
      '分组名 = 国内 / 海外 / 聚合', JSON.stringify(gen.groups));
    ok(/DeepSeek/.test(gen.first), '首项 DeepSeek（默认选中）', gen.first);
    ok(gen.last === 'custom', "末项自定义 value='custom'", gen.last);

    console.log('===== 2) MiMo 等新预设 =====');
    const mimo = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#provider option'))
        .filter(o => /xiaomimimo|mimo/i.test(o.value))
        .map(o => o.value + ' :: ' + o.textContent));
    console.log('  ' + mimo.join('\n  '));
    ok(mimo.length === 2, 'MiMo 两条预设（flash + pro）', mimo.length);
    ok(mimo.some(v => v.includes('api.xiaomimimo.com/v1|mimo-v2.6-flash')), 'MiMo flash base_url 正确');
    ok(mimo.some(v => v.includes('api.xiaomimimo.com/v1|mimo-v2.6-pro')), 'MiMo pro base_url 正确');
    const total = await page.evaluate(() => PROVIDERS.length);
    ok(total >= 20, '预设总量 ≥20（市面主流覆盖）', total);

    console.log('===== 3) 选中即回填 baseUrl/model =====');
    const fill = await page.evaluate(() => {
      const sel = document.querySelector('#provider');
      const flash = Array.from(sel.options).find(o => o.value.includes('mimo-v2.6-flash'));
      sel.value = flash.value;
      sel.dispatchEvent(new Event('change'));
      return { base: document.querySelector('#baseUrl').value, model: document.querySelector('#model').value };
    });
    ok(fill.base === 'https://api.xiaomimimo.com/v1', '回填 baseUrl = MiMo 端点', fill.base);
    ok(fill.model === 'mimo-v2.6-flash', '回填 model = mimo-v2.6-flash', fill.model);

    console.log('===== 4) 自定义项两处 bug 修复 =====');
    const cust = await page.evaluate(() => {
      const sel = document.querySelector('#provider');
      document.querySelector('#baseUrl').value = 'https://keep.me/v1';
      document.querySelector('#model').value = 'keep-model';
      sel.value = 'custom';
      sel.dispatchEvent(new Event('change'));
      return { base: document.querySelector('#baseUrl').value, model: document.querySelector('#model').value };
    });
    ok(cust.base === 'https://keep.me/v1' && cust.model === 'keep-model',
      '选「自定义」不再覆盖输入框（4.22.0 前会填成字面 custom）', JSON.stringify(cust));
    const rt = await page.evaluate(() => {
      CFG.baseUrl = 'https://api.deepseek.com'; CFG.model = 'deepseek-reasoner';
      fillCfg();
      const matched = document.querySelector('#provider').value;
      CFG.baseUrl = 'https://my.custom.io/v1'; CFG.model = 'my-model';
      fillCfg();
      const fallback = document.querySelector('#provider').value;
      return { matched, fallback };
    });
    ok(rt.matched.includes('deepseek-reasoner'), 'fillCfg 能回显已存预设', rt.matched);
    ok(rt.fallback === 'custom', '未知配置回显为 custom', rt.fallback);

    console.log('===== 5) 帮助文案 =====');
    // 设置页默认隐藏，innerText 取不到 → 用 textContent
    const help = await page.evaluate(() => document.body.textContent);
    ok(/小米 MiMo/.test(help), '帮助文案提到小米 MiMo');

    console.log('===== 6) 错误汇总 =====');
    const consErrF = consErr.filter(t => !/Failed to load resource/.test(t));
    console.log('  console errors: ' + consErrF.length + ' | page errors: ' + pageErr.length);
    ok(consErrF.length === 0, '0 console error', consErrF[0]);
    ok(pageErr.length === 0, '0 page error', pageErr[0]);
  } catch (e) {
    fail++;
    console.log('  ❌ FATAL: ' + (e && e.message ? e.message : e));
  }
  console.log('\n===== 汇总 =====');
  console.log('通过: ' + pass + '  失败: ' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
