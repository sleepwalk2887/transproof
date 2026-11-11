const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let pass = 0, fail = 0;
function T(name, ok){ if(ok){ pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } }
(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('http://127.0.0.1:8123/index.html');
  await page.waitForTimeout(1000);
  const api = await page.evaluate(() => ({
    parseEpub: typeof window.parseEpub,
    build: typeof window.buildEpubFromChapters,
    appv: (window.__APP_INFO && window.__APP_INFO.appv) || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : null),
    hasBtnPnoun: !!document.querySelector('#btn-pnoun'),
    hasTsSrc: !!document.querySelector('#ts-src')
  }));
  T('parseEpub 导出', api.parseEpub === 'function');
  T('buildEpubFromChapters 导出', api.build === 'function');
  T('APP_VERSION 三段式', typeof api.appv === 'string' && api.appv.split('.').length === 3);
  T('旧锚点 #btn-pnoun 未动', api.hasBtnPnoun);
  T('翻译工作台 #ts-src 在', api.hasTsSrc);
  const res = await page.evaluate(async () => {
    const JSZip = await window.loadLib('JSZip', ['https://registry.npmmirror.com/jszip/3.10.1/files/dist/jszip.min.js', 'https://cdn.bootcdn.net/ajax/libs/jszip/3.10.1/jszip.min.js', 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js']);
    if(!JSZip) return { err: 'JSZip 未加载' };
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file('META-INF/container.xml', '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    zip.file('OEBPS/content.opf', '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata><dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">测试书</dc:title></metadata><manifest><item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="ch2.xhtml" media-type="application/xhtml+xml"/><item id="img" href="cover.png" media-type="image/png"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>');
    zip.file('OEBPS/ch1.xhtml', '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>第一章</title></head><body><h1>第一章 开始</h1><p>这是第一段。</p><p>这是第二段。</p></body></html>');
    zip.file('OEBPS/ch2.xhtml', '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>第二章</title></head><body><h1>第二章 继续</h1><p>第二章节一段。</p></body></html>');
    zip.file('OEBPS/cover.png', new Uint8Array([1,2,3,4]));
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
    const file = new File([blob], 'test.epub', { type: 'application/epub+zip' });
    const data = await window.parseEpub(file, null);
    data.chapters[0].text = '第一章译文。';
    data.chapters[1].text = '第二章译文。';
    const outBlob = await window.buildEpubFromChapters(data._epub, data.chapters);
    const outZip = await JSZip.loadAsync(await outBlob.arrayBuffer());
    const ch1 = await outZip.file('OEBPS/ch1.xhtml').async('text');
    const ch2 = await outZip.file('OEBPS/ch2.xhtml').async('text');
    const cover = outZip.file('OEBPS/cover.png');
    return {
      kind: data.kind,
      chaptersLen: data.chapters.length,
      title0: data.chapters[0].title,
      title1: data.chapters[1].title,
      bookTitle: data._epub.bookTitle,
      spineLen: data._epub.spine.length,
      fullTextHasCh1: data.fullText.indexOf('这是第一段') >= 0,
      ch1HasTrans: ch1.indexOf('第一章译文') >= 0,
      ch2HasTrans: ch2.indexOf('第二章译文') >= 0,
      coverKept: !!cover,
      hasImages: data.hasImages,
      mimeOk: outBlob.type === 'application/epub+zip'
    };
  });
  if(res.err){ T('构造 EPUB：' + res.err, false); }
  else {
    T('kind=epub', res.kind === 'epub');
    T('chapters=2', res.chaptersLen === 2);
    T('章1标题', res.title0 === '第一章 开始');
    T('章2标题', res.title1 === '第二章 继续');
    T('书名', res.bookTitle === '测试书');
    T('spine=2', res.spineLen === 2);
    T('fullText 含正文', res.fullTextHasCh1);
    T('ch1 译文写回', res.ch1HasTrans);
    T('ch2 译文写回', res.ch2HasTrans);
    T('图片保留', res.coverKept);
    T('hasImages', res.hasImages === true);
    T('mime=epub+zip', res.mimeOk);
  }
  T('无页面错误', pageErrors.length === 0);
  if(pageErrors.length) console.log('  pageErrors:', pageErrors.slice(0,3));
  await browser.close();
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('EXC', e); process.exit(1); });