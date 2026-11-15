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
  t('scoreRun 导出', await page.evaluate(() => typeof window.scoreRun === 'function'));
  t('scoreSplit 导出', await page.evaluate(() => typeof window.scoreSplit === 'function'));
  t('parseScoreArr 导出', await page.evaluate(() => typeof window.parseScoreArr === 'function'));
  t('scoreApplyOne 导出', await page.evaluate(() => typeof window.scoreApplyOne === 'function'));
  t('#btn-score 存在', await page.evaluate(() => !!document.getElementById('btn-score')));
  t('旧锚点 #btn-report 未动', await page.evaluate(() => !!document.getElementById('btn-report')));
  t('旧锚点 #btn-ask 未动', await page.evaluate(() => !!document.getElementById('btn-ask')));
  t('旧锚点 #btn-pnoun 未动', await page.evaluate(() => !!document.getElementById('btn-pnoun')));
  t('APP_VERSION 三段式', await page.evaluate(() => typeof APP_VERSION === 'string' && APP_VERSION.split('.').length === 3));

  // 2. parseScoreArr 容错（围栏 + 坏行）
  const parsed = await page.evaluate(() => {
    return window.parseScoreArr('```json\n[{"idx":1,"score":2,"comment":"x"},{"idx":2,"score":5},{"idx":"bad"}]\n```');
  });
  t('parseScoreArr 剥围栏后 2 条', parsed.length === 2 && parsed[0].score === 2 && parsed[1].score === 5);

  // 3. scoreSplit 分句正确
  await page.evaluate(() => { LAST_OUT = '## 一、修订后译文\n第一句原文。第二句原文。\n\n## 二、批注\n第一条批注。'; });
  const sp = await page.evaluate(() => window.scoreSplit());
  t('scoreSplit 2 句', sp.items.length === 2);
  t('第 1 句正确', sp.items[0].seg === '第一句原文');
  t('第 2 句正确', sp.items[1].seg === '第二句原文');

  // 4. mock 调用次数 + 回写
  const calls = await page.evaluate(async () => {
    CFG.apiKey = 'test-key';
    let n = 0;
    window.callModelSimple = async (sys, user, maxTok) => {
      n++;
      if(n === 1) return { text: '[{"idx":1,"score":2,"comment":"有歧义"},{"idx":2,"score":5,"comment":"很好"}]' };
      return { text: '改写后的句子' };
    };
    const fakeBtn = { disabled: false, textContent: '🎯 逐句评分' };
    // 页面加载后先确认没自动调用
    const before = n;
    await window.scoreRun(fakeBtn);
    const afterScore = n; // 应为 1
    await window.scoreApplyOne(0, fakeBtn);
    const afterApply = n; // 应为 2
    return { before: before, afterScore: afterScore, afterApply: afterApply, lastOut: LAST_OUT };
  });
  t('加载后未自动调用', calls.before === 0);
  t('评分恰 1 次调用', calls.afterScore === 1);
  t('单句应用恰 1 次调用', calls.afterApply === 2);
  t('回写成功（改写后的句子进 LAST_OUT）', calls.lastOut.indexOf('改写后的句子') >= 0);

  // 5. 无页面错误
  t('无页面错误', errors.length === 0);
  if(errors.length) console.log('  页面错误: ' + errors.join(' | '));

  await browser.close();
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail > 0 ? 1 : 0);
})();
