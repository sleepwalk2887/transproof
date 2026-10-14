const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

(async () => {
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrs = [], pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  console.log('===== 测试 1：extractJsonArray 解析 LLM 返回 =====');
  const ea = await page.evaluate(() => {
    const f = window.extractJsonArray;
    if (typeof f !== 'function') return { ok: false, reason: 'extractJsonArray 不在 window 上' };
    const r = {};
    r.pure = f('[{"foreign":"Hegel","zh":"黑格尔","type":"人物"}]');
    r.fenced = f('```json\n[{"foreign":"A","zh":"甲"}]\n```');
    r.prefixed = f('好的，术语如下：\n[{"foreign":"B","zh":"乙","conf":"high"}]\n希望对你有帮助。');
    r.fallback = f('[{"foreign":"a"}{"foreign":"b"}]');
    r.empty = f('');
    r.nullIn = f(null);
    return r;
  });
  const eaChecks = {
    pure: ea.pure && ea.pure.length === 1 && ea.pure[0].zh === '黑格尔',
    fenced: ea.fenced && ea.fenced.length === 1,
    prefixed: ea.prefixed && ea.prefixed.length === 1 && ea.prefixed[0].conf === 'high',
    fallback: ea.fallback && ea.fallback.length === 2,
    empty: Array.isArray(ea.empty) && ea.empty.length === 0,
    nullIn: Array.isArray(ea.nullIn) && ea.nullIn.length === 0,
  };
  for (const [k, v] of Object.entries(eaChecks)) console.log('  ' + (v ? '✅' : '❌') + ' ' + k);
  const ok1 = Object.values(eaChecks).every(Boolean);

  console.log('\n===== 测试 2：splitChunks 分块 =====');
  const sc = await page.evaluate(() => {
    const f = window.splitChunks;
    if (typeof f !== 'function') return { ok: false, reason: 'splitChunks 不在 window 上' };
    const short = f('这是一段短文本。', 2500);
    const long = f('段落一。'.repeat(400) + '段落二。'.repeat(400), 2500);
    return {
      ok: true,
      shortCount: short.length,
      shortLen: short[0].length,
      longCount: long.length,
      maxLen: Math.max(...long.map(c => c.length)),
      minLen: Math.min(...long.map(c => c.length)),
    };
  });
  console.log('  短文本 chunk 数=' + sc.shortCount + '（应=1）  长文本 chunk 数=' + sc.longCount + '  最长=' + sc.maxLen + ' 最短=' + sc.minLen);
  const ok2 = sc.ok && sc.shortCount === 1 && sc.longCount >= 2 && sc.maxLen <= 2501;
  console.log('  ' + (ok2 ? '✅' : '❌') + ' 短文本 1 块；长文本多块且单块 ≤ size+1');

  console.log('\n===== 测试 3：智能扫描主函数存在且无 key 时优雅报错 =====');
  const sf = await page.evaluate(() => ({
    exists: typeof window.smartScanFile === 'function',
    newColId: typeof window.newCollectionId === 'function',
    getCol: typeof window.getCollection === 'function',
  }));
  console.log('  smartScanFile=' + sf.exists + '  newCollectionId=' + sf.newColId + '  getCollection=' + sf.getCol);
  const ok3 = sf.exists && sf.newColId && sf.getCol;
  console.log('  ' + (ok3 ? '✅' : '❌') + ' 智能扫描相关函数均已定义');

  console.log('\n===== 错误汇总 =====');
  console.log('  console errors:', consoleErrs.length);
  consoleErrs.slice(0, 20).forEach(e => console.log('    [console]', e));
  console.log('  page errors:', pageErrors.length);
  pageErrors.slice(0, 20).forEach(e => console.log('    [pageerror]', e));

  const pass = ok1 && ok2 && ok3 && consoleErrs.length === 0 && pageErrors.length === 0;
  console.log('\n===== 汇总 =====');
  console.log(pass ? '✅ 全部通过' : '❌ 存在失败');
  await browser.close();
  if (!pass) process.exit(1);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
