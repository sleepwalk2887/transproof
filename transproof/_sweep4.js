// 一次性：把 <style> 块内 margin/padding/gap 的 px 值取整到 4 的倍数。
// 排除：#tp-splash、@keyframes、border-radius、font-*、JS 字符串（只扫 style 块）。
const fs = require('fs');
const f = __dirname + '/index.html';
let html = fs.readFileSync(f, 'utf8');

const s0 = html.indexOf('<style>');
const s1 = html.indexOf('</style>');
if (s0 < 0 || s1 < 0) { console.error('no style block'); process.exit(1); }
let css = html.slice(s0 + 7, s1);

// 切出 #tp-splash 与 @keyframes 的区段，原样保留
const keep = [];
function stash(re) {
  css = css.replace(re, m => { keep.push(m); return `\u0000${keep.length - 1}\u0000`; });
}
stash(/#tp-splash[^{]*\{[^}]*\}/g);
stash(/:root\[data-theme[^\{]*#tp-splash[^{]*\{[^}]*\}/g);
stash(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g);

const round4 = v => {
  const n = parseFloat(v);
  if (!isFinite(n)) return v;
  const r = Math.round(n / 4) * 4;
  return String(Math.max(r, 0)) + 'px';
};

const before = css;
// margin / padding / gap 声明值里的 px 数取 4 倍数
css = css.replace(/\b(margin(?:-top|-bottom|-left|-right)?|padding(?:-top|-bottom|-left|-right)?|gap|row-gap|column-gap)\s*:\s*([^;{}]+)/g, (m, prop, val) => {
  if (/^\s*(0|auto|inherit|initial|none)\s*$/.test(val)) return m;
  const nv = val.replace(/-?\d+(\.\d+)?px/g, mm => {
    const n = parseFloat(mm);
    if (n === 0) return mm;
    const r = Math.round(Math.abs(n) / 4) * 4;
    return (n < 0 ? '-' : '') + r + 'px';
  });
  return prop + ':' + nv;
});

// 还原保护区段
css = css.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]);

html = html.slice(0, s0 + 7) + css + html.slice(s1);
fs.writeFileSync(f, html);

// 报告：style 块内还有哪些非 4 倍数的 margin/padding/gap
const css2 = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'))
  .replace(/#tp-splash[^{]*\{[^}]*\}/g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
const bad = [];
css2.replace(/\b(margin|padding|gap|row-gap|column-gap)(-[a-z]+)?\s*:\s*([^;{}]+)/g, (m, p, s2, val) => {
  const nums = val.match(/-?\d+(\.\d+)?px/g) || [];
  nums.forEach(nn => { if (parseFloat(nn) % 4 !== 0) bad.push(m.trim()); });
  return m;
});
console.log('changed:', before !== css ? 'yes' : 'no');
console.log('remaining non-multiple-of-4:', bad.length);
bad.slice(0, 20).forEach(b => console.log('  ', b));
