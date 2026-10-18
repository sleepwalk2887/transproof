const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

(async () => {
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrs = [], pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  let pass = 0, fail = 0;
  const T = async (name, fn) => {
    try { await fn(); pass++; console.log('  ✅ ' + name); }
    catch (e) { fail++; console.log('  ❌ ' + name + ' → ' + e.message); }
  };

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  console.log('===== 三栏逐句对照视图（T-001 · v4.30.0 · 零 token） =====');

  const SRC = 'It is argued that the modern subject is constituted through discipline.\n\nThe inmate internalises the gaze. Surveillance becomes superfluous.';
  const DST = '有人认为，现代主体是通过规训构成的。\n\n囚犯将目光内化。监视变得多余。';
  const OUT = '## 一、修订后译文\n\n有人认为，现代主体是通过规训机制构成的。\n\n囚犯把目光内化。监视因此变得多余。\n\n## 二、逐条批注\n\n- [术语] **规训** → 改为「规训机制」：与原文对应更准\n- [表达] **将目光内化** → 改为「把目光内化」：口语更自然\n';

  const seed = async () => {
    await page.evaluate(({ SRC, DST, OUT }) => {
      document.querySelector('#src').value = SRC;
      document.querySelector('#dst').value = DST;
      LAST_OUT = OUT;
      syncOutView();
    }, { SRC, DST, OUT });
  };

  await T('三栏模型：段落/句数/批注解析正确', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const M = triBuild();
      return {
        nPara: M.nPara, rows: M.rows.length, edits: M.edits.length,
        sents2: M.rows.filter(x => x.para === 2).length,
        first: M.rows[0].neu, last: M.rows[M.rows.length - 1].neu,
      };
    });
    if (r.nPara !== 2) throw new Error('应 2 段，实际 ' + r.nPara);
    if (r.sents2 !== 2) throw new Error('第 2 段应切成 2 句，实际 ' + r.sents2);
    if (r.rows !== 3) throw new Error('总行数应 3，实际 ' + r.rows);
    if (r.edits !== 2) throw new Error('应解析 2 条批注，实际 ' + r.edits);
    if (r.first.indexOf('规训机制') < 0) throw new Error('第 1 行修订列不对: ' + r.first);
    if (r.last.indexOf('因此') < 0) throw new Error('末行修订列不对: ' + r.last);
  });

  await T('切换条出现 + 三栏渲染（原文/原译/修订）', async () => {
    await page.evaluate(() => { document.querySelector('#btn-view-tri').click(); });
    const r = await page.evaluate(() => ({
      segShown: getComputedStyle(document.querySelector('#view-seg')).display !== 'none',
      triShown: getComputedStyle(document.querySelector('#out-tri')).display !== 'none',
      outHidden: getComputedStyle(document.querySelector('#out')).display === 'none',
      heads: [...document.querySelectorAll('.tri-head > div')].map(x => x.textContent),
      rows: document.querySelectorAll('.tri-row').length,
      add: document.querySelectorAll('.tri-add').length,
      del: document.querySelectorAll('.tri-del').length,
      copy: !!document.querySelector('#tri-copy'),
      copyRev: !!document.querySelector('#tri-copy-rev'),
      back: !!document.querySelector('#tri-back'),
    }));
    if (!r.segShown) throw new Error('切换条没显示');
    if (!r.triShown || !r.outHidden) throw new Error('三栏视图没有替换文档视图');
    if (r.heads.length !== 3) throw new Error('应有 3 个栏头，实际 ' + r.heads.length);
    if (r.heads[0].indexOf('原文') < 0 || r.heads[1].indexOf('原译') < 0 || r.heads[2].indexOf('修订') < 0) throw new Error('栏头文字不对: ' + r.heads.join('|'));
    if (r.rows !== 3) throw new Error('应 3 行，实际 ' + r.rows);
    if (r.add < 2) throw new Error('修订列应至少 2 处绿色高亮，实际 ' + r.add);
    if (r.del < 1) throw new Error('原译列应有红色删除线，实际 ' + r.del);
    if (!r.copy || !r.copyRev || !r.back) throw new Error('缺少复制/返回按钮');
  });

  await T('段落对齐不串行：第 1 段不含第 2 段文字', async () => {
    const r = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.tri-row[data-para="1"]')];
      const rows2 = [...document.querySelectorAll('.tri-row[data-para="2"]')];
      return {
        p1: rows.map(x => x.textContent).join(' '),
        p2: rows2.map(x => x.textContent).join(' '),
        p1Count: rows.length, p2Count: rows2.length,
      };
    });
    if (r.p1Count !== 1) throw new Error('第 1 段应 1 行，实际 ' + r.p1Count);
    if (r.p2Count !== 2) throw new Error('第 2 段应 2 行，实际 ' + r.p2Count);
    if (r.p1.indexOf('囚犯') >= 0) throw new Error('第 1 段串入了第 2 段文字');
    if (r.p2.indexOf('现代主体') >= 0) throw new Error('第 2 段串入了第 1 段文字');
  });

  await T('句级切分：同段两句分列两行且各归各句', async () => {
    const r = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.tri-row[data-para="2"]')];
      return {
        a: rows[0] ? rows[0].querySelector('.tri-cell.old').textContent : '',
        b: rows[1] ? rows[1].querySelector('.tri-cell.old').textContent : '',
      };
    });
    if (r.a.indexOf('囚犯') < 0 || r.a.indexOf('监视') >= 0) throw new Error('第 2 段第 1 句切分错误: ' + r.a);
    if (r.b.indexOf('监视') < 0 || r.b.indexOf('囚犯') >= 0) throw new Error('第 2 段第 2 句切分错误: ' + r.b);
  });

  await T('未填原文时给出「未填写」提示，不报错', async () => {
    const r = await page.evaluate(() => {
      document.querySelector('#src').value = '';
      renderTriView();
      const head = document.querySelector('.tri-head > div').textContent;
      const body = document.querySelector('#out-tri').textContent;
      return { head, hasEmpty: body.indexOf('未填写原文') >= 0, rows: document.querySelectorAll('.tri-row').length };
    });
    if (r.head.indexOf('未填写') < 0) throw new Error('栏头没标「未填写」: ' + r.head);
    if (!r.hasEmpty) throw new Error('原文列没显示「未填写原文」');
    if (r.rows !== 3) throw new Error('未填原文时行数应不变，实际 ' + r.rows);
    await page.evaluate(({ SRC }) => { document.querySelector('#src').value = SRC; renderTriView(); }, { SRC });
  });

  await T('回文档视图：原结果原样回来', async () => {
    await page.evaluate(() => { document.querySelector('#tri-back').click(); });
    const r = await page.evaluate(() => ({
      triHidden: getComputedStyle(document.querySelector('#out-tri')).display === 'none',
      outShown: getComputedStyle(document.querySelector('#out')).display !== 'none',
      onDoc: document.querySelector('#btn-view-doc').classList.contains('vs-on'),
    }));
    if (!r.triHidden || !r.outShown) throw new Error('没有正确切回文档视图');
    if (!r.onDoc) throw new Error('文档视图按钮没高亮');
  });

  await T('无结果时切换条隐藏、不残留三栏', async () => {
    const r = await page.evaluate(() => {
      LAST_OUT = '';
      syncOutView();
      return {
        seg: getComputedStyle(document.querySelector('#view-seg')).display,
        tri: getComputedStyle(document.querySelector('#out-tri')).display,
        view: typeof OUT_VIEW === 'string' ? OUT_VIEW : '',
      };
    });
    if (r.seg !== 'none') throw new Error('无结果时切换条应隐藏，实际 ' + r.seg);
    if (r.tri !== 'none') throw new Error('无结果时三栏应隐藏');
    if (r.view !== 'doc') throw new Error('无结果时应回文档视图，实际 ' + r.view);
  });

  await T('既有按钮 id 全部保留（不回归）', async () => {
    const r = await page.evaluate(() => ({
      ids: ['btn-run', 'btn-diff', 'btn-out-edit', 'btn-md', 'btn-copy', 'btn-pause', 'btn-stop', 'post-bar', 'err-filter', 'stage-next', 'out', 'stats']
        .filter(id => !document.getElementById(id)),
    }));
    if (r.ids.length) throw new Error('这些 id 丢了: ' + r.ids.join(','));
  });

  console.log('\n========== 汇总 ==========');
  console.log('通过: ' + pass + '  失败: ' + fail);
  console.log('console errors: ' + consoleErrs.length);
  consoleErrs.slice(0, 10).forEach(e => console.log('  [console]', e));
  console.log('page errors: ' + pageErrors.length);
  pageErrors.slice(0, 10).forEach(e => console.log('  [pageerror]', e));

  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
