/* 23: PDF 行结构保留 + 非文档模式【结构保持】提示词（v4.21.3 换行修复）
   背景：文字型 PDF 原 join(' ') 把整页拍成一行 → 源文换行全丢 → AI 输出无结构 →
   粘贴进 Word 不断行。修复后：按 Y 分组保留行 + 提示词硬约束。 */
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

    console.log('===== 1) 文本型 PDF 解析保留行结构 =====');
    const pdfPath = path.join(__dirname, '..', '_sample.pdf');
    if (!fs.existsSync(pdfPath)) execFileSync(process.execPath, [path.join(__dirname, '..', '_gen-pdf.js')]);
    const b64 = fs.readFileSync(pdfPath).toString('base64');
    const parsed = await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const file = new File([bytes], 'sample.pdf', { type: 'application/pdf' });
      const r = await TransProof.parseFile(file);
      return { kind: r.kind, text: r.chapters.map(c => c.text).join('\n') };
    }, b64);
    const lines = parsed.text.split('\n').map(s => s.trim()).filter(s => s.length);
    console.log('  kind=' + parsed.kind + '  行数=' + lines.length);
    lines.forEach((l, i) => console.log('    [' + i + '] ' + l.slice(0, 60)));
    ok(parsed.kind === 'pdf-text', '文字型走文本层（kind=pdf-text）', parsed.kind);
    ok(lines.length >= 2, '行结构保留（≥2 行）', 'lines=' + lines.length);
    ok(parsed.text.includes('TransProof PDF parse test sample line one'), '第1行存在');
    ok(parsed.text.includes('line two - keeps source line breaks'), '第2行存在且与第1行分行');

    console.log('===== 2) 非文档模式提示词含【结构保持】硬约束 =====');
    const sys = await page.evaluate(() => (typeof buildSystem === 'function' ? buildSystem() : ''));
    ok(typeof sys === 'string' && sys.includes('结构保持'), 'buildSystem 含【结构保持】');
    ok(typeof sys === 'string' && sys.includes('不得把多段合并成一整段'), '含禁止合并段落条款');

    console.log('===== 3) 错误汇总 =====');
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
