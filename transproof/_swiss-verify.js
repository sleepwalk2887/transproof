const { chromium } = require('C:/Users/Andrew/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  const probe = () => page.evaluate(() => {
    const gs = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return 'N/A';
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, radius: s.borderRadius, shadow: s.boxShadow === 'none' ? 'none' : 'HAS-SHADOW', font: s.fontFamily.split(',')[0], size: s.fontSize, weight: s.fontWeight };
    };
    const gsP = (sel, pseudo) => {
      const el = document.querySelector(sel);
      if (!el) return 'N/A';
      const s = getComputedStyle(el, pseudo);
      return { content: s.content, bg: s.backgroundColor, bgImage: s.backgroundImage.slice(0, 90), radius: s.borderRadius };
    };
    const root = getComputedStyle(document.documentElement);
    return {
      '--ac': root.getPropertyValue('--ac').trim(),
      '--bg': root.getPropertyValue('--bg').trim(),
      '--r': root.getPropertyValue('--r').trim(),
      '--sh': root.getPropertyValue('--sh').trim(),
      'body': gs('body'),
      '.btn.pri': gs('.btn.pri'),
      '#p-work .card': gs('#p-work .card'),
      '#p-work .card>h3': gs('#p-work .card>h3'),
      '.logo .mark': gs('.logo .mark'),
      // NASA-punk 融合元素
      'header::before 彩条': gsP('header', '::before'),
      '#p-work .card::before 铆钉': gsP('#p-work .card', '::before'),
      '#p-work h3::before 斜纹': gsP('#p-work .card>h3', '::before'),
      '#p-work h3::after UNIT': gsP('#p-work .card>h3', '::after'),
    };
  });

  console.log('========== 暗色主题 ==========');
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await page.waitForTimeout(300);
  console.log(JSON.stringify(await probe(), null, 1));

  console.log('\n========== 亮色主题 ==========');
  await page.evaluate(() => document.documentElement.dataset.theme = 'light');
  await page.waitForTimeout(300);
  console.log(JSON.stringify(await probe(), null, 1));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
