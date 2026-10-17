// tests/36-pipeline.js — 三段流水线（翻译→批评→精修）T-002 + 批评段输入白名单 T-010
const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EXE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://127.0.0.1:8123/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true });
  const pg = await b.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('page: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await pg.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pg.waitForFunction(() => window.TransProof && TransProof.version, null, { timeout: 20000 });
  await pg.waitForTimeout(800);
  let pass = 0, fail = 0;
  const T = (ok, name, extra) => { if (ok) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); } };

  console.log('===== 0. 前置：API Key + 进翻译页 =====');
  await pg.evaluate(() => localStorage.setItem('tp.cfg', JSON.stringify({ apiKey: 'sk-test', baseUrl: 'https://x/v1', model: 'm' })));
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.TransProof && TransProof.version, null, { timeout: 20000 });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => document.querySelector('nav button[data-page="p-trans"]').click());
  await pg.waitForSelector('#ts-src', { state: 'visible', timeout: 5000 });

  console.log('===== 1. 入口按钮存在并打开弹窗 =====');
  T(await pg.isVisible('#btn-pipeline'), '三段流水线按钮可见');
  await pg.fill('#ts-src', 'The recovery of the old method was surprising.');
  await pg.evaluate(() => window.__plLog = []);
  await pg.evaluate(() => {
    window.callModelSimple = async (sys, user, maxTok) => {
      window.__plLog.push({ sys, user });
      if (/挑剔|译审/.test(sys)) return { text: '[误译] recovery → 改为「复兴」：原译未达意。\n[术语不一致] method → 应统一为「方法」。' };
      if (/精修/.test(sys)) return { text: '旧方法的复兴令人惊讶。（精修版）' };
      return { text: '旧方法的复苏令人惊讶。' };
    };
  });
  await pg.evaluate(() => document.querySelector('#btn-pipeline').click());
  await pg.waitForSelector('#pl-box', { timeout: 5000 });
  T(await pg.isVisible('#pl-next'), '弹窗出现且有「开始第 1 段」按钮');

  console.log('===== 2. 三段依次跑通 =====');
  await pg.evaluate(() => document.querySelector('#pl-next').click());
  await pg.waitForFunction(() => /完成|失败/.test(document.querySelector('#pl-status').textContent), null, { timeout: 10000 });
  T((await pg.textContent('#pl-box')).includes('旧方法的复苏'), '第 1 段产物=初稿');
  T((await pg.textContent('#pl-next')).includes('第 2 段'), '按钮推进到第 2 段');

  await pg.evaluate(() => document.querySelector('#pl-next').click());
  await pg.waitForFunction(() => (document.querySelectorAll('#pl-status')[0].textContent.match(/第 2 段.*(完成|失败)/) || []).length > 0 || /第 2 段.*完成/.test(document.querySelector('#pl-status').textContent), null, { timeout: 10000 });
  T((await pg.textContent('#pl-box')).includes('[误译]'), '第 2 段产物=批评清单');
  T((await pg.textContent('#pl-next')).includes('第 3 段'), '按钮推进到第 3 段');

  await pg.evaluate(() => document.querySelector('#pl-next').click());
  await pg.waitForFunction(() => /第 3 段.*完成|三段全部完成/.test(document.querySelector('#pl-status').textContent + document.querySelector('#pl-next').textContent), null, { timeout: 10000 });
  T((await pg.textContent('#pl-box')).includes('精修版'), '第 3 段产物=精修译文');
  T(!(await pg.isDisabled('#pl-send')), '「送去校对」按钮解锁');

  console.log('===== 3. 批评段输入白名单（T-010）=====');
  const log = await pg.evaluate(() => window.__plLog);
  const crit = log[1]; // 第 2 段调用
  T(/外文原文/.test(crit.user) && /译稿/.test(crit.user) && /术语表/.test(crit.user), '批评段输入含 原文+译稿+术语表');
  T(/只找出问题|不要重写/.test(crit.sys), '批评段提示词=只产清单不改译文');
  T(/不重写|不要重写|绝对不要/.test(crit.sys), '批评段禁止改写约束在位');
  const refine = log[2]; // 第 3 段
  T(/批评清单/.test(refine.user), '精修段输入带批评清单');

  console.log('===== 4. 送去校对回填 =====');
  await pg.evaluate(() => document.querySelector('#pl-send').click());
  await pg.waitForTimeout(400);
  const dst = await pg.evaluate(() => document.querySelector('#dst').value);
  T(dst.includes('精修版'), '精修译文已回填校对页译文框', dst.slice(0, 30));
  T(!(await pg.isVisible('#pl-box')), '弹窗已关闭');

  console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
  if (errs.length) { console.log('❌ 页面报错:'); errs.forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(fail || errs.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
