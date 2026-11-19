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

  // 1. 抽象层存在
  t('TP_STORE 存在', await page.evaluate(() => typeof TP_STORE === 'object' && typeof TP_STORE.get === 'function' && typeof TP_STORE.set === 'function'));
  t('TP_STORE_MEM 存在', await page.evaluate(() => typeof TP_STORE_MEM === 'object' && typeof TP_STORE_MEM.get === 'function'));
  t('tpUseStore 是函数', await page.evaluate(() => typeof tpUseStore === 'function'));

  // 2. 默认路径：save/load 往返等价（localStorage）
  const rt = await page.evaluate(() => {
    localStorage.removeItem('__t67_local');
    save('__t67_local', { a: 1, b: 'x' });
    const raw = localStorage.getItem('__t67_local');
    const back = load('__t67_local', null);
    return { raw: raw, back: back };
  });
  t('save 写 localStorage', rt.raw === '{"a":1,"b":"x"}');
  t('load 读回等价', rt.back && rt.back.a === 1 && rt.back.b === 'x');

  // 3. 切 mem：不写 localStorage、能从 mem 读
  const mem = await page.evaluate(() => {
    tpUseStore('mem');
    localStorage.removeItem('__t67_mem');
    save('__t67_mem', { c: 2 });
    const lsAfter = localStorage.getItem('__t67_mem');
    const back = load('__t67_mem', null);
    return { lsAfter: lsAfter, back: back };
  });
  t('切 mem 后不写 localStorage', mem.lsAfter === null);
  t('切 mem 后 load 从内存读', mem.back && mem.back.c === 2);

  // 4. 切回 local：恢复 localStorage 读写
  const back = await page.evaluate(() => {
    tpUseStore('local');
    localStorage.removeItem('__t67_back');
    save('__t67_back', { d: 3 });
    const lsAfter = localStorage.getItem('__t67_back');
    const got = load('__t67_back', null);
    return { lsAfter: lsAfter, got: got };
  });
  t('切回 local 恢复写 localStorage', back.lsAfter === '{"d":3}');
  t('切回 local 恢复读', back.got && back.got.d === 3);

  // 5. 清理 + 旧锚点
  await page.evaluate(() => { localStorage.removeItem('__t67_local'); localStorage.removeItem('__t67_back'); tpUseStore('local'); });
  t('旧锚点 #btn-pnoun 未动', await page.evaluate(() => !!document.getElementById('btn-pnoun')));
  t('无页面错误', errors.length === 0);

  console.log('PASS=' + pass + ' FAIL=' + fail + ' TOTAL=' + (pass + fail));
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
