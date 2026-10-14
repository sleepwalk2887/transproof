/* 24: 注释（脚注/尾注）提取 → 筛选 → 翻译 → 贴入/移除（v4.22.0）
   样本 _sample-note.pdf（_gen-note-pdf.js 生成）：
   P1 正文（上标小字 1 + 字面 [2]）+ 页底分隔线 + 脚注 1(带续行)、2；
   P2 正文 + Notes 标题 + 尾注 1、2。 */
const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.log('  ❌ ' + label + (extra !== undefined ? '  → ' + extra : '')); }
};

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true, args: ['--no-sandbox']
  });
  const page = await (await browser.newContext()).newPage();
  const consErr = [], pageErr = [];
  page.on('console', m => { if (m.type() === 'error') consErr.push(m.text()); });
  page.on('pageerror', e => pageErr.push(String(e.message || e)));

  try {
    await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.TransProof && typeof TransProof.parseFile === 'function');

    console.log('===== 1) 注释提取（上传 → parsePdf notes） =====');
    const pdfPath = path.join(__dirname, '..', '_sample-note.pdf');
    if (!fs.existsSync(pdfPath)) execFileSync(process.execPath, [path.join(__dirname, '..', '_gen-note-pdf.js')]);
    await page.setInputFiles('#srcFile', pdfPath);
    await page.waitForFunction(() => {
      const f = TransProof.getFiles().src;
      return f && f.notes && f.notes.length >= 4;
    }, { timeout: 60000 });
    const data = await page.evaluate(() => {
      const f = TransProof.getFiles().src;
      return { kind: f.kind, notes: f.notes, fullText: f.fullText, hasNotes4: f.notes.length === 4 };
    });
    console.log('  kind=' + data.kind + '  notes=' + data.notes.length);
    data.notes.forEach(n => console.log('    [' + n.n + '] kind=' + n.kind + ' p' + n.page + '  ' + n.text.slice(0, 60)));
    ok(data.kind === 'pdf-text', '文字型（kind=pdf-text）', data.kind);
    ok(data.notes.length === 4, '提取 4 条注释（脚注2+尾注2）', 'notes=' + data.notes.length);
    const foot = data.notes.filter(n => n.kind === 'foot');
    const end = data.notes.filter(n => n.kind === 'end');
    ok(foot.length === 2 && foot.every(n => n.page === 1), '脚注 2 条且都在 P1', JSON.stringify(foot.map(n => [n.n, n.page])));
    ok(end.length === 2 && end.every(n => n.page === 2), '尾注 2 条且都在 P2', JSON.stringify(end.map(n => [n.n, n.page])));
    const n1 = foot.find(n => n.n === '1');
    ok(n1 && /First note about the river crossing\..*It was built in 1884\./.test(n1.text), '脚注1 续行已合并', n1 && n1.text);
    ok(!data.fullText.includes('First note about the river crossing'), '脚注文本不再混进正文', data.fullText.slice(-120));
    ok(!data.fullText.includes("Translator's note on terminology"), '尾注文本不再混进正文');
    ok(data.fullText.includes('bridges[1]'), '上标标号包胶成 [1]', (data.fullText.split('\n').find(l => l.includes('bridges')) || '').slice(0, 80));
    ok(data.fullText.includes('marker[2]'), '字面 [2] 保留在正文');

    const barMeta = await page.evaluate(() => (document.querySelector('#srcFileBar .fb-meta') || {}).textContent || '');
    ok(/注释 4 条/.test(barMeta), '文件栏显示注释计数', barMeta);

    console.log('===== 2) 当前章节筛选 + 提示词标号约束 =====');
    const cn = await page.evaluate(() => {
      const r = currentNotes();
      return { listLen: r.list.length, marks: Array.from(r.marks) };
    });
    ok(cn.listLen === 4, 'currentNotes 列出 4 条', cn.listLen);
    ok(cn.marks.includes('1') && cn.marks.includes('2'), '标号识别 [1][2]', cn.marks.join(','));
    const sys = await page.evaluate(() => (typeof buildSystem === 'function' ? buildSystem() : ''));
    ok(typeof sys === 'string' && sys.includes('【注释标号】'), 'buildSystem 含【注释标号】');
    ok(typeof sys === 'string' && sys.includes('不得删除、改写、重排'), '含标号锁定条款');
    const mk = await page.evaluate(() => Array.from(markersIn('[12] (3) ⁴')));
    ok(mk.includes('12') && mk.includes('3') && mk.includes('4'), 'markersIn 认 [12]、(3)、上标⁴', mk.join(','));

    console.log('===== 3) 注释弹窗：勾选 → 批量翻译（mock）→ 贴入 → 移除 =====');
    await page.click('#btn-notes');
    await page.waitForSelector('.fn-chk', { timeout: 5000 });
    const rows = await page.$$eval('.fn-chk', els => els.length);
    const checked = await page.$$eval('.fn-chk', els => els.filter(e => e.checked).length);
    ok(rows === 4, '弹窗 4 行注释', rows);
    ok(checked === 4, '默认按标号全勾选', checked);
    await page.evaluate(() => {
      window.callModel = async () => ({ text: '[{"i":0,"tr":"译注一"},{"i":1,"tr":"译注二"},{"i":2,"tr":"译注三"},{"i":3,"tr":"译注四"}]', usage: {} });
    });
    await page.click('#fn-tr');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.fn-tr')).every(e => e.textContent.trim().length > 0), { timeout: 15000 });
    const trs = await page.$$eval('.fn-tr', els => els.map(e => e.textContent.trim()));
    ok(trs[0] === '译注一' && trs.length === 4, '批量翻译回填 4 条', trs.join(','));

    await page.evaluate(() => window.TransProof.setResult('前文一行'));
    await page.click('#fn-paste');
    const out1 = await page.evaluate(() => window.TransProof.getResult());
    ok(out1.includes('### 注释'), '贴入「### 注释」段');
    ok(out1.startsWith('前文一行'), '原结果保留', out1.slice(0, 20));
    ok(out1.includes('译注一') && out1.includes('原文：'), '默认「译文+原文」双语贴入', out1.slice(-80));
    ok(out1.includes('[1] 译注一'), '贴入条目带 [n] 编号', out1.slice(-100));

    await page.click('#btn-notes');
    await page.waitForSelector('.fn-chk', { timeout: 5000 });
    await page.click('#fn-unpaste');
    const out2 = await page.evaluate(() => window.TransProof.getResult());
    ok(out2 === '前文一行', '「移除已贴注释」还原', out2);

    const nb = await page.evaluate(() => notesBlock([{ n: '9', text: 'src text', tr: 'tr text' }], 'both'));
    ok(nb.includes('[9] tr text') && nb.includes('原文：src text'), 'notesBlock 双语格式', nb);
    const nbs = await page.evaluate(() => notesBlock([{ n: '9', text: 'src text' }], 'src'));
    ok(nbs.includes('[9] src text') && !nbs.includes('原文：'), 'notesBlock 仅原文格式', nbs);

    console.log('===== 4) 错误汇总 =====');
    const consErrF = consErr.filter(t => !/Failed to load resource/.test(t));
    console.log('  console errors: ' + consErrF.length + ' | page errors: ' + pageErr.length);
    ok(consErrF.length === 0, '0 console error', consErrF[0]);
    ok(pageErr.length === 0, '0 page error', pageErr[0]);
  } catch (e) {
    fail++;
    console.log('  ❌ FATAL: ' + (e && e.message ? e.message : e));
  }
  console.log('\n===== 汇总 =====');
  console.log('通过: ' + pass + '  失败: ' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
