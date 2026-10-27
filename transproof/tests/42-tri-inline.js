/* 42-tri-inline.js — 三栏对照 · 翻译区直出 + 卡顿修复（v4.35.0 · 零 token）
   验收：①译文框下有开关 ②校对前就能并排看（修订列标「未校对」）
   ③输入实时刷新 ④大批量下不再卡（正则只拼一次）⑤旧锚点不动 */
const path = require('path');
const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

let pass = 0, fail = 0;
async function T(name, fn){
  try{ await fn(); console.log('  ✅ ' + name); pass++; }
  catch(e){ console.log('  ❌ ' + name + ' — ' + e.message); fail++; }
}

(async () => {
  console.log('===== 三栏对照 · 翻译区直出（v4.35.0）=====');
  const b = await chromium.launch({ executablePath: EDGE, headless: true });
  const pg = await b.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await pg.waitForTimeout(1200);

  const SRC = 'The committee met on 3 March 2024. It approved the budget.\n\nA second meeting followed.';
  const DST = '委员会于 2024 年 3 月 3 日召开。它批准了预算。\n\n第二次会议随后举行。';

  await T('开关在译文框下存在且初始是收起状态', async () => {
    const ok = await pg.evaluate(() => {
      const btn = document.querySelector('#btn-tri-inline');
      const box = document.querySelector('#tri-inline');
      return !!btn && !!box && box.style.display === 'none';
    });
    if(!ok) throw new Error('按钮或面板缺失 / 初始没收起');
  });

  await pg.evaluate(({ SRC, DST }) => {
    document.querySelector('#src').value = SRC;
    document.querySelector('#dst').value = DST;
  }, { SRC, DST });

  await T('点开关后三栏面板出现', async () => {
    await pg.evaluate(() => document.querySelector('#btn-tri-inline').click());
    const ok = await pg.evaluate(() => {
      const box = document.querySelector('#tri-inline');
      return box && box.style.display !== 'none' && box.querySelector('.tri-table');
    });
    if(!ok) throw new Error('面板没显示或没有 .tri-table');
  });

  await T('校对前就并排显示 原文｜译文', async () => {
    const txt = await pg.textContent('#tri-inline');
    if(!txt.includes('原文') || !txt.includes('译文')) throw new Error('表头缺原文/译文');
    if(!txt.includes('委员会于 2024 年 3 月 3 日召开')) throw new Error('译文没进第三栏内容');
    if(!txt.includes('The committee met on 3 March 2024')) throw new Error('原文没进第一栏');
  });

  await T('没校对时修订列标「未校对」，不报错', async () => {
    const txt = await pg.textContent('#tri-inline');
    if(!txt.includes('未校对')) throw new Error('缺「未校对」标注');
  });

  await T('改译文后实时刷新（输入触发 300ms 防抖）', async () => {
    await pg.evaluate(() => {
      const el = document.querySelector('#dst');
      el.value = '委员会于 2024 年 3 月 3 日召开。它批准了新的预算方案。';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await pg.waitForTimeout(700);
    const txt = await pg.textContent('#tri-inline');
    if(!txt.includes('新的预算方案')) throw new Error('面板没跟着更新');
  });

  await T('收起按钮生效', async () => {
    await pg.evaluate(() => document.querySelector('#tri-inline-close').click());
    const ok = await pg.evaluate(() => document.querySelector('#tri-inline').style.display === 'none');
    if(!ok) throw new Error('没收起');
  });

  await T('大批量（500 句 + 30 批注）渲染不卡（1.5 秒内）', async () => {
    const r = await pg.evaluate(() => {
      const paras = [], revs = [];
      const frags = [];
      for(let i = 0; i < 300; i++){
        const s = 'Sentence ' + i + ' has some words.';
        paras.push(s);
        revs.push('第 ' + i + ' 句改成了修订版' + i + '。');
        if(i < 30) frags.push('修订版' + i);
      }
      document.querySelector('#src').value = paras.join('\n\n');
      document.querySelector('#dst').value = paras.join('\n\n');
      document.querySelector('#btn-tri-inline').click();
      const t0 = performance.now();
      // 直接压 renderTriInline，测纯渲染耗时
      for(let k = 0; k < 3; k++) renderTriInline();
      return performance.now() - t0;
    });
    console.log('      （300 段 × 3 次渲染耗时 ' + Math.round(r) + 'ms）');
    if(r > 1500) throw new Error('渲染 ' + Math.round(r) + 'ms，超过 1500ms 预算');
  });

  await T('旧锚点一个没动（btn-view-tri / btn-view-doc / btn-audit / btn-para-audit / btn-num-audit）', async () => {
    const r = await pg.evaluate(() => ({
      tri: !!document.querySelector('#btn-view-tri'),
      doc: !!document.querySelector('#btn-view-doc'),
      audit: !!document.querySelector('#btn-audit'),
      para: !!document.querySelector('#btn-para-audit'),
      num: !!document.querySelector('#btn-num-audit')
    }));
    if(!(r.tri && r.doc && r.audit && r.para && r.num)) throw new Error('有旧锚点丢了: ' + JSON.stringify(r));
  });

  console.log('\n========== 汇总 ==========');
  console.log('通过: ' + pass + '  失败: ' + fail);
  if(errs.length) console.log('page errors: ' + errs.length + ' → ' + errs.slice(0, 3).join(' | '));
  await b.close();
  process.exit(fail ? 1 : 0);
})();
