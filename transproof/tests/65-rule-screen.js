const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://127.0.0.1:8123/index.html');
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const out = {};
    out.hasRuleScreen = typeof window.ruleScreen === 'function';
    out.hasShow = typeof window.showRuleScreen === 'function';
    out.appv = (typeof APP_VERSION === 'string' ? APP_VERSION : '');
    out.aoScreen = !!document.querySelector('#ao-screen');
    // 正例：重复标点
    const rp = window.ruleScreen('错了！！这里？？真的吗');
    out.rpTotal = rp.total;
    out.rpRule = rp.items.length ? rp.items[0].rule : '';
    // 反例：无重复标点
    const rp2 = window.ruleScreen('正常句子，没有连续标点。');
    out.rp2n = rp2.total;
    // 正例：数字单位粘连
    const nu = window.ruleScreen('重 3kg，长 5km，内存 2GB。');
    out.nuTotal = nu.total;
    out.nuRule = nu.items.some(x => x.rule === '数字单位粘连');
    // 反例：有空格 / 无字母单位
    const nu2 = window.ruleScreen('重 3 kg，长 5 km，占 10%，共 2024 年。');
    out.nu2n = nu2.total;
    // 空输入
    out.empty = window.ruleScreen('').total;
    // 旧锚点
    out.oldBtn = !!document.querySelector('#btn-pnoun') && !!document.querySelector('#btn-audit-center');
    return out;
  });
  let pass = 0, fail = 0;
  const ck = (name, cond) => { if (cond) { pass++; } else { fail++; console.log('FAIL ' + name); } };
  ck('ruleScreen 导出', r.hasRuleScreen);
  ck('showRuleScreen 导出', r.hasShow);
  ck('APP_VERSION 三段式', r.appv.split('.').length === 3);
  ck('#ao-screen 存在', r.aoScreen);
  ck('重复标点正例命中', r.rpTotal >= 2 && r.rpRule === '重复标点');
  ck('重复标点反例 0', r.rp2n === 0);
  ck('数字单位粘连正例命中', r.nuTotal >= 3 && r.nuRule);
  ck('数字单位粘连反例 0', r.nu2n === 0);
  ck('空输入 0', r.empty === 0);
  ck('旧锚点 #btn-pnoun #btn-audit-center 未动', r.oldBtn);
  ck('无页面错误', errors.length === 0);
  await browser.close();
  console.log(`PASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
