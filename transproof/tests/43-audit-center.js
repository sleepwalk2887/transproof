// 43-audit-center.js — 体检中心 + 译文总评分 + 风格简报（v4.36.0）
// 用法：node tests/43-audit-center.js（需本地 8123 服务在跑）
const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

let pass = 0, fail = 0;
async function T(name, fn){
  try{
    await fn();
    console.log('  ✅ ' + name);
    pass++;
  }catch(e){
    console.log('  ❌ ' + name + ' — ' + (e && e.message ? e.message.split('\n')[0] : e));
    fail++;
  }
}

(async () => {
  console.log('===== 体检中心 + 总评分 + 风格简报（v4.36.0）=====');
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e)));
  page.on('dialog', d => d.accept().catch(() => {}));

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  await T('体检中心按钮存在，且默认收起', async () => {
    const ok = await page.evaluate(() => {
      const btn = document.querySelector('#btn-audit-center');
      const box = document.querySelector('#audit-center');
      if(!btn) throw new Error('缺 #btn-audit-center');
      if(!box) throw new Error('缺 #audit-center');
      if(box.style.display !== 'none') throw new Error('默认应收起，实际 display=' + box.style.display);
      return true;
    });
    if(!ok) throw new Error('按钮/容器不对');
  });

  await T('四个旧体检按钮 id 全部保留（在体检中心里）', async () => {
    const r = await page.evaluate(() => ({
      audit: !!document.querySelector('#btn-audit'),
      pnoun: !!document.querySelector('#btn-pnoun'),
      para: !!document.querySelector('#btn-para-audit'),
      num: !!document.querySelector('#btn-num-audit'),
      quality: !!document.querySelector('#btn-quality'),
      tone: !!document.querySelector('#btn-tone')
    }));
    for(const k of Object.keys(r)){ if(!r[k]) throw new Error('缺 ' + k); }
  });

  await T('点体检中心 → 面板展开，勾选开关 ≥6 个', async () => {
    await page.evaluate(() => document.querySelector('#btn-audit-center').click());
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
      const box = document.querySelector('#audit-center');
      if(!box || box.style.display === 'none') throw new Error('面板没展开');
      return { opts: box.querySelectorAll('.opts input[type=checkbox]').length };
    });
    if(r.opts < 6) throw new Error('勾选开关只有 ' + r.opts + ' 个，应 ≥6');
  });

  await T('六项开关逐项可勾（可选项）', async () => {
    const r = await page.evaluate(() => {
      const ids = ['ao-term', 'ao-pnoun', 'ao-para', 'ao-num', 'ao-quality', 'ao-tone'];
      const out = {};
      ids.forEach(id => {
        const el = document.querySelector('#' + id);
        if(!el) throw new Error('缺 #' + id);
        out[id] = el.checked;
      });
      return out;
    });
    if(!r['ao-term'] || !r['ao-num'] || !r['ao-quality']) throw new Error('默认勾选不对');
    if(r['ao-tone']) throw new Error('风格简报默认应不勾');
  });

  await T('勾选状态存进 localStorage（可选项持久化）', async () => {
    await page.evaluate(() => {
      const el = document.querySelector('#ao-tone');
      el.checked = true;
      el.dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(200);
    const saved = await page.evaluate(() => {
      try{ return JSON.parse(localStorage.getItem('tp.auditOpts') || '{}'); }catch(e){ return {}; }
    });
    if(!saved.tone) throw new Error('没存进 tp.auditOpts：' + JSON.stringify(saved));
    await page.evaluate(() => {
      const el = document.querySelector('#ao-tone');
      el.checked = false;
      el.dispatchEvent(new Event('change'));
    });
    await page.waitForTimeout(150);
  });

  await T('乙 漏译残留：全英文译文 → 标「译文几乎没翻译」', async () => {
    const r = await page.evaluate(() => {
      const s = '合同有效期为 30 天，甲方应在 7 日内支付 100% 的款项。';
      const d = 'The contract shall remain valid for thirty days and the payment shall be made.';
      document.querySelector('#src').value = s;
      document.querySelector('#dst').value = d;
      const q = qualityScore(s, d);
      return { ok:q.ok, score:q.score, items:q.items.length, cats:q.items.map(i => i.cat) };
    });
    if(!r.ok) throw new Error('qualityScore 返回 ok=false');
    if(!(r.score < 100)) throw new Error('有硬伤却给了满分：' + r.score);
    if(r.cats.indexOf('译文几乎没翻译') < 0) throw new Error('没查出漏译，扣分项=' + r.cats.join('|'));
  });

  await T('乙 漏译残留：中英混排 → 标「未翻译残留」', async () => {
    const r = await page.evaluate(() => {
      const s = '本合同自双方签署之日起生效，有效期为一年，期满前双方可协商续签事宜。';
      const d = '本合同自双方签署之日起生效，有效期为一年，期满前 the parties may negotiate renewal of this agreement 相关事宜。';
      const q = qualityScore(s, d);
      return { cats:q.items.map(i => i.cat), items:q.items.length };
    });
    if(r.cats.indexOf('未翻译残留') < 0) throw new Error('没查出未翻译残留，扣分项=' + r.cats.join('|'));
  });

  await T('丙 占位符保护：网址被丢 → 点名', async () => {
    const r = await page.evaluate(() => {
      const s = '详情见 https://example.com/terms 。甲方为张三，邮箱 a@b.com。';
      const d = '详情见相关内容。甲方为张三。';
      const q = qualityScore(s, d);
      return { cats:q.items.map(i => i.cat), detail:q.items.map(i => i.detail).join('|') };
    });
    if(r.cats.indexOf('占位符保护') < 0) throw new Error('没查出占位符丢失，扣分项=' + r.cats.join('|'));
    if(r.detail.indexOf('example.com') < 0) throw new Error('没点名具体丢的是什么：' + r.detail);
  });

  await T('干净译文接近满分（不误报）', async () => {
    const r = await page.evaluate(() => {
      const s = '合同有效期为 30 天，甲方应在 7 日内支付 100% 的款项。见 https://example.com/a 。';
      const d = '合同有效期为 30 天，甲方应在 7 日内支付 100% 的款项。见 https://example.com/a 。';
      const q = qualityScore(s, d);
      return { score:q.score, items:q.items.length };
    });
    if(r.items !== 0) throw new Error('干净译文却扣了 ' + r.items + ' 项');
    if(r.score < 95) throw new Error('干净译文分太低：' + r.score);
  });

  await T('风格简报：按体裁调性给清单', async () => {
    const r = await page.evaluate(() => {
      document.querySelector('#tone').value = '学术严谨';
      const items = toneBriefFor('学术严谨');
      return { n: items.length, has: items.join('|').indexOf('限定语') >= 0 };
    });
    if(r.n < 3) throw new Error('清单太短：' + r.n);
    if(!r.has) throw new Error('学术严谨清单内容不对');
  });

  await T('一键体检：聚合各项结果', async () => {
    await page.evaluate(() => {
      document.querySelector('#src').value = '这是第一段。\n\n这是第二段，里面有 30 天。';
      document.querySelector('#dst').value = '这是第一段。\n\n这是第二段，里面有 30 天。';
    });
    await page.evaluate(() => document.querySelector('#btn-audit-all').click());
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const modal = document.querySelector('#modal');
      if(!modal || !modal.classList.contains('on')) throw new Error('弹窗没开');
      const title = (document.querySelector('#mTitle') || {}).textContent || '';
      const rows = document.querySelectorAll('#mBody [data-aopen]').length;
      return { title, rows };
    });
    if(r.title.indexOf('体检中心') < 0) throw new Error('弹窗标题不对：' + r.title);
    if(r.rows < 4) throw new Error('聚合行只有 ' + r.rows + ' 行，应 ≥4');
    await page.evaluate(() => { const c = document.querySelector('#mClose'); if(c) c.click(); });
    await page.waitForTimeout(200);
  });

  await T('收起体检中心生效', async () => {
    await page.evaluate(() => document.querySelector('#btn-audit-center').click());
    await page.waitForTimeout(200);
    const hidden = await page.evaluate(() => document.querySelector('#audit-center').style.display === 'none');
    if(!hidden) throw new Error('点收起后面板还在');
  });

  await T('无 JS 运行时错误', async () => {
    if(errs.length) throw new Error('捕获到错误：' + errs.slice(0, 3).join(' | '));
  });

  await browser.close();
  console.log('\n========== 汇总 ==========');
  console.log('通过: ' + pass + '  失败: ' + fail);
  if(errs.length) console.log('page errors: ' + errs.length + ' → ' + errs.slice(0, 2).join(' | '));
  process.exit(fail ? 1 : 0);
})();
