/* 27: 导回 Word 修订模式（v4.23.0 P1）
   上传迷你 docx（页内 JSZip 构造）→ 注入假 mammoth（免 CDN）→ setResult 校对结果
   → exportProofreadDocx(true) 抓 dlBlob → 解包断言 w:del/w:ins/作者/pPr/rPr/
   trackChanges；再跑替换模式对照。 */
const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.log('  ❌ ' + label + (extra !== undefined ? '  → ' + extra : '')); }
};

const P1_OLD = 'The bridge was built in 1884 by workers.';
const P2_OLD = 'A second paragraph about the river.';
// 修订输出：段1 workers→laborers（词替换，必然产生 del+ins）；段2 纯追加
const P1_NEW = 'The bridge was built in 1884 by laborers.';
const P2_NEW = 'A second paragraph about the river and the boats.';

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
    await page.waitForFunction(() => window.TransProof && typeof exportProofreadDocx === 'function');

    console.log('===== 1) 注入 mammoth 替身 + 页内构造 docx =====');
    const up = await page.evaluate(async ({ p1, p2 }) => {
      // mammoth 替身：避免测试依赖外网 CDN（loadLib 命中 __TP_LIBS 直接返回）
      __TP_LIBS.mammoth = {
        extractRawText: async () => ({ value: p1 + '\n\n' + p2 }),
        convertToHtml: async () => ({ value: '<p>' + p1 + '</p><p>' + p2 + '</p>' })
      };
      await loadLib('JSZip', [
        'https://registry.npmmirror.com/jszip/3.10.1/files/dist/jszip.min.js',
        'https://cdn.bootcdn.net/ajax/libs/jszip/3.10.1/jszip.min.js',
        'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
        'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js'
      ]);
      const zip = new JSZip();
      zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
      zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
      zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>' + p1 + '</w:t></w:r></w:p><w:p><w:r><w:t>' + p2 + '</w:t></w:r></w:p></w:body></w:document>');
      zip.file('word/settings.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/></w:settings>');
      const blob = await zip.generateAsync({ type: 'blob' });
      const file = new File([blob], 'sample.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const inp = document.querySelector('#dstFile');
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change'));
      return true;
    }, { p1: P1_OLD, p2: P2_OLD });
    await page.waitForFunction(() => {
      const f = typeof __TP_FILES !== 'undefined' ? __TP_FILES.dst : null;
      return f && f.kind === 'docx' && f._zipBytes;
    }, { timeout: 30000 });
    const uploaded = await page.evaluate(() => ({
      kind: __TP_FILES.dst.kind,
      name: __TP_FILES.dst.fileName,
      hasZip: !!__TP_FILES.dst._zipBytes
    }));
    console.log('  kind=' + uploaded.kind + '  name=' + uploaded.name + '  zip=' + uploaded.hasZip);
    ok(uploaded.kind === 'docx', 'docx 解析成功（fake mammoth）', uploaded.kind);
    ok(uploaded.hasZip, '_zipBytes 已保留（回写引擎依赖）', uploaded.hasZip);

    console.log('===== 2) 修订模式导出 =====');
    const trackRes = await page.evaluate(async ({ p1, p2 }) => {
      window.__cap = null;
      window.dlBlob = (name, blob) => { window.__cap = { name, blob }; };
      TransProof.setResult('## 一、修订后译文\n\n' + p1 + '\n\n' + p2);
      await exportProofreadDocx(true);
      if (!window.__cap) return { err: 'no capture' };
      const ab = await window.__cap.blob.arrayBuffer();
      const bytes = new Uint8Array(ab);
      let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      const zip = await JSZip.loadAsync(ab);
      const xml = await zip.file('word/document.xml').async('string');
      const stf = zip.file('word/settings.xml');
      const st = stf ? await stf.async('string') : '';
      return {
        name: window.__cap.name, size: bytes.length, xml: xml, st: st,
        hasDel: /<w:del[\s>]/.test(xml), hasDelText: /<w:delText/.test(xml),
        hasIns: /<w:ins[\s>]/.test(xml),
        author: /w:author="TransProof"/.test(xml),
        ids: (xml.match(/w:id="/g) || []).length,
        pPr: /<w:spacing[^>]*w:after="120"/.test(xml),
        rPr: /<w:b[\s/>]/.test(xml),
        track: /<w:trackChanges/.test(st),
        delWord: /<w:delText[^>]*>workers\.<\/w:delText>|<w:delText[^>]*>workers/.test(xml),
        insWord: /laborers/.test(xml),
        equalP2: /A second paragraph about the river/.test(xml),
        xmlDecl: (xml.match(/<\?xml/g) || []).length
      };
    }, { p1: P1_NEW, p2: P2_NEW });
    if (trackRes.err) { ok(false, '修订导出产出', trackRes.err); throw new Error(trackRes.err); }
    console.log('  file=' + trackRes.name + '  size=' + trackRes.size + '  w:id×' + trackRes.ids);
    ok(trackRes.name === '校对修订_sample.docx', '文件名带「校对修订_」前缀', trackRes.name);
    ok(trackRes.hasDel && trackRes.hasDelText, '生成 w:del + w:delText');
    ok(trackRes.hasIns, '生成 w:ins');
    ok(trackRes.delWord, '旧词 workers 落在 delText（删除线）', trackRes.delWord);
    ok(trackRes.insWord, '新词 laborers 落在插入', trackRes.insWord);
    ok(trackRes.author, 'w:author=TransProof', trackRes.author);
    ok(trackRes.ids >= 2, 'w:id 唯一递增（≥2 处修订）', trackRes.ids);
    ok(trackRes.pPr, '段落格式 w:pPr 保留（spacing）', trackRes.pPr);
    ok(trackRes.rPr, '首 run 样式模板 rPr 保留（加粗）', trackRes.rPr);
    ok(trackRes.track, 'settings.xml 加 w:trackChanges', trackRes.track);
    ok(trackRes.equalP2, '未改动文字保留', trackRes.equalP2);
    ok(trackRes.xmlDecl === 1, '仅 1 条 <?xml?> 声明（防 Word 判损坏）', trackRes.xmlDecl);

    console.log('===== 3) 替换模式对照（原功能不回归） =====');
    const plainRes = await page.evaluate(async () => {
      window.__cap = null;
      await exportProofreadDocx(false);
      if (!window.__cap) return { err: 'no capture' };
      const ab = await window.__cap.blob.arrayBuffer();
      const zip = await JSZip.loadAsync(ab);
      const xml = await zip.file('word/document.xml').async('string');
      return {
        name: window.__cap.name,
        hasIns: /<w:ins[\s>]/.test(xml), hasDel: /<w:del[\s>]/.test(xml),
        laborers: /laborers/.test(xml),
        noDelText: !/<w:delText/.test(xml)
      };
    });
    if (plainRes.err) { ok(false, '替换导出产出', plainRes.err); }
    else {
      ok(plainRes.name === '校对后_sample.docx', '替换模式文件名不变', plainRes.name);
      ok(!plainRes.hasIns && !plainRes.hasDel && plainRes.noDelText, '替换模式无修订标记');
      ok(plainRes.laborers, '替换模式文字已更新', plainRes.laborers);
    }

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
