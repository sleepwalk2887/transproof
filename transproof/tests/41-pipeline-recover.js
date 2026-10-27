// tests/41-pipeline-recover.js — 三段流水线卡死修复（v4.34.0）
// 断言：①失败后重试永远重跑同一段（stage 不越位、按钮永不失灵）
//      ②跑到一半关掉弹窗再重开，能重新开始（PL.running 不再卡死）
const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://127.0.0.1:8123/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true });
  const pg = await b.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('page: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_ABORTED|net::/.test(m.text())) errs.push('console: ' + m.text()); });

  // 接管模型请求：fail=立刻 400；hang=永不返回（模拟网络挂起）
  let mode = 'fail', hits = 0;
  await pg.route('**/chat/completions', route => {
    hits++;
    if (mode === 'fail') route.fulfill({ status: 400, contentType: 'text/plain', body: 'bad key (test41)' });
    // hang：故意不 fulfill，请求一直挂着
  });

  await pg.addInitScript(() => {
    localStorage.setItem('tp.cfg', JSON.stringify({ apiKey: 'sk-test', baseUrl: 'https://x/v1', model: 'm', timeout: 30 }));
  });
  await pg.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pg.waitForFunction(() => window.TransProof && TransProof.version, null, { timeout: 20000 });
  await pg.waitForTimeout(600);
  let pass = 0, fail = 0;
  const T = (ok, name, extra) => { if (ok) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); } };

  await pg.evaluate(() => document.querySelector('nav button[data-page="p-trans"]').click());
  await pg.waitForSelector('#ts-src', { state: 'visible', timeout: 5000 });
  await pg.fill('#ts-src', 'The recovery of the old method was surprising.');
  await pg.evaluate(() => document.querySelector('#btn-pipeline').click());
  await pg.waitForSelector('#pl-box', { timeout: 5000 });

  console.log('===== 1. 第 1 段失败 → 重试永远重跑本段（老 bug：stage 越位，3 次后彻底失灵）=====');
  await pg.evaluate(() => document.querySelector('#pl-next').click());
  await pg.waitForFunction(() => /失败/.test(document.querySelector('#pl-status').textContent), null, { timeout: 10000 });
  let st = await pg.evaluate(() => window.PL.stage);
  T(st === 0, '失败后段号不越位（stage 应=0）', '实际 stage=' + st + '，hits=' + hits);

  for (let i = 2; i <= 4; i++) {
    await pg.waitForTimeout(300);
    await pg.evaluate(() => document.querySelector('#pl-next').click());
    await pg.waitForTimeout(500);
    T(hits === i, '第 ' + i + ' 次点击真的重发了请求（hits 应=' + i + '）', '实际 hits=' + hits);
  }
  st = await pg.evaluate(() => window.PL.stage);
  T(st === 0, '连点 4 次后 stage 仍是 0（老 bug：会变成 4 然后死掉）', '实际 stage=' + st);
  const statusAfter = await pg.textContent('#pl-status');
  T(/失败/.test(statusAfter), '第 4 次点击后状态仍是本段失败提示（按钮没失灵）', statusAfter.slice(0, 40));

  console.log('===== 2. 跑到一半关弹窗再重开 → 能重新开始（老 bug：running 卡 true 全失灵）=====');
  await pg.evaluate(() => document.querySelector('#pl-close').click());
  await pg.waitForTimeout(300);
  mode = 'hang';
  await pg.evaluate(() => document.querySelector('#btn-pipeline').click());
  await pg.waitForSelector('#pl-box', { timeout: 5000 });
  await pg.evaluate(() => document.querySelector('#pl-next').click());
  await pg.waitForFunction(() => /生成中/.test(document.querySelector('#pl-status').textContent), null, { timeout: 5000 });
  const hitsBeforeClose = hits;
  await pg.evaluate(() => document.querySelector('#pl-close').click());   // 跑到一半关闭
  await pg.waitForTimeout(300);
  await pg.evaluate(() => document.querySelector('#btn-pipeline').click()); // 重开
  await pg.waitForSelector('#pl-box', { timeout: 5000 });
  await pg.evaluate(() => document.querySelector('#pl-next').click());
  await pg.waitForTimeout(1000);
  const st2 = await pg.textContent('#pl-status');
  T(/生成中/.test(st2), '重开后点开始能真正开跑（状态=生成中）', '实际状态：' + st2.slice(0, 50));
  T(hits > hitsBeforeClose, '重开后发出了新请求（hits 增加）', 'hits ' + hitsBeforeClose + '→' + hits);

  console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
  if (errs.length) { console.log('❌ 页面报错:'); errs.slice(0, 10).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
