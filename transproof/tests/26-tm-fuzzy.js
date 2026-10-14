/* 26: 翻译记忆模糊匹配（v4.23.0 P1，双档）
   强 ≥0.90 近似命中（微调复用）；弱 0.80–0.90 相关参考（不得照抄）；<0.80 不注入。 */
const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.log('  ❌ ' + label + (extra !== undefined ? '  → ' + extra : '')); }
};

// learnFromResult 存的是 splitSentences 切片（尾标点已被剥掉），夹具照此口径
const STORED = { src: 'The bridge was built in 1884 by the workers', dst: '这座桥由工人们建于1884年。' };
const PUNCT_VARIANT = 'The bridge was built in 1884, by the workers';   // 句中逗号 → sim=1 → 强（尾标点会被切句剥掉，必须句中差异）
const TYPO_VARIANT = 'The bridge was built in 1884 by the wrokers.';    // 单字符错字(短句)≈0.82 → 弱
const UNRELATED = 'The river flooded the town in 1902 after the terrible storm and heavy rain.';

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
    await page.waitForFunction(() => window.TransProof && typeof buildSystem === 'function');
    // 预置一条翻译记忆（tp.memory），刷新让 TM 加载
    await page.evaluate((m) => localStorage.setItem('tp.memory', JSON.stringify([m])),
      Object.assign({ ts: Date.now() }, STORED));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.TransProof && typeof buildSystem === 'function');

    console.log('===== 1) TM 加载与相似度分档 =====');
    const base = await page.evaluate(() => ({
      tmLen: (typeof TM !== 'undefined') ? TM.length : -1,
      same: simScore('The bridge was built in 1884 by the workers.', 'The bridge was built in 1884 by the workers.'),
      punct: simScore('The bridge was built in 1884 by the workers.', 'The bridge was built in 1884 by the workers!'),
      typo: simScore('The bridge was built in 1884 by the workers.', 'The bridge was built in 1884 by the wrokers.'),
      diff: simScore('The bridge was built in 1884 by the workers.', 'The river flooded the town in 1902 after the terrible storm and heavy rain.'),
      shortLong: simScore('你好。', 'The bridge was built in 1884 by the workers.')
    }));
    console.log('  TM=' + base.tmLen + '  same=' + base.same + '  punct=' + base.punct +
      '  typo=' + base.typo.toFixed(3) + '  diff=' + base.diff.toFixed(3));
    ok(base.tmLen === 1, 'TM 预置 1 条', base.tmLen);
    ok(base.same === 1, '同句 sim=1', base.same);
    ok(base.punct === 1, '仅差标点 sim=1（去标点 key）', base.punct);
    ok(base.typo >= 0.80 && base.typo < 0.90, '短句错字落弱档 0.80–0.90', base.typo);
    ok(base.diff < 0.80, '实质不同 <0.80', base.diff);
    ok(base.shortLong === 0, '长度悬殊剪枝=0', base.shortLong);

    console.log('===== 2) buildSystem 双档注入 =====');
    const setSrc = (t) => page.evaluate((v) => { document.querySelector('#src').value = v; }, t);
    // 2a 精确句 → 只有精确段
    await setSrc(STORED.src);
    const exactSys = await page.evaluate(() => buildSystem());
    ok(exactSys.includes('【历史定稿（翻译记忆）'), '精确命中注入历史定稿段');
    ok(!exactSys.includes('近似命中') && !exactSys.includes('相关参考'), '精确命中不再注入模糊段（去重）');
    // 2b 标点变体 → 强档
    await setSrc(PUNCT_VARIANT);
    const fuzzSys = await page.evaluate(() => buildSystem());
    ok(fuzzSys.includes('【历史定稿 · 近似命中'), '标点变体注入强档近似命中段');
    ok(!fuzzSys.includes('相关参考'), '强档命中不重复进弱档');
    ok(fuzzSys.includes(STORED.dst), '强档段携带旧定稿译文', STORED.dst);
    ok(/按旧定稿微调后复用/.test(fuzzSys), '强档段含复用规则说明');
    // 2c 错字变体 → 弱档
    await setSrc(TYPO_VARIANT);
    const weakSys = await page.evaluate(() => buildSystem());
    ok(weakSys.includes('【历史定稿 · 相关参考'), '错字变体注入弱档相关参考段', weakSys.slice(-260));
    ok(!weakSys.includes('近似命中'), '弱档不进强档段');
    ok(/不得直接照抄旧译/.test(weakSys), '弱档段含禁止照抄条款');
    // 2d 无关句 → 都不注入
    await setSrc(UNRELATED);
    const noneSys = await page.evaluate(() => buildSystem());
    ok(!noneSys.includes('历史定稿'), '无关句不注入任何记忆段');

    console.log('===== 3) findFuzzyMemory 分档口径 =====');
    const direct2 = await page.evaluate(() => {
      const strong = findFuzzyMemory('The bridge was built in 1884 by the workers!', new Set(), 0.90);
      const weak = findFuzzyMemory('The bridge was built in 1884 by the wrokers.', new Set(), 0.80, 0.90);
      const skipped = findFuzzyMemory('The bridge was built in 1884 by the workers.',
        new Set(['thebridgewasbuiltin1884bytheworkers']), 0.80);
      return { strong: strong.length, weak: weak.length, weakDst: weak[0] && weak[0].dst, skipped: skipped.length };
    });
    ok(direct2.strong === 1, '强档直接命中 1 条', JSON.stringify(direct2));
    ok(direct2.weak === 1 && direct2.weakDst === STORED.dst, '弱档直接命中 1 条且译文正确', JSON.stringify(direct2));
    ok(direct2.skipped === 0, 'exactKeys 命中的句子被跳过', direct2.skipped);

    console.log('===== 4) 错误汇总 =====');
    await page.evaluate(() => localStorage.removeItem('tp.memory'));
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
