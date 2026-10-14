const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

(async () => {
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrs = [], pageErrors = [];
  // CDN 多源兜底时首个源（jsdelivr）失败会触发浏览器自动记录的
  // "Failed to load resource: net::ERR_*"，属预期兜底副作用而非产品 JS 错误，过滤之
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  let pass = 0, fail = 0, skip = 0;
  const T = async (name, fn) => {
    try { await fn(); pass++; console.log('  ✅ ' + name); }
    catch (e) { fail++; console.log('  ❌ ' + name + ' → ' + e.message); }
  };

  // mock 模型调用：非流式（反推用）返回 JSON 反推结果
  await page.route('**/chat/completions', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    if (!body.stream) {
      const content = JSON.stringify({
        name: '学术文本翻译规范',
        styleTags: ['学术', '直译'],
        core: '忠实原文，术语统一',
        fullPrompt: '你是一位学术翻译，要求忠实原文、术语统一、中文地道。'
      });
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
    } else {
      await r.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: 'data: [DONE]\n\n' });
    }
  });

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.TransProof.fill({ apiKey: 'sk-test', baseUrl: 'http://mock.local/v1' }));

  console.log('===== 测试 1：从原文反推（无译文路径）=====');
  await T('入口卡片存在', async () => {
    await page.click('nav button[data-page="p-prompt"]');
    await page.waitForTimeout(300);
    const ok = await page.evaluate(() => !!document.querySelector('.pm-entry[data-source="from-original"]'));
    if (!ok) throw new Error('未找到「从原文反推」入口');
  });

  await T('无译文反推 → 预览可编辑 → 入库', async () => {
    await page.evaluate(() => document.querySelector('.pm-entry[data-source="from-original"] [data-act="open"]').click());
    await page.waitForTimeout(300);
    await page.fill('#fo-src', 'Hegel discusses the notion of Aufhebung in his Logic.');
    await page.click('#fo-go');
    await page.waitForFunction(() => !!document.querySelector('#rev-full'), { timeout: 20000 });
    await page.waitForTimeout(150); // 等 renderReverseResult 的 setTimeout 绑定完 rev-save 事件
    const preview = await page.evaluate(() => ({
      name: document.querySelector('#rev-name')?.value,
      full: document.querySelector('#rev-full')?.value,
      editable: !!document.querySelector('#rev-full') && !document.querySelector('#rev-full').readOnly,
    }));
    if (!preview.name.includes('学术')) throw new Error('反推名称异常: ' + preview.name);
    if (!preview.full) throw new Error('反推 fullPrompt 为空');
    if (!preview.editable) throw new Error('反推结果不可编辑');
    // 人工编辑名称，验证可编辑性落地
    await page.fill('#rev-name', '我的自定义名称');
    await page.click('#rev-save');
    await page.waitForTimeout(500);
    const cnt = await page.evaluate(() => PROMPTS.prompts.length);
    if (cnt < 1) throw new Error('入库后 Prompt 库仍为空');
    const lastName = await page.evaluate(() => PROMPTS.prompts[PROMPTS.prompts.length - 1].name);
    if (lastName !== '我的自定义名称') throw new Error('人工编辑未生效，实际: ' + lastName);
    console.log('      Prompt 库条目数: ' + cnt + '，最新条目名: ' + lastName);
  });

  console.log('\n===== 测试 2：扫描报告 + 导出按钮 =====');
  await page.evaluate(() => closeModal()); // 确保上一个弹窗已关
  await T('文件栏渲染扫描报告与导出 docx 按钮', async () => {
    await page.click('nav button[data-page="p-work"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      __TP_FILES.src = {
        kind: 'pdf-mixed', fileName: 'test.pdf',
        chapters: [{ title: '全部', text: '测试文字' }], fullText: '测试文字', hasImages: true,
        scanReport: [
          { page: 1, method: '文本层', chars: 100, conf: null },
          { page: 2, method: 'OCR', chars: 50, conf: 88 },
          { page: 3, method: 'OCR', chars: 0, conf: 40 }
        ]
      };
      renderFileBar('src');
    });
    const bar = await page.evaluate(() => ({
      scanBtn: [...document.querySelectorAll('#srcFileBar button')].some(b => b.textContent.includes('扫描报告')),
      exportBtn: [...document.querySelectorAll('#srcFileBar button')].some(b => b.textContent.includes('导出原文 docx')),
      warn: [...document.querySelectorAll('#srcFileBar button')].some(b => b.textContent.includes('⚠')),
    }));
    if (!bar.scanBtn) throw new Error('扫描报告按钮未出现');
    if (!bar.exportBtn) throw new Error('导出 docx 按钮未出现');
    if (!bar.warn) throw new Error('含空白/低置信度页时应有 ⚠ 警告标记');
  });

  await T('扫描报告弹窗内容正确', async () => {
    await page.evaluate(() => {
      [...document.querySelectorAll('#srcFileBar button')].find(b => b.textContent.includes('扫描报告')).click();
    });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => ({
      on: document.querySelector('#modal').classList.contains('on'),
      txt: document.querySelector('#modal').textContent,
    }));
    if (!m.on) throw new Error('报告弹窗未打开');
    if (!m.txt.includes('空白') || !m.txt.includes('低置信度')) throw new Error('报告未标记空白页/低置信度');
    await page.evaluate(() => closeModal());
  });

  console.log('\n===== 测试 3：原文导出 docx =====');
  await T('buildDocxFromChapters 生成有效 docx', async () => {
    const r = await page.evaluate(async () => {
      try {
        const blob = await buildDocxFromChapters([
          { title: '第一章', text: '这是第一段。\n\n这是第二段。' },
          { title: '第二章', text: '这是第二章内容。' }
        ]);
        const zip = await window.JSZip.loadAsync(blob);
        const xml = await zip.file('word/document.xml').async('string');
        return { ok: true, size: blob.size, hasTitle: xml.includes('第一章'), hasText: xml.includes('第一段') };
      } catch (e) { return { ok: false, err: e.message }; }
    });
    if (!r.ok) {
      if (/加载|无法加载/.test(r.err)) { skip++; console.log('  ⏭ 跳过（JSZip CDN 不可达）: ' + r.err); return; }
      throw new Error('docx 生成失败: ' + r.err);
    }
    if (!r.hasTitle || !r.hasText) throw new Error('docx 内容缺失: ' + JSON.stringify(r));
    console.log('      docx blob ' + r.size + ' 字节，标题/正文均写入 ✓');
  });

  console.log('\n===== 测试 4：PDF 逐页 OCR（mock pdf.js/tesseract）=====');
  await T('混合型 PDF 逐页判断 + scanReport 生成', async () => {
    const r = await page.evaluate(async () => {
      const mockPdfJs = {
        GlobalWorkerOptions: {},
        getDocument: () => ({
          promise: Promise.resolve({
            numPages: 3,
            getOutline: async () => [],
            getPage: async (p) => ({
              getTextContent: async () => p === 1
                ? { items: [{ str: 'Hello this is page one with plenty of readable text content here' }] }
                : { items: [] },
              getViewport: ({ scale }) => ({ width: 100 * scale, height: 100 * scale }),
              render: async () => {},
            }),
          }),
        }),
      };
      const mockTesseract = { recognize: async () => ({ data: { text: 'OCR识别的文字', confidence: 90 } }) };
      window.pdfjsLib = mockPdfJs; __TP_LIBS.pdfjs = mockPdfJs;
      window.Tesseract = mockTesseract; __TP_LIBS.Tesseract = mockTesseract;
      const fakeFile = { name: 'mixed.pdf', arrayBuffer: async () => new ArrayBuffer(10) };
      const result = await parsePdf(fakeFile, () => {});
      return { kind: result.kind, report: result.scanReport, fullText: result.fullText, hasImages: result.hasImages };
    });
    if (r.kind !== 'pdf-mixed') throw new Error('应为 pdf-mixed，实际: ' + r.kind);
    if (r.report.length !== 3) throw new Error('scanReport 应 3 页，实际 ' + r.report.length);
    if (r.report[0].method !== '文本层') throw new Error('第1页应为文本层');
    if (r.report[1].method !== 'OCR' || r.report[2].method !== 'OCR') throw new Error('第2/3页应触发 OCR');
    if (!r.fullText.includes('OCR识别的文字')) throw new Error('OCR 结果未并入全文');
    console.log('      kind=' + r.kind + '，逐页：' + r.report.map(x => x.page + ':' + x.method).join('，'));
  });

  console.log('\n===== 测试 5：决策面板一键全部入术语库 =====');
  await T('点选优先、未点选用推荐译法', async () => {
    await page.click('nav button[data-page="p-work"]');
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
      TERMS.length = 0;
      const text = '### 词条：hegemony\n\n**通行译法**：\n- 霸权（主流）：压制\n- 领导权（葛兰西）：引领\n\n**本语境推荐**：领导权\n\n### 词条：Aufhebung\n\n**通行译法**：\n- 扬弃（黑格尔）：矛盾\n- 废弃（恩格斯）：丢失\n\n**本语境推荐**：扬弃';
      renderDecisionPanel(text);
      // 点选 hegemony 的「霸权」（非推荐），Aufhebung 不点
      const items = document.querySelectorAll('#decision-panel .dp-item');
      [...items[0].querySelectorAll('.dp-chip')].find(c => c.dataset.val === '霸权').click();
      document.querySelector('#dp-importall').click();
      return TERMS.map(t => t.src + '=' + t.dst);
    });
    if (r.length !== 2) throw new Error('应入库 2 条，实际 ' + r.length + ': ' + JSON.stringify(r));
    if (!r.includes('hegemony=霸权')) throw new Error('hegemony 未按点选译法入库: ' + JSON.stringify(r));
    if (!r.includes('Aufhebung=扬弃')) throw new Error('Aufhebung 未按推荐译法入库: ' + JSON.stringify(r));
    console.log('      入库：' + r.join('，'));
  });

  console.log('\n========== 汇总 ==========');
  console.log('通过: ' + pass + '  失败: ' + fail + '  跳过: ' + skip);
  console.log('console errors: ' + consoleErrs.length);
  consoleErrs.slice(0, 10).forEach(e => console.log('  [console]', e));
  console.log('page errors: ' + pageErrors.length);
  pageErrors.slice(0, 10).forEach(e => console.log('  [pageerror]', e));

  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
