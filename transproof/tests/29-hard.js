// 29-hard.js — 疑难句标注（AI 提议·人拍板）+ 原文/译文整理
const path = require('path');
const { chromium } = require(path.join('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core'));
const EXE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://127.0.0.1:8123/index.html';

let pass = 0, fail = 0;
async function T(name, fn) {
  try { await fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + ' → ' + (e && e.message)); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });

  console.log('===== 29 疑难句标注 + 整理 =====');
  await page.goto(URL, { waitUntil: 'load' });
  // 种 Key：hardSentences/tidyText 有无 Key 守卫（无 Key 会跳设置页而不是弹窗）
  await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('tp.cfg') || '{}');
    c.apiKey = 'test-key';
    c.baseUrl = 'https://api.example.com';
    c.model = 'test-model';
    localStorage.setItem('tp.cfg', JSON.stringify(c));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(600);

  // 按钮存在（分组后仍可点）
  const btns = await page.evaluate(() => ({
    hard: !!document.getElementById('btn-hard'),
    tidyS: !!document.getElementById('btn-tidy-src'),
    tidyD: !!document.getElementById('btn-tidy-dst'),
    groups: document.querySelectorAll('.tb-g').length,
  }));
  await T('按钮存在（hard/tidy-src/tidy-dst）+ 工具栏分组数 ≥ 4', async () => {
    if (!btns.hard || !btns.tidyS || !btns.tidyD) throw new Error(JSON.stringify(btns));
    if (btns.groups < 4) throw new Error('tb-g=' + btns.groups);
  });

  // 填充 src/dst
  await page.evaluate(() => {
    document.getElementById('src').value = 'The ambivalent reader found the hegemony of the footnote troubling.';
    document.getElementById('dst').value = '矛盾的读者觉得脚注的霸权很令人不安。 这句有问题 。，第三句正常。';
  });

  // mock callModelSimple → 3 条：精确匹配 / 宽松空白匹配 / 找不到
  await page.evaluate(() => {
    window.callModelSimple = async () => ({
      text: JSON.stringify([
        { seg: '矛盾的读者觉得脚注的霸权很令人不安。', type: '歧义', why: '「矛盾的读者」指代不明，ambivalent 被误译为自相矛盾', opts: ['这位内心矛盾的读者认为，脚注的霸权令人不安。', '读者对脚注的霸权地位感到不安。'], rec: 0, conf: '高' },
        { seg: '这句有问题 。，第三句正常。', type: 'ASR乱码', why: '标点错乱，句子边界不清', opts: ['这句有问题，第三句正常。'], rec: 0, conf: '中' },
        { seg: '这段译文里根本不存在的句子xyz', type: '可读性差', why: '无法定位', opts: ['替代译法'], rec: 0, conf: '低' },
      ]),
    });
  });

  await page.click('#btn-hard');
  await page.waitForTimeout(300);

  const m1 = await page.evaluate(() => ({
    on: document.getElementById('modal').classList.contains('on'),
    cards: document.querySelectorAll('.hard-card').length,
    title: document.getElementById('mTitle').textContent,
    alert: (document.querySelector('#mBody .alert') || {}).textContent || '',
    recChecked: (() => {
      const c = document.querySelector('.hard-card[data-i="0"]');
      const r = c && c.querySelector('input[type=radio]:checked');
      return r ? r.dataset.o : null;
    })(),
  }));
  await T('弹窗打开 3 张卡片 + 提示语', async () => {
    if (!m1.on || m1.cards !== 3) throw new Error(JSON.stringify(m1));
    if (!m1.alert.includes('AI 只报告')) throw new Error('alert=' + m1.alert);
  });
  await T('AI 推荐项默认选中（rec=0）', async () => { if (m1.recChecked !== '0') throw new Error('rec=' + m1.recChecked); });

  // 卡0：直接纳入推荐
  const before0 = await page.evaluate(() => document.getElementById('dst').value);
  await page.click('.hard-card[data-i="0"] .hard-apply');
  await page.waitForTimeout(150);
  const after0 = await page.evaluate(() => ({
    dst: document.getElementById('dst').value,
    btn: document.querySelector('.hard-card[data-i="0"] .hard-apply').textContent,
    border: document.querySelector('.hard-card[data-i="0"]').style.borderColor,
  }));
  await T('推荐译法纳入译文，卡片标记已纳入', async () => {
    if (!after0.dst.includes('这位内心矛盾的读者认为')) throw new Error('dst 未更新');
    if (after0.dst.includes('矛盾的读者觉得脚注的霸权很令人不安')) throw new Error('原句未被替换');
    if (!after0.btn.includes('已纳入')) throw new Error('btn=' + after0.btn);
    if (!after0.border.includes('ok') && after0.border !== 'var(--ok)') throw new Error('border=' + after0.border);
  });

  // 卡1：选自行输入 + 手写译法 → 纳入
  await page.click('.hard-card[data-i="1"] input[data-o="-1"]');
  await page.fill('.hard-card[data-i="1"] .hard-custom', '这句有问题，第三句正常。');
  await page.click('.hard-card[data-i="1"] .hard-apply');
  await page.waitForTimeout(150);
  const after1 = await page.evaluate(() => document.getElementById('dst').value);
  await T('自行输入译法纳入（宽松定位）', async () => {
    if (!after1.includes('这句有问题，第三句正常。')) throw new Error('dst=' + after1);
  });

  // 卡2：定位失败 → 报错且不改译文
  const before2 = after1;
  await page.click('.hard-card[data-i="2"] .hard-apply');
  await page.waitForTimeout(200);
  const r2 = await page.evaluate(() => ({
    dst: document.getElementById('dst').value,
    toast: [...document.querySelectorAll('body > div.alert')].map(d => d.textContent).join('|'),
  }));
  await T('定位失败给提示且不改译文', async () => {
    if (r2.dst !== before2) throw new Error('译文被误改');
    if (!r2.toast.includes('找不到原句')) throw new Error('toast=' + r2.toast);
  });

  // 跳过
  await page.click('.hard-card[data-i="2"] .hard-skip');
  const skipTxt = await page.evaluate(() => document.querySelector('.hard-card[data-i="2"] .hard-skip').textContent);
  await T('跳过标记', async () => { if (!skipTxt.includes('已跳过')) throw new Error(skipTxt); });

  // 空结果
  await page.evaluate(() => { window.callModelSimple = async () => ({ text: '[]' }); });
  await page.evaluate(() => { document.getElementById('mClose').click(); });
  await page.click('#btn-hard');
  await page.waitForTimeout(250);
  const m2 = await page.evaluate(() => ({
    alert: (document.querySelector('#mBody .alert') || {}).textContent || '',
    cards: document.querySelectorAll('.hard-card').length,
  }));
  await T('空结果提示「未发现明显疑难句」', async () => {
    if (m2.cards !== 0 || !m2.alert.includes('未发现明显疑难句')) throw new Error(JSON.stringify(m2));
  });
  await page.evaluate(() => { document.getElementById('mClose').click(); });

  // 整理：src
  await page.evaluate(() => {
    document.getElementById('src').value = '乱序  的  文本\n\n重复行';
    window.callModelSimple = async () => ({ text: '乱序的文本\n\n重复行' });
  });
  await page.click('#btn-tidy-src');
  await page.waitForTimeout(300);
  const tidyS = await page.evaluate(() => ({
    src: document.getElementById('src').value,
    toast: [...document.querySelectorAll('body > div.alert')].map(d => d.textContent).join('|'),
  }));
  await T('原文整理写回 + 提示字数变化', async () => {
    if (tidyS.src !== '乱序的文本\n\n重复行') throw new Error('src=' + JSON.stringify(tidyS.src));
    if (!tidyS.toast.includes('整理完成')) throw new Error('toast=' + tidyS.toast);
  });

  // 整理：dst + 围栏剥除
  await page.evaluate(() => {
    window.callModelSimple = async () => ({ text: '```\n干净译文一句。\n```' });
  });
  await page.click('#btn-tidy-dst');
  await page.waitForTimeout(300);
  const tidyD = await page.evaluate(() => document.getElementById('dst').value);
  await T('译文整理剥掉 markdown 围栏', async () => {
    if (tidyD !== '干净译文一句。') throw new Error('dst=' + JSON.stringify(tidyD));
  });

  await T('全程 0 console/page error', async () => { if (errors.length) throw new Error(errors.join(' | ')); });

  await browser.close();
  console.log('===== 结果: PASS=' + pass + ' FAIL=' + fail + ' =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
