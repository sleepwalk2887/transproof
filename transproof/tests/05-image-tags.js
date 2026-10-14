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

  // mock 非流式模型调用（关键词提取用）
  await page.route('**/chat/completions', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    if (!body.stream) {
      const content = JSON.stringify({ tags: [
        { zh: '黑格尔', en: 'Hegel' },
        { zh: '市民社会', en: 'civil society' },
        { zh: '辩证法', en: 'dialectic' }
      ] });
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) });
    } else {
      await r.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: 'data: [DONE]\n\n' });
    }
  });

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.TransProof.fill({ apiKey: 'sk-test', baseUrl: 'http://mock.local/v1' }));

  console.log('===== 需求4：智能配图助手（关键词标签）=====');
  await T('校对工作台 + 翻译工作台都有配图按钮', async () => {
    const r = await page.evaluate(() => ({
      work: !!document.querySelector('#btn-img'),
      trans: !!document.querySelector('#ts-btn-img'),
    }));
    if (!r.work) throw new Error('校对工作台缺少配图按钮');
    if (!r.trans) throw new Error('翻译工作台缺少配图按钮');
  });

  await T('点配图 → AI 提取关键词 → 展示可勾选 tag', async () => {
    await page.click('nav button[data-page="p-work"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      LAST_OUT = '## 一、修订后译文\n\n黑格尔在市民社会语境中论述辩证法。';
      document.querySelector('#btn-img').click();
    });
    await page.waitForFunction(() => document.querySelectorAll('#img-tags-wrap .img-tag').length > 0, { timeout: 20000 });
    const r = await page.evaluate(() => ({
      tagCount: document.querySelectorAll('#img-tags-wrap .img-tag').length,
      hasBaidu: !!document.querySelector('#img-baidu'),
      hasBing: !!document.querySelector('#img-bing'),
      hasPixabay: !!document.querySelector('#img-pixabay'),
      firstTag: document.querySelector('#img-tags-wrap .img-tag').textContent,
    }));
    if (r.tagCount < 3) throw new Error('关键词数量不足: ' + r.tagCount);
    if (!r.hasBaidu || !r.hasBing || !r.hasPixabay) throw new Error('缺少搜索来源按钮（百度/必应/Pixabay）');
    console.log('      提取 ' + r.tagCount + ' 个关键词，首个：' + r.firstTag);
  });

  await T('点选 tag + 手动补充 + 计数正确', async () => {
    const r = await page.evaluate(() => {
      // 点选前两个 tag
      const tags = document.querySelectorAll('#img-tags-wrap .img-tag');
      tags[0].click(); tags[1].click();
      // 手动补充
      const add = document.querySelector('#img-tag-add');
      add.value = '法哲学, 柏林';
      add.dispatchEvent(new Event('change'));
      return {
        onCount: document.querySelectorAll('#img-tags-wrap .img-tag.on').length,
        countText: document.querySelector('#img-tag-count').textContent,
        total: document.querySelectorAll('#img-tags-wrap .img-tag').length,
      };
    });
    if (r.onCount !== 4) throw new Error('应勾选 4 个（2 点选 + 2 手动），实际 ' + r.onCount);
    if (r.countText !== '4') throw new Error('计数显示错误: ' + r.countText);
    if (r.total !== 5) throw new Error('tag 总数应为 5（3 AI + 2 手动），实际 ' + r.total);
    await page.evaluate(() => closeModal());
  });

  await T('勾选后一键跳转搜索（百度/必应/Pixabay）', async () => {
    const r = await page.evaluate(() => {
      window.__opened = [];
      window.open = (url) => { window.__opened.push(url); return null; };
      showImageTags([
        { zh: '黑格尔', en: 'Hegel' },
        { zh: '市民社会', en: 'civil society' },
      ]);
      // 勾选第一个词条
      document.querySelector('#img-tags-wrap .img-tag').click();
      document.querySelector('#img-baidu').click();
      document.querySelector('#img-bing').click();
      document.querySelector('#img-pixabay').click();
      return window.__opened;
    });
    if (r.length !== 3) throw new Error('应打开 3 个搜索页，实际 ' + r.length);
    if (!r[0].includes('image.baidu.com')) throw new Error('百度 URL 错误: ' + r[0]);
    if (!r[1].includes('bing.com/images/search')) throw new Error('必应 URL 错误: ' + r[1]);
    if (!r[2].includes('pixabay.com')) throw new Error('Pixabay URL 错误: ' + r[2]);
    // Pixabay 应优先用英文词 Hegel
    if (!r[2].includes('Hegel')) throw new Error('Pixabay 应用英文词: ' + r[2]);
    console.log('      百度：' + r[0].slice(0, 55) + '…');
    console.log('      Pixabay：' + r[2].slice(0, 55) + '…');
    await page.evaluate(() => closeModal());
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
