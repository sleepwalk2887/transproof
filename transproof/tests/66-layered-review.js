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

  // 1. 导出 + 按钮 + 旧锚点
  t('layeredRun 导出', await page.evaluate(() => typeof window.layeredRun === 'function'));
  t('#btn-layered 存在', await page.evaluate(() => !!document.getElementById('btn-layered')));
  t('旧锚点 #btn-score 未动', await page.evaluate(() => !!document.getElementById('btn-score')));
  t('旧锚点 #btn-pnoun 未动', await page.evaluate(() => !!document.getElementById('btn-pnoun')));
  t('旧锚点 #ao-pnoun 未动', await page.evaluate(() => !!document.getElementById('ao-pnoun')));
  t('APP_VERSION 三段式', await page.evaluate(() => typeof APP_VERSION === 'string' && APP_VERSION.split('.').length === 3));

  // 2. 设置 mock（modal/toast/callModelSimple）
  await page.evaluate(() => {
    window.__modalCalls = 0; window.__modalHtml = ''; window.__toasts = []; window.__llmCalls = 0;
    modal = function(t, h){ window.__modalCalls++; window.__modalTitle = t; window.__modalHtml = h; var mb = document.getElementById('mBody'); if(mb) mb.innerHTML = h; };
    toast = function(m, k){ window.__toasts.push(m); };
    callModelSimple = async function(){ window.__llmCalls++; return { text: '[]' }; };
  });

  // 3. 评分未跑 → 提示，不弹 modal
  await page.evaluate(() => { localStorage.removeItem('tp.sentence'); });
  const noRun = await page.evaluate(() => { layeredRun(); return { calls: window.__modalCalls, toasts: window.__toasts.slice() }; });
  t('评分未跑弹提示', noRun.toasts.some(m => m.indexOf('先点') >= 0 || m.indexOf('逐句评分') >= 0));
  t('评分未跑不弹 modal', noRun.calls === 0);

  // 4. 评分已跑 → 三档分组
  await page.evaluate(() => {
    localStorage.setItem('tp.sentence', JSON.stringify({ rev: 1, items: [
      { seg: '红档句', idx: 1, score: 2, comment: '差' },
      { seg: '黄档句', idx: 2, score: 3, comment: '一般' },
      { seg: '绿档句甲', idx: 3, score: 5, comment: '好' },
      { seg: '绿档句乙', idx: 4, score: 4, comment: '尚可' }
    ] }));
  });
  const ran = await page.evaluate(() => { layeredRun(); return { html: window.__modalHtml, title: window.__modalTitle, calls: window.__modalCalls }; });
  t('弹了 modal', ran.calls === 1);
  t('汇总红 1', ran.html.indexOf('红 1') >= 0);
  t('汇总黄 1', ran.html.indexOf('黄 1') >= 0);
  t('汇总绿 2', ran.html.indexOf('绿 2') >= 0);
  t('含红档标题', ran.html.indexOf('红档') >= 0);
  t('含黄档标题', ran.html.indexOf('黄档') >= 0);
  t('含绿档标题', ran.html.indexOf('绿档') >= 0);
  t('含批量加入按钮', ran.html.indexOf('全部红档加入') >= 0);
  t('含抽样展示标注', ran.html.indexOf('抽样展示') >= 0);

  // 5. 零 LLM 调用
  const llm = await page.evaluate(() => window.__llmCalls);
  t('全程 0 次 LLM 调用', llm === 0);

  // 6. 批量加入红档 → HARD_ITEMS 长度变化
  const before = await page.evaluate(() => (typeof HARD_ITEMS === 'undefined' || !Array.isArray(HARD_ITEMS)) ? 0 : HARD_ITEMS.length);
  const after = await page.evaluate(() => { const b = document.getElementById('lr-add-all'); if(b) b.onclick(); return (typeof HARD_ITEMS === 'undefined' || !Array.isArray(HARD_ITEMS)) ? 0 : HARD_ITEMS.length; });
  t('批量加入红档 +1', after === before + 1);
  t('红档句进疑问清单', await page.evaluate(() => (typeof HARD_ITEMS !== 'undefined' && Array.isArray(HARD_ITEMS)) && HARD_ITEMS.some(h => h && h.seg === '红档句')));

  t('无页面错误', errors.length === 0);
  console.log('PASS=' + pass + ' FAIL=' + fail + ' TOTAL=' + (pass + fail));
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
