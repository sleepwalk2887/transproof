// 语法校验：index.html 内联 script（new Function）+ js/*.js 每文件（node --check）
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
let bad = 0;

// 1) index.html 内联 script
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)];
scripts.forEach((m, i) => {
  try { new Function(m[1]); } catch (e) { bad++; console.log('inline#' + i + ' SYNTAX ERROR:', e.message); }
});
console.log('inline scripts=' + scripts.length + ' bad=' + bad);

// 2) js/*.js 逐文件 node --check
const jsDir = path.join(__dirname, 'js');
if (fs.existsSync(jsDir)) {
  const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();
  let jsBad = 0;
  for (const f of files) {
    const r = spawnSync(process.execPath, ['--check', path.join(jsDir, f)], { encoding: 'utf8' });
    if (r.status !== 0) { jsBad++; bad++; console.log('js/' + f + ' SYNTAX ERROR:', (r.stderr || '').split('\n').slice(0, 3).join(' | ')); }
  }
  console.log('js files=' + files.length + ' jsBad=' + jsBad);
} else {
  console.log('js files=0 (未拆分版)');
}
console.log('TOTAL bad=' + bad);
process.exit(bad ? 1 : 0);
