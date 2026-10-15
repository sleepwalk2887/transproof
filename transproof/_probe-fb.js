// 反馈通道 + 首页健康 探针：Edge 同源 fetch（= 应用真实调用方式）
// 用法: node _probe-fb.js [base]   默认 https://transproof.pages.dev
const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const BASE = (process.argv[2] || 'https://transproof.pages.dev').replace(/\/+$/, '');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
    // 本机代理：CF 直连抽风时走 7897（node 刚用它成功部署过，隧道确认活着）
    proxy: { server: 'http://127.0.0.1:7897', bypass: 'localhost;127.0.0.1' }
  });
  const page = await browser.newPage();
  const out = { base: BASE, pageErrors: [], consoleErrs: [] };
  page.on('pageerror', e => out.pageErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') out.consoleErrs.push(m.text().slice(0, 160)); });

  // 1) 首页健康（边缘入口接管后绝不能坏）
  const resp = await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 40000 });
  out.home = {
    status: resp && resp.status(),
    version: await page.evaluate(() => (window.TransProof && window.TransProof.version) || null),
    tabs: await page.evaluate(() => document.querySelectorAll('#nav button').length),
    runBtn: await page.evaluate(() => !!document.getElementById('btn-run'))
  };

  // 2) 同源反馈通道：GET list + POST submit
  out.api = await page.evaluate(async () => {
    const r = {};
    try {
      const g = await fetch('/api/feedback/list');
      const j = await g.json();
      r.get = { status: g.status, count: (j.list || []).length };
    } catch (e) { r.getErr = String(e); }
    try {
      const p = await fetch('/api/feedback/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desc: '探针：边缘通道冒烟', time: '2026-10-15 16:00', func: '测试页', where: '探针 -> pages边缘 -> workers' })
      });
      r.post = { status: p.status, body: await p.json() };
    } catch (e) { r.postErr = String(e); }
    return r;
  });

  // 3) POST 之后再读列表，确认写入闭环
  out.api.afterPost = await page.evaluate(async () => {
    try {
      const g = await fetch('/api/feedback/list');
      const j = await g.json();
      return { status: g.status, count: (j.list || []).length, first: (j.list || [])[0] && (j.list || [])[0].desc };
    } catch (e) { return { err: String(e) }; }
  });

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  const ok = out.home.status === 200 && out.home.runBtn && out.api.get && out.api.post && out.api.post.status === 200 && out.api.afterPost.count >= 1;
  console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
