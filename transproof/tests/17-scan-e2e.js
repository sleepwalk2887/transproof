const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

(async () => {
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrs = [], pageErrors = [];
  // CDN 多源兜底时首个源（jsdelivr）失败会触发浏览器自动记录的
  // "Failed to load resource: net::ERR_*"，属预期兜底副作用而非产品 JS 错误，过滤之
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  // 1) 预置 API key（写入 localStorage 后 reload 让 CFG 加载）
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('tp.cfg') || '{}');
    c.apiKey = 'test-key';
    localStorage.setItem('tp.cfg', JSON.stringify(c));
    localStorage.removeItem('tp.gloss');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);

  console.log('===== 端到端：mock callModel → smartScanFile 完整流程 =====');
  const res = await page.evaluate(async () => {
    // mock LLM 返回：两个高置信度术语 + 一个低置信度（应留待审核）
    window.callModel = async () => ({
      text: '[{"foreign":"Hegel","zh":"黑格尔","type":"人物","note":"德国哲学家","conf":"high"},' +
             '{"foreign":"Aufhebung","zh":"扬弃","type":"概念","conf":"high"},' +
             '{"foreign":"some phrase","zh":"","type":"概念","conf":"low"}]',
      usage: {},
    });
    const file = new File(['黑格尔在《精神现象学》中提出 Aufhebung 概念，这是一个辩证法的核心术语。'], '精神现象学.txt', { type: 'text/plain' });
    const r = await window.smartScanFile(file, null);
    const g = window.TransProof.gloss.data();
    return {
      r,
      collectionCount: g.collections.length,
      colName: g.collections[0] ? g.collections[0].name : null,
      colEnabled: g.collections[0] ? g.collections[0].enabled : null,
      termCount: g.terms.length,
      terms: g.terms.map(t => ({ foreign: t.foreign, zh: t.zh, status: t.status, recommend: t.recommend, collections: t.collections })),
    };
  });

  console.log('  返回值: ' + JSON.stringify(res.r));
  console.log('  集合数=' + res.collectionCount + '  集合名=' + res.colName + '  启用=' + res.colEnabled);
  console.log('  术语数=' + res.termCount);
  res.terms.forEach(t => console.log('    ' + t.foreign + ' → ' + t.zh + '  status=' + t.status + '  rec=' + t.recommend + '  collections=' + JSON.stringify(t.collections)));

  const high = res.terms.filter(t => t.conf === undefined && (t.foreign === 'Hegel' || t.foreign === 'Aufhebung'));
  const hegel = res.terms.find(t => t.foreign === 'Hegel');
  const low = res.terms.find(t => t.foreign === 'some phrase');

  const checks = {
    builtCollection: res.collectionCount === 1 && res.colName === '精神现象学' && res.colEnabled === true,
    extractedThree: res.termCount === 3,
    hegelConfirmed: hegel && hegel.status === 'confirmed' && hegel.recommend === 'rec',
    hegelInCollection: hegel && Array.isArray(hegel.collections) && hegel.collections.length === 1,
    lowPending: low && low.status === 'pending',
    lowZhEmpty: low && !low.zh,
  };
  for (const [k, v] of Object.entries(checks)) console.log('  ' + (v ? '✅' : '❌') + ' ' + k);
  const ok = Object.values(checks).every(Boolean);

  console.log('\n===== 错误汇总 =====');
  console.log('  console errors:', consoleErrs.length);
  consoleErrs.slice(0, 20).forEach(e => console.log('    [console]', e));
  console.log('  page errors:', pageErrors.length);
  pageErrors.slice(0, 20).forEach(e => console.log('    [pageerror]', e));

  const pass = ok && consoleErrs.length === 0 && pageErrors.length === 0;
  console.log('\n===== 汇总 =====');
  console.log(pass ? '✅ 全部通过' : '❌ 存在失败');
  await browser.close();
  if (!pass) process.exit(1);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
