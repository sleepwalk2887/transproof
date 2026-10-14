// BRIEF 第 8 节验收自查（适配拆分版：CSS/HTML 在 index.html，逻辑在 js/*.js）
const fs = require('fs');
const path = require('path');
const h = fs.readFileSync(__dirname + '/index.html', 'utf8');
const s0 = h.indexOf('<style>'), s1 = h.indexOf('</style>');
const css = h.slice(s0 + 7, s1);
const style = css
  .replace(/#tp-splash[^{]*\{[^}]*\}/g, '')
  .replace(/:root\[data-theme[^\{]*#tp-splash[^{]*\{[^}]*\}/g, '')
  .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
const jsDir = path.join(__dirname, 'js');
const jsAll = fs.existsSync(jsDir)
  ? fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort()
      .map(f => fs.readFileSync(path.join(jsDir, f), 'utf8')).join('\n')
  : '';

// 1. 4px 间距
let bad = 0; const badList = [];
style.replace(/\b(margin|padding|gap|row-gap|column-gap)(-[a-z]+)?\s*:\s*([^;{}]+)/g, (m, p, s, v) => {
  for (const n of (v.match(/-?\d+(\.\d+)?px/g) || [])) {
    if (parseFloat(n) % 4 !== 0) { bad++; badList.push(m.trim()); }
  }
  return m;
});
console.log('1) non-4px spacing:', bad);
badList.slice(0, 10).forEach(x => console.log('   ', x));

// 2. 裸 font-family（index.html + js/*.js；非 var(--f-*)、非 inherit）
const ff = [...(h + '\n' + jsAll).matchAll(/font-family\s*:\s*[^;"'}]+/g)].map(m => m[0])
  .filter(x => !x.includes('var(--f-') && !x.includes('inherit'));
console.log('2) bare font-family:', ff.length, '(limit 3)');
ff.forEach(x => console.log('   ', x.trim().slice(0, 90)));

// 3. 字重 <400 / italic
console.log('3) font-weight<400:', (css.match(/font-weight\s*:\s*(100|200|300)\b/g) || []).length,
            '| italic:', (css.match(/font-style\s*:\s*italic/g) || []).length);

// 4. 开屏时长参数化（写死 .7s 应为 0；var(--sp-dur) 应 5 处、sp-d1..d4 各 1）——在原始 CSS 上数
console.log('4) hardcoded spIn .7s:', (css.match(/spIn \.7s/g) || []).length,
            '| var(--sp-dur):', (css.match(/var\(--sp-dur\)/g) || []).length,
            '| sp delays var:', (css.match(/var\(--sp-d[1-4]\)/g) || []).length);

// 5. 禁区：配色基座 / 圆角 / 阴影
console.log('5) bg#1a1915:', h.includes('--bg:#1a1915'), '| bg#ece5d6:', h.includes('--bg:#ece5d6'),
            '| ac#d63a2c:', h.includes('--ac:#d63a2c'), '| --r:2px:', h.includes('--r:2px'),
            '| sh:none:', h.includes('--sh:none'));

// 6. 分区字体就位
console.log('6) --f-ui:', css.includes('--f-ui:'), '| --f-read:', css.includes('--f-read:'),
            '| --f-mono:', css.includes('--f-mono:'), '| --f-quote:', css.includes('--f-quote:'),
            '| fw-strong:', css.includes('--fw-strong:'));

// 7. 读层/标签（TAG 映射现在 js/08-render-audit.js）
console.log('7) .out read layer:', /\.out\{[^}]*var\(--f-read\)/s.test(css),
            '| t-tag:', css.includes('.t-tag'), '| data-tag:', (h + jsAll).includes("TAG[k] || '检'"),
            '| g-col 术:', css.includes(".g-col::before{content:'术';"));
