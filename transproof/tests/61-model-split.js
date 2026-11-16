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

  // 1. helper + 旧锚点 + 设置页下拉
  t('draftOv 导出', await page.evaluate(() => typeof window.draftOv === 'function'));
  t('auditOv 导出', await page.evaluate(() => typeof window.auditOv === 'function'));
  t('#btn-sample 存在', await page.evaluate(() => !!document.getElementById('btn-sample')));
  t('旧锚点 #btn-score 未动', await page.evaluate(() => !!document.getElementById('btn-score')));
  t('旧锚点 #btn-pnoun 未动', await page.evaluate(() => !!document.getElementById('btn-pnoun')));
  t('旧锚点 #ao-pnoun 未动', await page.evaluate(() => !!document.getElementById('ao-pnoun')));
  t('设置页 #draft-provider 存在', await page.evaluate(() => !!document.getElementById('draft-provider')));
  t('设置页 #audit-provider 存在', await page.evaluate(() => !!document.getElementById('audit-provider')));
  t('APP_VERSION 三段式', await page.evaluate(() => typeof APP_VERSION === 'string' && APP_VERSION.split('.').length === 3));

  // 2. 默认不分工：draftOv/auditOv 返回主模型（deepseek-chat）
  const def = await page.evaluate(() => ({ db: draftOv().baseUrl, dm: draftOv().model, ab: auditOv().baseUrl, am: auditOv().model }));
  t('默认 draftOv baseUrl = 主接口', def.db === 'https://api.deepseek.com');
  t('默认 draftOv model = 主模型', def.dm === 'deepseek-chat');
  t('默认 auditOv model = 主模型', def.am === 'deepseek-chat');

  // 3. 设置分工后 draftOv/auditOv 返回分工值
  const split = await page.evaluate(() => {
    CFG.draftBaseUrl = 'https://draft.test/v1'; CFG.draftModel = 'draft-m';
    CFG.auditBaseUrl = 'https://audit.test/v1'; CFG.auditModel = 'audit-m';
    return { dm: draftOv().model, db: draftOv().baseUrl, am: auditOv().model, ab: auditOv().baseUrl };
  });
  t('分工 draftOv model', split.dm === 'draft-m');
  t('分工 draftOv baseUrl', split.db === 'https://draft.test/v1');
  t('分工 auditOv model', split.am === 'audit-m');
  t('分工 auditOv baseUrl', split.ab === 'https://audit.test/v1');

  // 4. callModelSimple 的 override（mock fetch）
  const cap1 = await page.evaluate(async () => {
    let captured = null;
    const orig = window.fetch;
    window.fetch = async (url, opts) => {
      captured = { url: String(url), body: JSON.parse(opts.body), auth: opts.headers.Authorization };
      return new Response(JSON.stringify({ choices: [{ message: { content: 'x' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    await callModelSimple('s', 'u', 100, undefined, { baseUrl: 'https://ov.test/v1', model: 'ov-model', apiKey: 'ov-key' });
    window.fetch = orig;
    return captured;
  });
  t('callModelSimple override baseUrl', cap1.url.indexOf('ov.test/v1/chat/completions') >= 0);
  t('callModelSimple override model', cap1.body.model === 'ov-model');
  t('callModelSimple override apiKey', cap1.auth === 'Bearer ov-key');

  // 5. callModel 的 override（mock fetch，stream）
  const cap2 = await page.evaluate(async () => {
    let captured = null;
    const orig = window.fetch;
    window.fetch = async (url, opts) => {
      captured = { url: String(url), body: JSON.parse(opts.body) };
      const enc = new TextEncoder();
      const stream = new ReadableStream({ start(c){ c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n')); c.enqueue(enc.encode('data: [DONE]\n\n')); c.close(); } });
      return new Response(stream, { status: 200 });
    };
    await callModel('s', 'u', null, undefined, { baseUrl: 'https://cm.test/v1', model: 'cm-model' });
    window.fetch = orig;
    return captured;
  });
  t('callModel override baseUrl', cap2.url.indexOf('cm.test/v1/chat/completions') >= 0);
  t('callModel override model', cap2.body.model === 'cm-model');

  // 6. 无 override 时用默认（零行为变化）
  const cap3 = await page.evaluate(async () => {
    let captured = null;
    const orig = window.fetch;
    window.fetch = async (url, opts) => { captured = { url: String(url), body: JSON.parse(opts.body) }; return new Response(JSON.stringify({ choices: [{ message: { content: 'x' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
    await callModelSimple('s', 'u', 100);
    window.fetch = orig;
    return captured;
  });
  t('无 override 走主接口', cap3.url.indexOf('api.deepseek.com') >= 0);
  t('无 override model = 主模型', cap3.body.model === 'deepseek-chat');

  t('无页面错误', errors.length === 0);
  console.log('PASS=' + pass + ' FAIL=' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
