// 22: OCR 路径回归 — 语言包同源 + worker/core 镜像探测 + 扫描件 PDF 端到端
// 背景：jsdelivr 被墙时 tesseract worker/lang 走 jsdelivr → 「解析失败undefined」或挂起（v4.21.2 修复）
const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

(async () => {
  const ROOT = path.resolve(__dirname, '..');
  const FIXTURE = path.join(ROOT, '_sample-scan.pdf');
  if (!fs.existsSync(FIXTURE)) {
    execFileSync(process.execPath, [path.join(ROOT, '_gen-scan-pdf.js')], { stdio: 'inherit' });
  }

  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrs = [], pageErrors = [];
  // CDN 多源兜底的预期副作用（首个源失败被浏览器记录）非产品 JS 错误，过滤之
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);

  console.log('===== 1) tpTessPaths 路径探测 =====');
  const paths = await page.evaluate(async () => {
    const p = await window.tpTessPaths();
    const origin = new URL('.', location.href).href.replace(/\/$/, '');
    const reach = async u => {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch(u, { cache: 'no-store', signal: ctl.signal });
        clearTimeout(t);
        if (r.body) try { await r.body.cancel(); } catch (_) { }
        return r.ok;
      } catch (_) { return false; }
    };
    return {
      workerPath: p.workerPath, corePath: p.corePath, langPath: p.langPath,
      origin,
      workerInCands: TESS_CANDIDATES.workerPath.includes(p.workerPath),
      coreInCands: TESS_CANDIDATES.corePath.includes(p.corePath),
      langIsOrigin: p.langPath === origin,
      workerReach: await reach(p.workerPath),
      coreReach: await reach(p.corePath + '/tesseract-core-simd-lstm.wasm.js'),
      langSim: await reach(origin + '/chi_sim.traineddata.gz'),
      langEng: await reach(origin + '/eng.traineddata.gz'),
    };
  });
  console.log('  workerPath=' + paths.workerPath);
  console.log('  corePath=' + paths.corePath);
  console.log('  langPath=' + paths.langPath);

  const pathChecks = {
    workerInCands: paths.workerInCands,
    coreInCands: paths.coreInCands,
    langIsOrigin: paths.langIsOrigin,   // 语言包随应用同源自带
    workerReach: paths.workerReach,
    coreReach: paths.coreReach,
    langSim: paths.langSim,
    langEng: paths.langEng,
  };

  console.log('===== 2) 扫描件 PDF OCR 端到端 =====');
  await page.evaluate(() => {
    window.__toasts = [];
    if (!window.__toastHooked) {
      window.__toastHooked = 1;
      const orig = window.toast;
      window.toast = function (msg, type) { window.__toasts.push((type || 'i') + '|' + msg); return orig.apply(this, arguments); };
    }
  });
  await page.setInputFiles('#srcFile', FIXTURE);
  let toast = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    await page.waitForTimeout(1000);
    const t = await page.evaluate(() => window.__toasts.slice());
    if (t.length) { toast = t; break; }
  }
  const bar = await page.evaluate(() => { const b = document.querySelector('#srcFileBar'); return b ? b.textContent : null; });
  console.log('  toasts: ' + JSON.stringify(toast));
  console.log('  fileBar: ' + JSON.stringify(bar));

  const e2eChecks = {
    gotToast: !!toast,
    successToast: !!toast && toast.some(x => x.startsWith('i|已解析')),
    noFailToast: !toast || !toast.some(x => x.includes('解析失败')),
    barIsScan: !!bar && bar.includes('PDF（扫描件）') && bar.includes('OCR'),
  };

  console.log('===== 错误汇总 =====');
  console.log('  console errors:', consoleErrs.length);
  consoleErrs.slice(0, 20).forEach(e => console.log('    [console]', e));
  console.log('  page errors:', pageErrors.length);
  pageErrors.slice(0, 20).forEach(e => console.log('    [pageerror]', e));

  const checks = { ...pathChecks, ...e2eChecks };
  for (const [k, v] of Object.entries(checks)) console.log('  ' + (v ? '✅' : '❌') + ' ' + k);
  const pass = Object.values(checks).every(Boolean) && consoleErrs.length === 0 && pageErrors.length === 0;

  console.log('\n===== 汇总 =====');
  console.log(pass ? '✅ 全部通过' : '❌ 存在失败');
  await browser.close();
  if (!pass) process.exit(1);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
