const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(600);
  let pass = 0, fail = 0;
  const t = (name, cond) => { if(cond){ pass++; } else { fail++; console.log('FAIL ' + name); } };

  // 1. 导出 + 旧锚点
  t('waiverAll 导出', await page.evaluate(() => typeof window.waiverAll === 'function'));
  t('waiverAdd 导出', await page.evaluate(() => typeof window.waiverAdd === 'function'));
  t('waiverHas 导出', await page.evaluate(() => typeof window.waiverHas === 'function'));
  t('waiverCount 导出', await page.evaluate(() => typeof window.waiverCount === 'function'));
  t('waiverOpen 导出', await page.evaluate(() => typeof window.waiverOpen === 'function'));
  t('旧锚点 #btn-pnoun 未动', await page.evaluate(() => !!document.getElementById('btn-pnoun')));
  t('旧锚点 #ao-pnoun 未动', await page.evaluate(() => !!document.getElementById('ao-pnoun')));
  t('旧锚点 #btn-ask 未动', await page.evaluate(() => !!document.getElementById('btn-ask')));
  t('APP_VERSION 三段式', await page.evaluate(() => typeof APP_VERSION === 'string' && APP_VERSION.split('.').length === 3));

  // 2. 空理由禁止 + 登记
  const r1 = await page.evaluate(() => {
    localStorage.removeItem('tp.waiver');
    return {
      empty: waiverAdd('term', 'hello', ''),
      ok: waiverAdd('term', 'hello', '故意这么译'),
      has: waiverHas('term', 'hello'),
      count: waiverCount()
    };
  });
  t('空理由返回 false', r1.empty === false);
  t('非空理由返回 true', r1.ok === true);
  t('登记后 waiverHas 命中', r1.has === true);
  t('waiverCount = 1', r1.count === 1);

  // 3. termAudit conflict 过滤（用另一词 world，避免与已登记的 hello 混淆）
  const r2 = await page.evaluate(() => {
    TERMS = [{ src: 'world', dst: '世界' }];
    const before = termAudit('嗨 大地', 'world earth').conflict.length;
    waiverAdd('term', 'world', '有意保留');
    const after = termAudit('嗨 大地', 'world earth').conflict.length;
    return { before, after };
  });
  t('登记前 conflict=1', r2.before === 1);
  t('登记后 conflict=0（过滤生效）', r2.after === 0);

  // 4. proNounAudit 同名异译过滤
  const r3 = await page.evaluate(() => {
    const before = proNounAudit('张三（Foo）来了，李四（Foo）也来了', '').filter(x => x.t === '同名异译').length;
    waiverAdd('noun', 'foo', '两种译名都保留');
    const after = proNounAudit('张三（Foo）来了，李四（Foo）也来了', '').filter(x => x.t === '同名异译').length;
    return { before, after };
  });
  t('登记前同名异译=1', r3.before === 1);
  t('登记后同名异译=0（过滤生效）', r3.after === 0);

  // 5. askMarkdown 含豁免节
  const r4 = await page.evaluate(() => {
    const md = (typeof window.askMarkdown === 'function') ? window.askMarkdown() : '';
    return { hasSection: md.indexOf('五、豁免登记') >= 0, hasReason: md.indexOf('故意这么译') >= 0 };
  });
  t('疑问清单含「五、豁免登记」节', r4.hasSection === true);
  t('豁免节含理由', r4.hasReason === true);

  t('无页面错误', errors.length === 0);
  console.log('PASS=' + pass + ' FAIL=' + fail + ' TOTAL=' + (pass + fail));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
