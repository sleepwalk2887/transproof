/* v4.26.0 三问题功能探针：P1 收录核查 / P2 已修未修流转 / P3 译文标红内联修正 */
const path = require('path');
const { chromium } = require(path.join('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core'));
const EXE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:8123/index.html';
const SAMPLE = [
  '## 一、修订后译文',
  '',
  '这面墙壁建于1884年。',
  '',
  '## 二、逐条批注',
  '',
  '- [误译] **这面墙** → 改为「墙壁」：方向反了',
  '- [术语不一致] **bridge** → 改为「桥墩」：应统一',
].join('\n');

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage();
  const errs = [], cerr = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text().slice(0, 140)); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.TransProof && document.querySelector('#out'), null, { timeout: 20000 });

  // 种 apiKey（照 18/29 号模式）后刷新
  await page.evaluate(() => {
    const raw = localStorage.getItem('tp.cfg') || '{}';
    const cfg = JSON.parse(raw); cfg.apiKey = 'sk-test';
    localStorage.setItem('tp.cfg', JSON.stringify(cfg));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.TransProof, null, { timeout: 20000 });

  const R = {};
  // 1) 注入结果 → 跑审计管线
  await page.evaluate((s) => {
    window.callModelSimple = async () => ({ text: '[{"i":0,"verdict":"bad","reason":"方向反了","suggest":"墙","conf":"high"}]' });
    TransProof.setResult(s);
    markErrorLines(); renderAuditControls(); renderErrorFilter(LAST_OUT); paintErrFixSpans();
  }, SAMPLE);

  R.chipsHaveUnfixed = await page.evaluate(() => [...document.querySelectorAll('#err-filter .ef-chip')].some(c => c.textContent.includes('未修 2')));
  R.progress0 = await page.evaluate(() => { const p = document.querySelector('.ef-progress'); return p ? p.textContent : ''; });
  R.paintSpans = await page.evaluate(() => [...document.querySelectorAll('#out .err-fix')].map(s => s.textContent));
  R.btnFirst = await page.evaluate(() => { const b = document.querySelector('#out li[data-err] .ef-fix-btn'); return b ? b.textContent : ''; });

  // 2) 点第二条的「标记已修」→ 状态流转（第一条留给 P3 自动标）
  await page.evaluate(() => { document.querySelectorAll('#out li[data-err]')[1].querySelector('.ef-fix-btn').click(); });
  R.afterToggle = await page.evaluate(() => ({
    done: document.querySelectorAll('#out li.ef-done').length,
    prog: (document.querySelector('.ef-progress') || {}).textContent || '',
  }));

  // 3) P3 内联修正：点标红 → 改字 → 失焦提交
  await page.click('#out .err-fix');
  R.editingMode = await page.evaluate(() => { const sp = document.querySelector('#out .err-fix.editing'); return sp ? sp.isContentEditable : false; });
  await page.evaluate(() => { const sp = document.querySelector('#out .err-fix.editing'); sp.textContent = '墙'; });
  await page.evaluate(() => { const sp = document.querySelector('#out .err-fix.editing'); sp.blur(); });
  await page.waitForTimeout(400);
  R.resultFixed = await page.evaluate(() => TransProof.getResult().includes('这面墙建于1884年'));
  R.progress2 = await page.evaluate(() => { const p = document.querySelector('.ef-progress'); return p ? p.textContent : ''; });
  R.taskSavedFix = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('tp.task') || '{}');
    const keys = s.work && s.work.auditFix ? Object.keys(s.work.auditFix) : [];
    return { has: keys.length, sample: keys[0] || '' };
  });

  // 4) P1：verifyEntries mock 回路 + 术语库行入口（先种一条术语再刷新）
  R.verifyFn = await page.evaluate(async () => {
    const vs = await verifyEntries([{ src: 'The wall', dst: '墙壁', extra: '其他' }], null);
    return vs && vs[0] && vs[0].verdict === 'bad' && vs[0].suggest === '墙';
  });
  R.verifyModal = await page.evaluate(() => {
    showVerifyResults([{ src: 'The wall', dst: '墙壁', extra: '' }],
      [{ i: 0, verdict: 'bad', reason: '方向反了', suggest: '墙', conf: 'high' }], { onAdopt: () => true });
    return {
      title: (document.querySelector('#mTitle') || {}).textContent || '',
      bad: document.querySelectorAll('#mBody .vf-badge.bad').length,
      adopt: document.querySelectorAll('#mBody [data-adopt]').length,
    };
  });
  await page.evaluate(() => {
    closeModal();
    const arr = JSON.parse(localStorage.getItem('tp.terms') || '[]');
    arr.push({ src: 'wall', dst: '墙', cat: '其他', note: '' });
    localStorage.setItem('tp.terms', JSON.stringify(arr));
    location.reload();
  });
  await page.waitForFunction(() => window.TransProof && document.querySelector('nav'), null, { timeout: 20000 });
  R.termRowVerify = await page.evaluate(() => {
    const b = document.querySelector('[data-verify]');
    return !!b && b.title.includes('核查');
  });

  R.pageErrors = errs; R.consoleErrors = cerr;
  console.log(JSON.stringify(R, null, 1));
  const ok = R.chipsHaveUnfixed && R.progress0 === '已修 0/2' && R.paintSpans.includes('墙壁') &&
    R.afterToggle.done === 1 && R.afterToggle.prog === '已修 1/2' &&
    R.editingMode === true && R.resultFixed &&
    R.progress2 === '已修 2/2' && R.taskSavedFix.has === 2 && R.verifyFn &&
    R.verifyModal.title.includes('核查') && R.verifyModal.bad === 1 && R.verifyModal.adopt === 1 &&
    R.termRowVerify && !R.pageErrors.length && !R.consoleErrors.length;
  console.log(ok ? 'PROBE PASS' : 'PROBE FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
