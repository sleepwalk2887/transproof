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

  // 1. 函数导出 + 按钮 + 旧锚点
  t('askData 导出', await page.evaluate(() => typeof window.askData === 'function'));
  t('askMarkdown 导出', await page.evaluate(() => typeof window.askMarkdown === 'function'));
  t('askOpen 导出', await page.evaluate(() => typeof window.askOpen === 'function'));
  t('#btn-ask 存在', await page.evaluate(() => !!document.getElementById('btn-ask')));
  t('旧锚点 #btn-report 未动', await page.evaluate(() => !!document.getElementById('btn-report')));
  t('旧锚点 #btn-pnoun 未动', await page.evaluate(() => !!document.getElementById('btn-pnoun')));
  t('旧锚点 #ao-pnoun 未动', await page.evaluate(() => !!document.getElementById('ao-pnoun')));
  t('APP_VERSION 三段式', await page.evaluate(() => typeof APP_VERSION === 'string' && APP_VERSION.split('.').length === 3));

  // 2. 注入四类样例数据
  await page.evaluate(() => {
    HARD_ITEMS = [{ seg: '这段译文有歧义', type: '歧义', why: '主谓关系不清', opts: ['候选甲', '候选乙'], rec: 0 }];
    GLOSS.terms = [
      { id: 1, foreign: 'translate', zh: '翻译', status: 'pending', tags: ['术语收集'], type: '概念', note: '' },
      { id: 2, foreign: 'Jean-Jacques Rousseau', zh: '让-雅克·卢梭', status: 'pending', tags: ['专名收集'], type: '人物', note: '' },
      { id: 3, foreign: 'confirmed-term', zh: '已批准', status: 'confirmed', tags: [] }
    ];
    LAST_OUT = '### 词条：decision-term\n**通行译法**：\n- 方案甲\n- 方案乙\n**本语境推荐**：方案甲';
  });
  await page.waitForTimeout(100);

  // 3. 四类聚合各 ≥1
  const d = await page.evaluate(() => window.askData());
  t('疑难句 ≥1', d.hard.length >= 1);
  t('待定夺译法 ≥1', d.decision.length >= 1);
  t('术语待审 ≥1', d.terms.length >= 1);
  t('专名待核验 ≥1', d.nouns.length >= 1);
  t('confirmed 不进清单', d.terms.filter(x => x.foreign === 'confirmed-term').length === 0 && d.nouns.filter(x => x.foreign === 'confirmed-term').length === 0);

  // 4. Markdown 合法（四节标题 + 条目）
  const md = await page.evaluate(() => window.askMarkdown());
  t('含标题', md.indexOf('# 疑问清单') >= 0);
  t('含一节', md.indexOf('## 一、疑难句') >= 0);
  t('含二节', md.indexOf('## 二、待定夺译法') >= 0);
  t('含三节', md.indexOf('## 三、术语待审') >= 0);
  t('含四节', md.indexOf('## 四、专名待核验') >= 0);
  t('含疑难片段', md.indexOf('这段译文有歧义') >= 0);
  t('含候选译法', md.indexOf('候选甲') >= 0);
  t('含术语词条', md.indexOf('translate') >= 0 && md.indexOf('翻译') >= 0);
  t('含专名词条', md.indexOf('Jean-Jacques Rousseau') >= 0);

  // 5. 空态
  await page.evaluate(() => {
    HARD_ITEMS = [];
    GLOSS.terms = [];
    LAST_OUT = '';
  });
  const md2 = await page.evaluate(() => window.askMarkdown());
  t('空态五节都（无）', (md2.match(/（无）/g) || []).length === 5);

  // 6. 无页面错误
  t('无页面错误', errors.length === 0);
  if(errors.length) console.log('  页面错误: ' + errors.join(' | '));

  await browser.close();
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail > 0 ? 1 : 0);
})();
