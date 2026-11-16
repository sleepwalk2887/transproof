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

  // 1. 导出 + 按钮 + 旧锚点
  t('sqaRun 导出', await page.evaluate(() => typeof window.sqaRun === 'function'));
  t('sqaSampleIndices 导出', await page.evaluate(() => typeof window.sqaSampleIndices === 'function'));
  t('sqaParse 导出', await page.evaluate(() => typeof window.sqaParse === 'function'));
  t('#btn-sample 存在', await page.evaluate(() => !!document.getElementById('btn-sample')));
  t('旧锚点 #btn-score 未动', await page.evaluate(() => !!document.getElementById('btn-score')));
  t('旧锚点 #btn-ask 未动', await page.evaluate(() => !!document.getElementById('btn-ask')));
  t('旧锚点 #btn-pnoun 未动', await page.evaluate(() => !!document.getElementById('btn-pnoun')));
  t('APP_VERSION 三段式', await page.evaluate(() => typeof APP_VERSION === 'string' && APP_VERSION.split('.').length === 3));

  // 2. 抽样步长边界
  const idx = await page.evaluate(() => ({
    a30: sqaSampleIndices(30).length,       // <50 全查 = 30
    a10: sqaSampleIndices(10).length,       // <50 全查 = 10
    a100: sqaSampleIndices(100).length,     // 10% = 10（5~30 内）
    a1000: sqaSampleIndices(1000).length,   // 10% = 100 → clamp 30
    a200: sqaSampleIndices(200).length,     // 10% = 20（5~30 内）
    a5000: sqaSampleIndices(5000).length    // 10% = 500 → clamp 30
  }));
  t('<50 全查（30 句）', idx.a30 === 30);
  t('<50 全查（10 句）', idx.a10 === 10);
  t('100 句抽 10', idx.a100 === 10);
  t('200 句抽 20', idx.a200 === 20);
  t('1000 句夹到 30', idx.a1000 === 30);
  t('5000 句夹到 30', idx.a5000 === 30);

  // 3. 抽样索引无重复且升序
  const dedup = await page.evaluate(() => { const a = sqaSampleIndices(1000); let ok = true; for(let i=1;i<a.length;i++){ if(a[i] <= a[i-1]) ok = false; } return ok; });
  t('索引去重且升序', dedup);

  // 4. sqaParse：剥围栏 + 坏行跳过
  const p1 = await page.evaluate(() => sqaParse('```json\n[{"idx":1,"verdict":"bad","reason":"漏译"},{"idx":2,"verdict":"ok","reason":""}]\n```'));
  t('剥围栏解析 2 条', p1.length === 2 && p1[0].verdict === 'bad' && p1[1].verdict === 'ok');
  const p2 = await page.evaluate(() => sqaParse('[{"idx":1,"verdict":"bad","reason":"x"},{"idx":2,"verdict":BROKEN}]'));
  t('坏行跳过救回 1 条', p2.length === 1 && p2[0].idx === 1);
  const p3 = await page.evaluate(() => sqaParse('not json at all'));
  t('纯垃圾返回空数组', Array.isArray(p3) && p3.length === 0);

  // 5. sqaRun 恰 1 次 LLM 调用（mock callModelSimple）
  const calls = await page.evaluate(async () => {
    let n = 0;
    const orig = window.callModelSimple;
    window.callModelSimple = async () => { n++; return { text: '[{"idx":1,"verdict":"bad","reason":"误译"}]' }; };
    LAST_OUT = '## 一、修订后译文\n这是第一句。这是第二句。这是第三句。\n## 二、批注';
    const srcEl = document.getElementById('src');
    if(srcEl) srcEl.value = 'First sentence. Second sentence. Third sentence.';
    await window.sqaRun(document.getElementById('btn-sample'));
    window.callModelSimple = orig;
    return n;
  });
  t('sqaRun 恰 1 次调用', calls === 1);

  t('无页面错误', errors.length === 0);
  console.log('PASS=' + pass + ' FAIL=' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
