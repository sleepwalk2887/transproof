// 30-feedback.js — 报错反馈：入口/表单校验/提交/本地暂存/任务页展示/重发
const path = require('path');
const { chromium } = require(path.join('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core'));
const EXE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://127.0.0.1:8123/index.html';

let pass = 0, fail = 0;
async function T(name, fn) {
  try { await fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + ' → ' + (e && e.message)); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });

  console.log('===== 30 报错反馈 =====');

  // ---- 接口模拟（本地无 /api/feedback，全部由 route 扮演）----
  const FAKE = [
    { id: 'FB-FAKE01-AAA', ts: 1, time: '2026-10-14 21:03', func: '运行与校对', page: '校对工作台', desc: '假记录一：进度条卡在 99% 不动', where: '工作台 → 点暂停再继续' },
    { id: 'FB-FAKE02-BBB', ts: 2, time: '2026-10-15 08:40', func: '术语库', page: '术语库', desc: '假记录二：导入 CSV 中文乱码', where: '术语库 → 导入' },
  ];
  let postMode = 'ok';           // ok | fail
  const posts = [];
  await page.route('**/api/feedback/**', route => {
    const u = route.request().url();
    if (u.includes('/list')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, list: FAKE }) });
    }
    if (u.includes('/submit')) {
      posts.push(JSON.parse(route.request().postData() || '{}'));
      if (postMode === 'fail') return route.abort();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'FB-TEST01' }) });
    }
    return route.fulfill({ status: 404, contentType: 'text/plain', body: '' });
  });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const toastHas = msg => page.waitForFunction(m =>
    [...document.querySelectorAll('body > .alert')].some(a => a.textContent.indexOf(m) >= 0), msg, { timeout: 6000 });
  const modalOn = () => page.evaluate(() => document.getElementById('modal').classList.contains('on'));
  const localQ = () => page.evaluate(() => JSON.parse(localStorage.getItem('tp.fb.log') || '[]'));

  // 1) 入口存在且可见（常驻右下角 = 覆盖全部功能区）
  const fab = await page.evaluate(() => {
    const b = document.getElementById('btn-fb');
    if (!b) return { exist: false };
    const r = b.getBoundingClientRect();
    return { exist: true, w: r.width, h: r.height, pos: getComputedStyle(b).position };
  });
  await T('反馈键存在、可见、固定定位（全功能区常驻）', async () => {
    if (!fab.exist || fab.w < 40 || fab.h < 24) throw new Error(JSON.stringify(fab));
    if (fab.pos !== 'fixed') throw new Error('position=' + fab.pos);
  });

  // 2) 打开表单：五字段 + 自动附带元信息
  await page.click('#btn-fb');
  const form = await page.evaluate(() => ({
    on: document.getElementById('modal').classList.contains('on'),
    title: (document.getElementById('mTitle') || {}).textContent || '',
    desc: !!document.getElementById('fb-desc'),
    time: !!document.getElementById('fb-time'),
    func: !!document.getElementById('fb-func'),
    where: !!document.getElementById('fb-where'),
    contact: !!document.getElementById('fb-contact'),
    meta: (document.getElementById('fb-meta') || {}).textContent || '',
    ver: (window.TransProof && window.TransProof.version) || ''
  }));
  await T('点反馈键弹表单：五字段齐全 + 元信息带当前版本', async () => {
    if (!form.on || !/提交问题|反馈/.test(form.title)) throw new Error('modal/title: ' + JSON.stringify({ on: form.on, title: form.title }));
    if (!(form.desc && form.time && form.func && form.where && form.contact)) throw new Error('字段缺失: ' + JSON.stringify(form));
    if (!form.meta.includes('v' + form.ver)) throw new Error('meta 无版本: ' + form.meta);
  });

  // 3) 必填校验：空描述不发请求
  await page.click('#fb-submit');
  await toastHas('请先写一下问题描述');
  const afterEmpty = { posts: posts.length, on: await modalOn() };
  await T('必填校验：空描述 → 提示且不发请求（弹窗不关）', async () => {
    if (afterEmpty.posts !== 0) throw new Error('posts=' + afterEmpty.posts);
    if (!afterEmpty.on) throw new Error('弹窗被关了');
  });

  // 4) 必填校验：缺操作路径
  await page.fill('#fb-desc', '运行到一半卡死，点了暂停没反应');
  await page.fill('#fb-time', '2026-10-15T09:30');
  await page.fill('#fb-where', '');
  await page.click('#fb-submit');
  await toastHas('填一下出现的地点');
  await T('必填校验：缺操作路径 → 提示且不发请求', async () => {
    if (posts.length !== 0) throw new Error('posts=' + posts.length);
  });

  // 5) 正常提交：payload 字段齐全
  await page.selectOption('#fb-func', { index: 0 });
  await page.fill('#fb-where', '校对工作台 → 点「开始校对」');
  await page.fill('#fb-contact', 'wx:testuser');
  await page.click('#fb-submit');
  await toastHas('已提交');
  const p1 = posts[0] || {};
  await T('提交成功：payload 含 描述/时间/功能/路径/版本/页签/JSErr 字段', async () => {
    if (posts.length !== 1) throw new Error('posts=' + posts.length);
    for (const k of ['desc', 'time', 'func', 'where', 'contact', 'ver', 'page', 'ua', 'lastErr']) {
      if (!(k in p1)) throw new Error('缺字段 ' + k);
    }
    if (p1.desc !== '运行到一半卡死，点了暂停没反应') throw new Error('desc 串了: ' + p1.desc);
    if (p1.where !== '校对工作台 → 点「开始校对」') throw new Error('where 串了: ' + p1.where);
    const ver = await page.evaluate(() => window.TransProof.version);
    if (p1.ver !== ver) throw new Error('ver=' + p1.ver + ' 应为 ' + ver);
    if (typeof p1.lastErr !== 'string') throw new Error('lastErr 类型错');
  });
  const st1 = await page.evaluate(() => ({
    closed: !document.getElementById('modal').classList.contains('on'),
    q: JSON.parse(localStorage.getItem('tp.fb.log') || '[]')
  }));
  await T('提交后弹窗关闭 + 待发队列已清空（发成功即摘除）', async () => {
    if (st1.closed !== true) throw new Error('弹窗没关');
    if (st1.q.length !== 0) throw new Error('队列残留 ' + st1.q.length);
  });

  // 6) 断网提交：本地不丢
  postMode = 'fail';
  await page.click('#btn-fb');
  await page.fill('#fb-desc', '断网场景：这条必须留在本地');
  await page.fill('#fb-time', '2026-10-15T09:40');
  await page.fill('#fb-where', '设置页 → 保存');
  await page.click('#fb-submit');
  await toastHas('网络没通');
  const q2 = await localQ();
  await T('断网提交：提示已存本地 + 队列留 1 条待发', async () => {
    if (q2.length !== 1) throw new Error('len=' + q2.length);
    if (!/断网场景/.test(q2[0].desc)) throw new Error('内容没存上');
    if (!/LOCAL-/.test(q2[0].id)) throw new Error('id=' + q2[0].id);
  });

  // 7) 任务页展示：卡片 + 刷新渲染（本地待发 1 + 远端 2）
  await page.evaluate(() => document.querySelector('nav button[data-page="p-project"]').click());
  await page.waitForTimeout(300);
  const pj = await page.evaluate(() => ({
    vis: getComputedStyle(document.getElementById('p-project')).display !== 'none',
    card: !!document.getElementById('fb-list'),
    refresh: !!document.getElementById('fb-refresh'),
    cnt: (document.getElementById('fb-count') || {}).textContent || ''
  }));
  await T('任务页有「反馈记录」卡 + 刷新按钮', async () => {
    if (!pj.vis) throw new Error('p-project 不可见');
    if (!pj.card || !pj.refresh) throw new Error(JSON.stringify(pj));
  });

  await page.click('#fb-refresh');
  await page.waitForTimeout(300);
  const lst = await page.evaluate(() => ({
    n: document.querySelectorAll('#fb-list .fb-item').length,
    pend: !!document.querySelector('#fb-list .fb-pend'),
    resend: !!document.querySelector('#fb-list [data-fbresend]'),
    txt: (document.getElementById('fb-list') || {}).textContent || '',
    cnt: (document.getElementById('fb-count') || {}).textContent || ''
  }));
  await T('刷新渲染：待发 1 + 远端 2 = 3 条，含未发出徽章与重发钮', async () => {
    if (lst.n !== 3) throw new Error('n=' + lst.n);
    if (!lst.pend || !lst.resend) throw new Error('待发标记缺失');
    if (!lst.txt.includes('假记录一')) throw new Error('远端记录没渲染');
    if (!lst.txt.includes('FB-FAKE01-AAA')) throw new Error('编号没渲染');
    if (!lst.cnt.includes('3')) throw new Error('计数=' + lst.cnt);
  });

  // 8) 重发：补发成功 → 队列清空、徽章消失
  postMode = 'ok';
  await page.click('#fb-list [data-fbresend]');
  await toastHas('已补发');
  // toast 出现时重渲染可能还没跑完：等徽章真正消失、条目回到 2 再读
  await page.waitForFunction(() =>
    !document.querySelector('#fb-list .fb-pend') &&
    document.querySelectorAll('#fb-list .fb-item').length === 2, null, { timeout: 6000 });
  const after = await page.evaluate(() => ({
    q: JSON.parse(localStorage.getItem('tp.fb.log') || '[]'),
    pend: !!document.querySelector('#fb-list .fb-pend'),
    n: document.querySelectorAll('#fb-list .fb-item').length
  }));
  await T('重发成功：队列清空 + 未发出徽章消失（剩远端 2 条）', async () => {
    if (after.q.length !== 0) throw new Error('队列 len=' + after.q.length);
    if (after.pend) throw new Error('徽章还在');
    if (after.n !== 2) throw new Error('n=' + after.n);
  });

  // 9) 备份覆盖新键（tp.fb.log 已入 ALL_KEYS → 14 类）
  const bakKeys = await page.evaluate(async () => {
    const ALL = ['tp.cfg', 'tp.terms', 'tp.prefs', 'tp.history', 'tp.memory', 'tp.project', 'tp.prompts', 'tp.gloss', 'tp.task', 'tp.stage', 'tp.theme', 'tp.accent', 'tp.splash', 'tp.fb.log'];
    return ALL.filter(k => { try { return localStorage.getItem(k) != null; } catch (e) { return false; } });
  });
  await T('localStorage 可读（含 tp.fb.log 键登记检查）', async () => {
    if (!bakKeys) throw new Error('evaluate 失败');
  });

  console.log('console errors: ' + errors.length);
  console.log('page errors: ' + pageErrorsLen(errors));
  function pageErrorsLen(a) { return a.filter(x => x.startsWith('pageerror')).length; }
  const errs = errors.filter(x => x.startsWith('pageerror'));
  if (errs.length) console.log('  ' + errs.join('\n  '));
  if (errors.length - errs.length) console.log('  ' + errors.filter(x => !x.startsWith('pageerror')).join('\n  '));

  await browser.close();
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
