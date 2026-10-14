const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

(async () => {
  const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrs = [], pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('tp.cfg') || '{}');
    c.apiKey = 'test-key';
    c.baseUrl = 'https://api.example.com';
    c.model = 'test-model';
    localStorage.setItem('tp.cfg', JSON.stringify(c));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);

  console.log('===== 校对前「质量预估」（P1）=====');

  // 1) 按钮存在
  const btnExists = await page.evaluate(() => !!document.getElementById('btn-estimate'));
  console.log('  ' + (btnExists ? '✅' : '❌') + ' 按钮存在');

  // 2) 空译文时点按钮 → 不弹窗（toast 提示）
  await page.click('#btn-estimate');
  await page.waitForTimeout(300);
  const closedWhenEmpty = await page.evaluate(() => !document.getElementById('modal').classList.contains('on'));
  console.log('  ' + (closedWhenEmpty ? '✅' : '❌') + ' 空译文不弹窗');

  // 3) mock callModelSimple → 填译文 → 点按钮 → 弹窗渲染评分/等级/总结/阶段/工作量/热点
  const res = await page.evaluate(async () => {
    window.callModelSimple = async () => ({
      text: JSON.stringify({
        score: 72,
        level: 'B',
        summary: '整体流畅，术语基本准确，但后半部分中文稍显生硬。',
        hotspots: [
          { para: '第2段', issue: 'hegemony 前后译法不一致' },
          { para: '第5段', issue: '长句未切分，中文不通顺' }
        ],
        suggestStage: '一校',
        effort: '中'
      })
    });
    document.getElementById('dst').value = '这是需要校对的译文。黑格尔的 hegemony 概念与 Aufhebung 都需要仔细核对。';
    document.getElementById('btn-estimate').click();
    await new Promise(r => setTimeout(r, 800));
    const body = document.getElementById('mBody').textContent;
    return {
      modalOpen: document.getElementById('modal').classList.contains('on'),
      title: document.getElementById('mTitle').textContent,
      body,
      hasScore: body.includes('72'),
      hasLevel: body.includes('B'),
      hasSummary: body.includes('整体流畅'),
      hasStage: body.includes('一校'),
      hasEffort: body.includes('中'),
      hasHotspot: body.includes('hegemony') && body.includes('第2段'),
    };
  });
  console.log('  title=' + res.title + '  modalOpen=' + res.modalOpen);
  const checks = {
    modalOpen: res.modalOpen,
    title: res.title.includes('质量预估'),
    score: res.hasScore,
    level: res.hasLevel,
    summary: res.hasSummary,
    stage: res.hasStage,
    effort: res.hasEffort,
    hotspot: res.hasHotspot,
  };
  for (const [k, v] of Object.entries(checks)) console.log('  ' + (v ? '✅' : '❌') + ' ' + k);

  // 4) mock 返回 markdown 围栏 JSON → 仍能解析（容错）
  const fenced = await page.evaluate(async () => {
    window.callModelSimple = async () => ({
      text: '```json\n{"score":95,"level":"A","summary":"优秀","hotspots":[],"suggestStage":"二校","effort":"小"}\n```'
    });
    document.getElementById('btn-estimate').click();
    await new Promise(r => setTimeout(r, 800));
    return document.getElementById('mBody').textContent;
  });
  const fencedOk = fenced.includes('95') && fenced.includes('A') && fenced.includes('二校');
  console.log('  ' + (fencedOk ? '✅' : '❌') + ' markdown 围栏 JSON 可解析');

  const allOk = btnExists && closedWhenEmpty && Object.values(checks).every(Boolean) && fencedOk;

  console.log('\n===== 错误汇总 =====');
  console.log('  console errors:', consoleErrs.length);
  consoleErrs.slice(0, 20).forEach(e => console.log('    [console]', e));
  console.log('  page errors:', pageErrors.length);
  pageErrors.slice(0, 20).forEach(e => console.log('    [pageerror]', e));

  const pass = allOk && consoleErrs.length === 0 && pageErrors.length === 0;
  console.log('\n===== 汇总 =====');
  console.log(pass ? '✅ 全部通过' : '❌ 存在失败');
  await browser.close();
  if (!pass) process.exit(1);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
